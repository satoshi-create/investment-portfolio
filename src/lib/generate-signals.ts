import type { Client } from "@libsql/client";

import {
  reconcileAlphaHistoryForUser,
  type ReconcileAlphaHistoryResult,
} from "@/src/lib/alpha-history-reconcile";
import {
  computeAlphaDeviationZScore,
  defaultBenchmarkTickerForTicker,
  roundAlphaMetric,
  SIGNAL_BENCHMARK_TICKER,
} from "@/src/lib/alpha-logic";
import {
  SIGNAL_SIGMA_PHASE_TRANSITION,
  SIGNAL_SIGMA_STRUCTURAL_STRAIN,
} from "@/src/lib/signal-constants";
import { getDb } from "@/src/lib/db";
import { fetchHoldingsWithProviderForUser } from "@/src/lib/holdings-queries";
import type { HoldingPriceInput } from "@/src/lib/price-service";
import { signalsDebug } from "@/src/lib/signals-debug";
import type { Holding } from "@/src/types/investment";

export { SIGNAL_BENCHMARK_TICKER } from "@/src/lib/alpha-logic";
export { fetchHoldingsWithProviderForUser } from "@/src/lib/holdings-queries";

/** Bridge DB holdings → `fetchLatestAlphaSnapshotsForHoldings` / `fetchLatestAlphaSnapshot`. */
export function holdingsToPriceInputs(holdings: Holding[]): HoldingPriceInput[] {
  return holdings.map((h) => ({
    holdingId: h.id,
    ticker: h.ticker,
    providerSymbol: h.providerSymbol,
  }));
}

export type GenerateSignalsDetail = { holdingId: string; type: "BUY" | "WARN" | "BREAK" | "CRITICAL" };

/** Enough trailing days for ~30-σ daily alpha Z vs prior window (see `computeAlphaDeviationZScore`). */
const ALPHA_HISTORY_TAIL_LIMIT = 35;

/** 累積 Alpha（日次の合計）が過去ピークから落ちた幅がこのポイント以上なら BREAK（トレイリング） */
const ALPHA_CUMULATIVE_TRAIL_DROP_PP = 5;

export type GenerateSignalsResult = {
  inserted: number;
  details: GenerateSignalsDetail[];
  reconcile: ReconcileAlphaHistoryResult;
};

function todayUtcYmd(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function disciplinePnlPercentFromClose(avg: number | null | undefined, close: number | null): number | null {
  if (avg == null || !Number.isFinite(avg) || avg <= 0 || close == null || !Number.isFinite(close) || close <= 0) {
    return null;
  }
  return roundAlphaMetric((close / avg - 1) * 100);
}

/** 日次 Alpha の累積系列のピークからの下落（パーセントポイント）が `dropPp` 以上 */
function cumulativeAlphaTrailDroppedFromPeak(dailyAlphas: number[], dropPp: number): boolean {
  if (dailyAlphas.length === 0 || !Number.isFinite(dropPp) || dropPp <= 0) return false;
  let cum = 0;
  let peak = -Infinity;
  for (const a of dailyAlphas) {
    if (!Number.isFinite(a)) continue;
    cum += a;
    peak = Math.max(peak, cum);
  }
  return Number.isFinite(peak) && peak - cum >= dropPp;
}

async function tryInsertDisciplineSignals(
  db: Client,
  holdingId: string,
  h: Holding,
  alphas: number[],
  chronological: Record<string, unknown>[],
  alphaDateYmd: string,
  runDateYmd: string,
): Promise<{ inserted: number; details: GenerateSignalsDetail[] }> {
  const out: GenerateSignalsDetail[] = [];
  let n = 0;
  if (!h.exitRuleEnabled) return { inserted: 0, details: out };

  const lastRow = chronological.length > 0 ? chronological[chronological.length - 1]! : null;
  const rawClose = lastRow ? lastRow["close_price"] : undefined;
  const lastClose =
    rawClose != null && Number.isFinite(Number(rawClose)) && Number(rawClose) > 0 ? Number(rawClose) : null;
  const pnlPct = disciplinePnlPercentFromClose(h.avgAcquisitionPrice ?? null, lastClose);
  const alphaAt = roundAlphaMetric(alphas[alphas.length - 1]!);

  const stopLine = h.stopLossPct != null && h.stopLossPct > 0 ? -h.stopLossPct : null;
  if (pnlPct != null && stopLine != null && pnlPct <= stopLine) {
    const exists = await signalExistsForAlphaDay(db, holdingId, "CRITICAL", alphaDateYmd);
    if (!exists) {
      await insertSignal(db, holdingId, "CRITICAL", alphaAt, alphaDateYmd);
      n += 1;
      out.push({ holdingId, type: "CRITICAL" });
      signalsDebug("inserted CRITICAL (discipline stop-loss)", { ticker: h.ticker, pnlPct, stopLine });
    }
  }

  const target = h.targetProfitPct != null && h.targetProfitPct > 0 ? h.targetProfitPct : null;
  if (pnlPct != null && target != null && pnlPct >= target) {
    const exists = await signalExistsForAlphaDay(db, holdingId, "BUY", alphaDateYmd);
    if (!exists) {
      await insertSignal(db, holdingId, "BUY", alphaAt, alphaDateYmd);
      n += 1;
      out.push({ holdingId, type: "BUY" });
      signalsDebug("inserted BUY (discipline take-profit)", { ticker: h.ticker, pnlPct, target });
    }
  }

  if (cumulativeAlphaTrailDroppedFromPeak(alphas, ALPHA_CUMULATIVE_TRAIL_DROP_PP)) {
    const exists = await signalExistsForAlphaDay(db, holdingId, "BREAK", alphaDateYmd);
    if (!exists) {
      await insertSignal(db, holdingId, "BREAK", alphaAt, alphaDateYmd);
      n += 1;
      out.push({ holdingId, type: "BREAK" });
      signalsDebug("inserted BREAK (alpha cumulative trailing stop)", { ticker: h.ticker });
    }
  }

  const dl = h.tradeDeadline != null && h.tradeDeadline.length >= 10 ? h.tradeDeadline.slice(0, 10) : null;
  if (dl != null && runDateYmd > dl) {
    const exists = await signalExistsForAlphaDay(db, holdingId, "WARN", alphaDateYmd);
    if (!exists) {
      await insertSignal(db, holdingId, "WARN", alphaAt, alphaDateYmd);
      n += 1;
      out.push({ holdingId, type: "WARN" });
      signalsDebug("inserted WARN (trade deadline passed)", { ticker: h.ticker, tradeDeadline: dl, runDateYmd });
    }
  }

  return { inserted: n, details: out };
}

async function signalExistsForAlphaDay(
  db: Client,
  holdingId: string,
  signalType: "BUY" | "WARN" | "BREAK" | "CRITICAL",
  alphaDayYmd: string,
): Promise<boolean> {
  const rs = await db.execute({
    sql: `SELECT 1 AS ok FROM signals
          WHERE holding_id = ? AND signal_type = ?
            AND alpha_day = ?
          LIMIT 1`,
    args: [holdingId, signalType, alphaDayYmd],
  });
  return rs.rows.length > 0;
}

async function insertSignal(
  db: Client,
  holdingId: string,
  signalType: "BUY" | "WARN" | "BREAK" | "CRITICAL",
  alphaAtSignal: number,
  alphaDayYmd: string,
): Promise<void> {
  const id = crypto.randomUUID();
  // `detected_at` should represent the time the generation ran (not the alpha_history day).
  const detectedAtIso = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO signals (id, holding_id, signal_type, alpha_at_signal, is_resolved, detected_at, alpha_day)
          VALUES (?, ?, ?, ?, 0, ?, ?)`,
    args: [id, holdingId, signalType, alphaAtSignal, detectedAtIso, alphaDayYmd],
  });
}

/**
 * Scans holdings for `userId`, reads trailing alpha_history (benchmark-relative) per holding,
 * inserts BUY / WARN / BREAK / CRITICAL rows into `signals` with same-day dedupe per type.
 */
export async function generateSignalsForUser(
  userId: string,
  db: Client = getDb(),
): Promise<GenerateSignalsResult> {
  const runDateYmd = todayUtcYmd();
  signalsDebug("generateSignalsForUser start", {
    userId,
    benchmark: SIGNAL_BENCHMARK_TICKER,
    runDateYmd,
  });

  const reconcile = await reconcileAlphaHistoryForUser(userId, db);

  signalsDebug("reconcileAlphaHistoryForUser done", {
    rowsBackfilled: reconcile.rowsBackfilled,
    backfilledTickers: reconcile.backfilledTickers,
    linkedCount: reconcile.linkedTickers.length,
  });

  const holdings = await fetchHoldingsWithProviderForUser(db, userId);

  signalsDebug("holdings loaded", {
    count: holdings.length,
    tickers: holdings.map((x) => x.ticker),
  });

  const details: GenerateSignalsDetail[] = [];
  let inserted = 0;

  for (const h of holdings) {
    const holdingId = h.id;
    const benchmarkTicker = defaultBenchmarkTickerForTicker(h.ticker);
    const alphaRs = await db.execute({
      sql: `SELECT recorded_at, alpha_value, close_price FROM alpha_history
            WHERE user_id = ? AND ticker = ? AND benchmark_ticker = ?
            ORDER BY recorded_at DESC
            LIMIT ?`,
      args: [userId, h.ticker, benchmarkTicker, ALPHA_HISTORY_TAIL_LIMIT],
    });

    if (alphaRs.rows.length === 0) {
      signalsDebug("skip holding: no alpha_history rows", {
        holdingId,
        ticker: h.ticker,
        userId,
        benchmark: benchmarkTicker,
      });
      continue;
    }

    const chronological = [...alphaRs.rows].reverse();
    const alphas = chronological.map((r) => Number(r.alpha_value));
    const latestRecordedAt = String(chronological[chronological.length - 1].recorded_at);
    const alphaDateYmd = latestRecordedAt.slice(0, 10);

    const points = chronological.map((r) => ({
      recorded_at: String(r.recorded_at),
      alpha_value: Number(r.alpha_value),
    }));
    signalsDebug("alpha tail (chronological)", { ticker: h.ticker, holdingId, alphaDateYmd, points });

    const dailyAlphaSigma = computeAlphaDeviationZScore(alphas);
    signalsDebug("structural σ (daily alpha Z)", {
      ticker: h.ticker,
      dailyAlphaSigma,
      strainBelow: SIGNAL_SIGMA_STRUCTURAL_STRAIN,
      transitionBelow: SIGNAL_SIGMA_PHASE_TRANSITION,
    });

    if (dailyAlphaSigma !== null && dailyAlphaSigma < SIGNAL_SIGMA_PHASE_TRANSITION) {
      const exists = await signalExistsForAlphaDay(db, holdingId, "CRITICAL", alphaDateYmd);
      if (exists) {
        signalsDebug("CRITICAL skipped: already exists for alpha day", { ticker: h.ticker, alphaDateYmd });
      } else {
        await insertSignal(
          db,
          holdingId,
          "CRITICAL",
          roundAlphaMetric(alphas[alphas.length - 1]!),
          alphaDateYmd,
        );
        inserted += 1;
        details.push({ holdingId, type: "CRITICAL" });
        signalsDebug("inserted CRITICAL (phase transition σ)", { ticker: h.ticker, runDateYmd, alphaDateYmd });
      }
    } else if (dailyAlphaSigma !== null && dailyAlphaSigma < SIGNAL_SIGMA_STRUCTURAL_STRAIN) {
      const exists = await signalExistsForAlphaDay(db, holdingId, "BREAK", alphaDateYmd);
      if (exists) {
        signalsDebug("BREAK skipped: already exists for alpha day", { ticker: h.ticker, alphaDateYmd });
      } else {
        await insertSignal(
          db,
          holdingId,
          "BREAK",
          roundAlphaMetric(alphas[alphas.length - 1]!),
          alphaDateYmd,
        );
        inserted += 1;
        details.push({ holdingId, type: "BREAK" });
        signalsDebug("inserted BREAK (structural strain σ)", { ticker: h.ticker, runDateYmd, alphaDateYmd });
      }
    }

    if (alphas.length >= 3) {
      const last3 = alphas.slice(-3);
      const warnRule = last3.every((a) => a < 0);
      signalsDebug("WARN rule", {
        ticker: h.ticker,
        last3,
        warnRule,
        note: "requires all three strictly < 0",
      });
      if (warnRule) {
        const exists = await signalExistsForAlphaDay(db, holdingId, "WARN", alphaDateYmd);
        if (exists) {
          signalsDebug("WARN skipped: already exists for alpha day", { ticker: h.ticker, alphaDateYmd });
        } else {
          await insertSignal(
            db,
            holdingId,
            "WARN",
            roundAlphaMetric(alphas[alphas.length - 1]!),
            alphaDateYmd,
          );
          inserted += 1;
          details.push({ holdingId, type: "WARN" });
          signalsDebug("inserted WARN", { ticker: h.ticker, runDateYmd, alphaDateYmd });
        }
      }
    } else {
      signalsDebug("WARN not evaluated: fewer than 3 alpha points", {
        ticker: h.ticker,
        n: alphas.length,
      });
    }

    if (alphas.length >= 2) {
      const prev = alphas[alphas.length - 2]!;
      const cur = alphas[alphas.length - 1]!;
      const buyRule = prev < 0 && cur > 0;
      signalsDebug("BUY rule", {
        ticker: h.ticker,
        prev,
        cur,
        buyRule,
        note: "prev day alpha < 0 and latest > 0",
      });
      if (buyRule) {
        const exists = await signalExistsForAlphaDay(db, holdingId, "BUY", alphaDateYmd);
        if (exists) {
          signalsDebug("BUY skipped: already exists for alpha day", { ticker: h.ticker, alphaDateYmd });
        } else {
          await insertSignal(db, holdingId, "BUY", roundAlphaMetric(cur), alphaDateYmd);
          inserted += 1;
          details.push({ holdingId, type: "BUY" });
          signalsDebug("inserted BUY", { ticker: h.ticker, runDateYmd, alphaDateYmd });
        }
      }
    } else {
      signalsDebug("BUY not evaluated: fewer than 2 alpha points", { ticker: h.ticker, n: alphas.length });
    }

    const discipline = await tryInsertDisciplineSignals(db, holdingId, h, alphas, chronological, alphaDateYmd, runDateYmd);
    inserted += discipline.inserted;
    details.push(...discipline.details);
  }

  signalsDebug("generateSignalsForUser end", { inserted, details });

  return { inserted, details, reconcile };
}
