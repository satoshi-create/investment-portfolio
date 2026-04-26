import type { Client } from "@libsql/client";

import {
  classifyTickerInstrument,
  computeAlphaPercent,
  dailyReturnPercent,
  defaultBenchmarkTickerForTicker,
  imputeSpikeDatedAlphaRows,
  spikeImputeOptionsForStockAndBenchmark,
  SIGNAL_BENCHMARK_TICKER,
  THEME_STRUCTURAL_TREND_LOOKBACK_DAYS,
} from "@/src/lib/alpha-logic";
import { linkAlphaHistoryHoldingForTicker, upsertAlphaHistoryRow } from "@/src/lib/db-operations";
import { fetchHoldingsWithProviderForUser } from "@/src/lib/holdings-queries";
import { signalsDebug } from "@/src/lib/signals-debug";
import type { PriceBar } from "@/src/lib/price-service";
import { fetchPriceHistory } from "@/src/lib/price-service";
import type { Holding } from "@/src/types/investment";

/** Total rows below this ⇒ treat as “too thin” and backfill. */
const MIN_TOTAL_ALPHA_ROWS = 20;
/** Rough proxy for “missing ~30 trading days” of recent coverage (~40 calendar days in SQL). */
const MIN_RECENT_ALPHA_ROWS = 12;
/**
 * If the newest `alpha_history` bar is older than this many **calendar days** (UTC) behind “today”,
 * still run Yahoo backfill. Otherwise row-count thresholds alone can leave history frozen (see signals-debug).
 */
const STALE_ALPHA_CALENDAR_LAG_DAYS = 5;

function sharedSortedDates(stockBars: PriceBar[], benchBars: PriceBar[]): string[] {
  const benchSet = new Set(benchBars.map((b) => b.date));
  return [...new Set(stockBars.map((b) => b.date).filter((d) => benchSet.has(d)))].sort();
}

/** エコシステム行から Alpha バックフィル対象（上場ティッカー文字列）を一意化して返す。 */
export type EcosystemAlphaMemberInput = {
  isUnlisted: boolean;
  ticker: string;
  proxyTicker: string | null;
};

export type AlphaWatchTarget = { ticker: string; providerSymbol: string | null };

export function alphaWatchTargetsFromEcosystemMembers(rows: EcosystemAlphaMemberInput[]): AlphaWatchTarget[] {
  const map = new Map<string, AlphaWatchTarget>();
  for (const r of rows) {
    const raw = r.isUnlisted
      ? r.proxyTicker != null && String(r.proxyTicker).trim().length > 0
        ? String(r.proxyTicker).trim()
        : null
      : String(r.ticker).trim();
    if (!raw) continue;
    const u = raw.toUpperCase();
    if (!map.has(u)) map.set(u, { ticker: raw, providerSymbol: null });
  }
  return [...map.values()];
}

async function countAlphaHistoryTotal(
  db: Client,
  userId: string,
  ticker: string,
  benchmark: string,
): Promise<number> {
  const rs = await db.execute({
    sql: `SELECT COUNT(*) AS c FROM alpha_history
          WHERE user_id = ? AND ticker = ? AND benchmark_ticker = ?`,
    args: [userId, ticker, benchmark],
  });
  return Number(rs.rows[0]?.c ?? 0);
}

async function countAlphaHistoryRecent(
  db: Client,
  userId: string,
  ticker: string,
  benchmark: string,
): Promise<number> {
  const rs = await db.execute({
    sql: `SELECT COUNT(*) AS c FROM alpha_history
          WHERE user_id = ? AND ticker = ? AND benchmark_ticker = ?
            AND date(recorded_at) >= date('now', '-40 days')`,
    args: [userId, ticker, benchmark],
  });
  return Number(rs.rows[0]?.c ?? 0);
}

async function getLatestAlphaHistoryYmd(
  db: Client,
  userId: string,
  ticker: string,
  benchmark: string,
): Promise<string | null> {
  const rs = await db.execute({
    sql: `SELECT MAX(substr(recorded_at, 1, 10)) AS ymd FROM alpha_history
          WHERE user_id = ? AND ticker = ? AND benchmark_ticker = ?`,
    args: [userId, ticker, benchmark],
  });
  const raw = rs.rows[0]?.ymd;
  if (raw == null) return null;
  const s = String(raw).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : s.length >= 10 ? s.slice(0, 10) : null;
}

/** True when the latest daily bar is too far behind wall-clock (UTC calendar days). */
function isAlphaHistoryWallClockStale(latestYmd: string | null): boolean {
  if (latestYmd == null || latestYmd.length < 10) return true;
  const y = Number(latestYmd.slice(0, 4));
  const m = Number(latestYmd.slice(5, 7)) - 1;
  const d = Number(latestYmd.slice(8, 10));
  const latestUtc = Date.UTC(y, m, d);
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const diffDays = (todayUtc - latestUtc) / (24 * 60 * 60 * 1000);
  return diffDays > STALE_ALPHA_CALENDAR_LAG_DAYS;
}

function needsBackfill(total: number, recent: number, latestYmd: string | null): boolean {
  if (total === 0) return true;
  if (total < MIN_TOTAL_ALPHA_ROWS) return true;
  if (recent < MIN_RECENT_ALPHA_ROWS) return true;
  if (isAlphaHistoryWallClockStale(latestYmd)) return true;
  return false;
}

/** 単一日だけ再計算・upsert するときに `backfillAlphaHistoryForTicker` へ渡す。 */
export type BackfillAlphaHistoryOptions = {
  /** 終端観測日 YYYY-MM-DD がこの集合に含まれるときだけ書き込む（それ以外の日はスキップ）。 */
  onlyRecordedAtYmds?: Set<string>;
};

function normalizeForceYmd(raw: string | undefined): string | null {
  const t = raw?.trim().slice(0, 10) ?? "";
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null;
}

/**
 * Yahoo + 銘柄種別の既定ベンチで `alpha_history` を upsert。保有に紐づかない観測ティッカーは `holdingId` を省略。
 */
export async function backfillAlphaHistoryForTicker(
  db: Client,
  userId: string,
  args: {
    ticker: string;
    providerSymbol?: string | null;
    holdingId?: string | null;
  },
  benchBars: PriceBar[],
  benchmarkTicker: string,
  days: number,
  options?: BackfillAlphaHistoryOptions,
): Promise<number> {
  const benchByDate = new Map(benchBars.map((b) => [b.date, b.close]));
  const stockBars = await fetchPriceHistory(args.ticker, days, args.providerSymbol ?? null, { forAlpha: true });
  const stockBy = new Map(stockBars.map((b) => [b.date, b.close]));
  let shared = sharedSortedDates(stockBars, benchBars);
  if (shared.length < 2) {
    signalsDebug("backfillAlphaHistoryForTicker: insufficient overlapping dates", {
      ticker: args.ticker,
      stockBars: stockBars.length,
      benchBars: benchBars.length,
      sharedDates: shared.length,
      benchmark: benchmarkTicker,
    });
    return 0;
  }
  const safeDays = Math.max(1, days);
  if (shared.length > safeDays) {
    shared = shared.slice(-safeDays);
  }

  const onlyDates = options?.onlyRecordedAtYmds;
  const restrictDates = onlyDates != null && onlyDates.size > 0;

  const kind = classifyTickerInstrument(args.ticker);
  const isJp = kind === "JP_LISTED_EQUITY" || kind === "JP_INVESTMENT_TRUST";

  type RowDraft = { dCur: string; s1: number; alpha: number };
  const drafts: RowDraft[] = [];
  for (let i = 1; i < shared.length; i++) {
    const dPrev = shared[i - 1]!;
    const dCur = shared[i]!;

    const s0 = stockBy.get(dPrev);
    const s1 = stockBy.get(dCur);
    const b0 = benchByDate.get(dPrev);
    const b1 = benchByDate.get(dCur);
    if (s0 == null || s1 == null || b0 == null || b1 == null) continue;

    const rStock = dailyReturnPercent(s0, s1);
    const rBench = dailyReturnPercent(b0, b1);
    const alpha = computeAlphaPercent(rStock, rBench);
    if (alpha == null) continue;
    drafts.push({ dCur, s1, alpha });
  }

  const dated = drafts.map((d) => ({ recordedAt: d.dCur, alphaValue: d.alpha }));
  const imputed = isJp
    ? imputeSpikeDatedAlphaRows(dated, spikeImputeOptionsForStockAndBenchmark(args.ticker, benchmarkTicker))
    : dated;
  const draftByYmd = new Map(drafts.map((d) => [d.dCur, d]));

  let written = 0;
  for (const r of imputed) {
    const dCur = r.recordedAt.length >= 10 ? r.recordedAt.slice(0, 10) : r.recordedAt;
    if (dCur.length !== 10) continue;
    if (restrictDates && !onlyDates!.has(dCur)) continue;
    const draft = draftByYmd.get(dCur);
    if (draft == null) continue;
    const alpha = r.alphaValue;
    if (alpha == null || !Number.isFinite(alpha)) continue;
    const s1 = draft.s1;

    try {
      await upsertAlphaHistoryRow(db, {
        userId,
        ticker: args.ticker,
        holdingId: args.holdingId,
        recordedAtYmd: dCur,
        closePrice: s1,
        alphaValue: alpha,
        benchmarkTicker,
      });
      written += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[alpha-reconcile] upsertAlphaHistoryRow skip ${args.ticker} ${dCur}: ${msg}`);
    }
  }
  return written;
}

async function backfillOneHolding(
  db: Client,
  userId: string,
  holding: Holding,
  benchBars: PriceBar[],
  benchmarkTicker: string,
  days: number,
  options?: BackfillAlphaHistoryOptions,
): Promise<number> {
  return backfillAlphaHistoryForTicker(
    db,
    userId,
    { ticker: holding.ticker, providerSymbol: holding.providerSymbol, holdingId: holding.id },
    benchBars,
    benchmarkTicker,
    days,
    options,
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type ReconcileWatchlistAlphaResult = {
  rowsBackfilled: number;
  backfilledTickers: string[];
};

/**
 * テーマエコシステム等の「保有外」ティッカーに対し、履歴が薄いときだけ既定ベンチ対比 Alpha をバックフィルする。
 */
export async function reconcileAlphaHistoryForWatchlistTickers(
  db: Client,
  userId: string,
  targets: AlphaWatchTarget[],
  options?: {
    days?: number;
    delayMs?: number;
    maxTickers?: number;
    forceRebackfillYmd?: string;
    /** 薄い履歴判定を飛ばし、Yahoo から全期間を再 upsert（スパイク修正スクリプト用） */
    forceFullRebackfill?: boolean;
  },
): Promise<ReconcileWatchlistAlphaResult> {
  /** 直近 90 日窓 + 営業日ズレを吸収するため、既定はテーマ窓より長めに取る。 */
  const days =
    options?.days ??
    Math.min(150, Math.max(THEME_STRUCTURAL_TREND_LOOKBACK_DAYS + 45, 60));
  const delayMs = Math.max(0, Math.floor(options?.delayMs ?? 200));
  const maxTickers = Math.max(1, Math.floor(options?.maxTickers ?? 20));
  const forceYmd = normalizeForceYmd(options?.forceRebackfillYmd);
  const singleDayOpts: BackfillAlphaHistoryOptions | undefined =
    forceYmd != null ? { onlyRecordedAtYmds: new Set([forceYmd]) } : undefined;

  let rowsBackfilled = 0;
  const backfilledTickers: string[] = [];
  const benchBarsCache = new Map<string, PriceBar[]>();

  const forceFull = options?.forceFullRebackfill === true;
  const capped = targets.slice(0, maxTickers);

  for (let i = 0; i < capped.length; i++) {
    const t = capped[i]!;
    try {
      const benchmarkTicker = defaultBenchmarkTickerForTicker(t.ticker);
      const total = await countAlphaHistoryTotal(db, userId, t.ticker, benchmarkTicker);
      const recent = await countAlphaHistoryRecent(db, userId, t.ticker, benchmarkTicker);
      const latestYmd = await getLatestAlphaHistoryYmd(db, userId, t.ticker, benchmarkTicker);
      if (!forceFull && !needsBackfill(total, recent, latestYmd) && forceYmd == null) continue;

      let benchBars = benchBarsCache.get(benchmarkTicker) ?? null;
      if (!benchBars) {
        benchBars = await fetchPriceHistory(benchmarkTicker, days, null, { forAlpha: true });
        benchBarsCache.set(benchmarkTicker, benchBars);
      }
      if (benchBars.length < 2) break;

      const n = await backfillAlphaHistoryForTicker(db, userId, t, benchBars, benchmarkTicker, days, singleDayOpts);
      rowsBackfilled += n;
      if (n > 0) backfilledTickers.push(t.ticker);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[alpha-reconcile] watchlist backfill skip ticker=${t.ticker}: ${msg}`);
    }

    if (i < capped.length - 1 && delayMs > 0) await sleep(delayMs);
  }

  return { rowsBackfilled, backfilledTickers };
}

export type ReconcileAlphaHistoryResult = {
  /** Tickers that had `holding_id` bulk-updated to the current holding row */
  linkedTickers: string[];
  backfilledTickers: string[];
  rowsBackfilled: number;
};

/**
 * For each holding: set `holding_id` on all matching `alpha_history` rows (re-link after re-add),
 * then backfill from Yahoo when history is empty, too thin vs recent window, or stale vs wall-clock.
 */
export async function reconcileAlphaHistoryForUser(
  userId: string,
  db: Client,
  options?: { days?: number; forceRebackfillYmd?: string },
): Promise<ReconcileAlphaHistoryResult> {
  const holdings = await fetchHoldingsWithProviderForUser(db, userId);
  const linkedTickers: string[] = [];
  const backfilledTickers: string[] = [];
  let rowsBackfilled = 0;

  const days = options?.days ?? Math.max(5, Math.min(120, Math.floor(Number(process.env.BACKFILL_DAYS ?? "30") || 30)));
  const forceYmd = normalizeForceYmd(options?.forceRebackfillYmd);
  const singleDayOpts: BackfillAlphaHistoryOptions | undefined =
    forceYmd != null ? { onlyRecordedAtYmds: new Set([forceYmd]) } : undefined;

  signalsDebug("reconcileAlphaHistoryForUser start", {
    userId,
    holdingCount: holdings.length,
    backfillWindowDays: days,
    benchmarkDefaultFallback: SIGNAL_BENCHMARK_TICKER,
    forceRebackfillYmd: forceYmd,
  });

  const benchBarsCache = new Map<string, PriceBar[]>();

  for (const h of holdings) {
    const benchmarkTicker = defaultBenchmarkTickerForTicker(h.ticker);
    await linkAlphaHistoryHoldingForTicker(db, userId, h.ticker, h.id, benchmarkTicker);
    linkedTickers.push(h.ticker);

    const total = await countAlphaHistoryTotal(db, userId, h.ticker, benchmarkTicker);
    const recent = await countAlphaHistoryRecent(db, userId, h.ticker, benchmarkTicker);
    const latestYmd = await getLatestAlphaHistoryYmd(db, userId, h.ticker, benchmarkTicker);
    const need = needsBackfill(total, recent, latestYmd);
    signalsDebug("reconcile holding", {
      ticker: h.ticker,
      holdingId: h.id,
      alphaHistoryTotal: total,
      alphaHistoryRecent40d: recent,
      alphaHistoryLatestYmd: latestYmd,
      wallClockStale: isAlphaHistoryWallClockStale(latestYmd),
      staleAfterCalendarDays: STALE_ALPHA_CALENDAR_LAG_DAYS,
      needsBackfill: need,
      benchmark: benchmarkTicker,
    });
    if (!need && forceYmd == null) continue;

    let benchBars = benchBarsCache.get(benchmarkTicker) ?? null;
    if (!benchBars) {
      benchBars = await fetchPriceHistory(benchmarkTicker, days, null, { forAlpha: true });
      benchBarsCache.set(benchmarkTicker, benchBars);
      signalsDebug("fetched benchmark bars for reconcile", { benchmark: benchmarkTicker, count: benchBars.length, days });
    }
    if (benchBars.length < 2) {
      signalsDebug("reconcile aborted: benchmark history too short", {
        benchmark: benchmarkTicker,
        barCount: benchBars.length,
      });
      break;
    }

    const n = await backfillOneHolding(db, userId, h, benchBars, benchmarkTicker, days, singleDayOpts);
    rowsBackfilled += n;
    if (n > 0) backfilledTickers.push(h.ticker);
    signalsDebug("backfillOneHolding result", { ticker: h.ticker, benchmark: benchmarkTicker, rowsWritten: n });
  }

  signalsDebug("reconcileAlphaHistoryForUser end", {
    rowsBackfilled,
    backfilledTickers,
    linkedTickers: linkedTickers.length,
  });

  return { linkedTickers, backfilledTickers, rowsBackfilled };
}
