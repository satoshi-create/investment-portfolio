/**
 * 保有米国株の Efficiency 指標を Yahoo Finance の **fundamentalsTimeSeries**（年次）で取得し
 * `ticker_efficiency_metrics` に UPSERT。`quoteSummary` の財務諸表モジュールは使わない。
 *
 * - TS: `financials`（売上・純利）+ `cash-flow`（FCF）を同一ファイナンスの timestamp でマージ
 * - Quote: `defaultKeyStatistics` のみ（発行済株式数）。FMP キー不要
 *
 * Env:
 *   TURSO_DATABASE_URL, TURSO_AUTH_TOKEN
 *   NEXT_PUBLIC_DEFAULT_PROFILE_USER_ID
 *   YAHOO_FUNDAMENTALS_DELAY_MS — 銘柄あたりのベース待機（既定 750）※内部で TS 2 回 + quote で分割
 *   YAHOO_MAX_TICKERS — 既定 80
 *
 * Usage:
 *   npx tsx scripts/fetch-fundamental-metrics.ts [userId]
 */

import path from "node:path";

import dotenv from "dotenv";
import YahooFinance from "yahoo-finance2";

import { classifyTickerInstrument } from "@/src/lib/alpha-logic";
import { defaultProfileUserId } from "@/src/lib/authorize-signals";
import { getDb, isDbConfigured } from "@/src/lib/db";
import { toYahooFinanceSymbol } from "@/src/lib/price-service";

const SOURCE = "Yahoo_TS";

const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
});

/** Yahoo TS の過去十分な深さ（年次） */
const TS_PERIOD1 = "2005-01-01";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** `date` は Unix 秒またはミリ秒の数値が返ることが多い */
function dateKeyMs(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw < 1e12 ? raw * 1000 : raw;
  }
  if (typeof raw === "string") {
    const t = new Date(raw).getTime();
    return Number.isFinite(t) ? t : null;
  }
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw.getTime();
  return null;
}

function pickNum(row: Record<string, unknown>, keys: string[]): number {
  for (const k of keys) {
    if (!Object.prototype.hasOwnProperty.call(row, k)) continue;
    const v = row[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return Number.NaN;
}

type MergedAnnual = {
  dateMs: number;
  totalRevenue: number | null;
  freeCashFlow: number | null;
  netIncome: number | null;
};

/**
 * financials / cash-flow の各行を timestamp でマージ（同一決算期の売上と FCF を揃える）。
 */
function mergeAnnualRows(
  financials: unknown,
  cashFlow: unknown,
): MergedAnnual[] {
  const map = new Map<number, MergedAnnual>();

  const ingest = (rows: unknown, field: "totalRevenue" | "freeCashFlow" | "netIncome", keyCandidates: string[]) => {
    if (!Array.isArray(rows)) return;
    for (const raw of rows) {
      if (!raw || typeof raw !== "object") continue;
      const r = raw as Record<string, unknown>;
      const dk = dateKeyMs(r["date"]);
      if (dk == null) continue;
      const v = pickNum(r, keyCandidates);
      const cur = map.get(dk) ?? { dateMs: dk, totalRevenue: null, freeCashFlow: null, netIncome: null };
      if (Number.isFinite(v)) {
        if (field === "totalRevenue") cur.totalRevenue = v;
        if (field === "freeCashFlow") cur.freeCashFlow = v;
        if (field === "netIncome") cur.netIncome = v;
      }
      map.set(dk, cur);
    }
  };

  ingest(financials, "totalRevenue", ["totalRevenue", "TotalRevenue"]);
  ingest(financials, "netIncome", ["netIncome", "NetIncome"]);
  ingest(cashFlow, "freeCashFlow", ["freeCashFlow", "FreeCashFlow"]);

  return [...map.values()].sort((a, b) => b.dateMs - a.dateMs);
}

function finitePosRev(r: MergedAnnual): number | null {
  const v = r.totalRevenue;
  if (v == null || !Number.isFinite(v) || v <= 0) return null;
  return v;
}

function computeMetricsFromMerged(sortedDesc: MergedAnnual[]): {
  revenueGrowthPct: number;
  fcfMarginPct: number;
  ruleOf40: number;
  annualFcf: number | null;
} {
  const revChain = sortedDesc.filter((r) => finitePosRev(r) != null);
  let revenueGrowthPct = Number.NaN;
  if (revChain.length >= 2) {
    const r0 = finitePosRev(revChain[0]!);
    const r1 = finitePosRev(revChain[1]!);
    if (r0 != null && r1 != null && r1 !== 0) {
      revenueGrowthPct = ((r0 - r1) / r1) * 100;
    }
  }

  let fcfMarginPct = Number.NaN;
  let annualFcf: number | null = null;

  const both = sortedDesc.find((r) => {
    const rev = finitePosRev(r);
    const fcf = r.freeCashFlow;
    return rev != null && fcf != null && Number.isFinite(fcf);
  });

  if (both != null) {
    const rev = finitePosRev(both)!;
    const fcf = both.freeCashFlow!;
    annualFcf = fcf;
    fcfMarginPct = (fcf / rev) * 100;
  } else if (sortedDesc.length > 0) {
    /** FCF のみ後段で埋まるケース — 単体で annual_fcf のみ保存 */
    const fcfOnly = sortedDesc.map((r) => r.freeCashFlow).find((x) => x != null && Number.isFinite(x));
    if (fcfOnly != null && Number.isFinite(fcfOnly)) annualFcf = fcfOnly;
  }

  const ruleOf40 =
    Number.isFinite(revenueGrowthPct) && Number.isFinite(fcfMarginPct)
      ? revenueGrowthPct + fcfMarginPct
      : Number.NaN;

  return { revenueGrowthPct, fcfMarginPct, ruleOf40, annualFcf };
}

function sharesFromQuoteSummary(qs: unknown): number | null {
  if (!qs || typeof qs !== "object") return null;
  const dk = (qs as Record<string, unknown>)["defaultKeyStatistics"];
  if (!dk || typeof dk !== "object") return null;
  const d = dk as Record<string, unknown>;
  const raw =
    pickNum(d, ["sharesOutstanding"]) ||
    pickNum(d, ["impliedSharesOutstanding"]) ||
    pickNum(d, ["floatShares"]);
  if (!Number.isFinite(raw) || raw <= 0) return null;
  return raw;
}

async function main() {
  dotenv.config({ path: path.join(process.cwd(), ".env.local") });

  if (!isDbConfigured()) {
    throw new Error("Database not configured (set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN)");
  }

  const delayMs = Math.max(0, Number(process.env.YAHOO_FUNDAMENTALS_DELAY_MS ?? "750") || 750);
  const maxTickers = Math.max(1, Number(process.env.YAHOO_MAX_TICKERS ?? "80") || 80);

  const userIdArg = process.argv.slice(2).find((a) => !a.startsWith("--"));
  const userId = userIdArg && userIdArg.trim().length > 0 ? userIdArg.trim() : defaultProfileUserId();

  const db = getDb();
  const holdingsRs = await db.execute({
    sql: `SELECT ticker, provider_symbol FROM holdings WHERE user_id = ? AND quantity > 0 ORDER BY ticker`,
    args: [userId],
  });

  type YahooTargetRow = { ticker: string; yahooSym: string };
  const targets: YahooTargetRow[] = [];
  for (const r of holdingsRs.rows as { ticker?: unknown; provider_symbol?: unknown }[]) {
    const ticker = String(r.ticker ?? "").trim();
    if (ticker.length === 0) continue;
    if (classifyTickerInstrument(ticker) !== "US_EQUITY") continue;
    const ps = r.provider_symbol != null && String(r.provider_symbol).length > 0 ? String(r.provider_symbol) : null;
    const yahooSym = toYahooFinanceSymbol(ticker, ps);
    if (yahooSym.trim().length === 0) continue;
    targets.push({ ticker: ticker.toUpperCase(), yahooSym });
  }

  const dedup = new Map<string, YahooTargetRow>();
  for (const t of targets) {
    if (!dedup.has(t.ticker)) dedup.set(t.ticker, t);
  }
  const batch = [...dedup.values()].slice(0, maxTickers);

  const pause = async (factor = 1) => {
    const ms = Math.round(delayMs * factor);
    if (ms > 0) await sleep(ms);
  };

  console.log(
    `Yahoo fundamentals (TimeSeries): user=${userId} usHoldings=${targets.length} batch=${batch.length} baseDelayMs=${delayMs} | annual financials + cash-flow → merge; quote defaultKeyStatistics only | source=${SOURCE}`,
  );

  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < batch.length; i++) {
    const { ticker, yahooSym } = batch[i]!;
    try {
      const tsOpts = {
        period1: TS_PERIOD1,
        type: "annual" as const,
      };

      const finRows = await yahooFinance.fundamentalsTimeSeries(yahooSym, {
        ...tsOpts,
        module: "financials",
      });
      await pause(0.5);

      const cfRows = await yahooFinance.fundamentalsTimeSeries(yahooSym, {
        ...tsOpts,
        module: "cash-flow",
      });
      await pause(0.5);

      const merged = mergeAnnualRows(finRows, cfRows);

      if (merged.length === 0) {
        console.warn(`[warn] ${ticker} (${yahooSym}): fundamentalsTimeSeries returned no annual rows`);
      }

      const { revenueGrowthPct, fcfMarginPct, ruleOf40, annualFcf } = computeMetricsFromMerged(merged);

      const qs = await yahooFinance.quoteSummary(yahooSym, {
        modules: ["defaultKeyStatistics"],
      });
      await pause(1);

      const sharesOut = sharesFromQuoteSummary(qs);

      const isoNow = new Date().toISOString();

      await db.execute({
        sql: `INSERT INTO ticker_efficiency_metrics
                (ticker, revenue_growth, fcf_margin, annual_fcf, shares_outstanding, rule_of_40,
                 source, last_updated_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
              ON CONFLICT(ticker) DO UPDATE SET
                revenue_growth = COALESCE(excluded.revenue_growth, ticker_efficiency_metrics.revenue_growth),
                fcf_margin = COALESCE(excluded.fcf_margin, ticker_efficiency_metrics.fcf_margin),
                annual_fcf = COALESCE(excluded.annual_fcf, ticker_efficiency_metrics.annual_fcf),
                shares_outstanding = COALESCE(excluded.shares_outstanding, ticker_efficiency_metrics.shares_outstanding),
                rule_of_40 = COALESCE(excluded.rule_of_40, ticker_efficiency_metrics.rule_of_40),
                source = COALESCE(excluded.source, ticker_efficiency_metrics.source),
                last_updated_at = COALESCE(excluded.last_updated_at, ticker_efficiency_metrics.last_updated_at),
                updated_at = datetime('now')`,
        args: [
          ticker,
          Number.isFinite(revenueGrowthPct) ? revenueGrowthPct : null,
          Number.isFinite(fcfMarginPct) ? fcfMarginPct : null,
          annualFcf != null && Number.isFinite(annualFcf) ? annualFcf : null,
          sharesOut,
          Number.isFinite(ruleOf40) ? ruleOf40 : null,
          SOURCE,
          isoNow,
        ],
      });

      const hasAny =
        Number.isFinite(revenueGrowthPct) ||
        Number.isFinite(fcfMarginPct) ||
        (annualFcf != null && Number.isFinite(annualFcf)) ||
        (sharesOut != null && sharesOut > 0);

      if (hasAny) {
        ok += 1;
        const bits: string[] = [];
        if (Number.isFinite(revenueGrowthPct)) bits.push(`revYoY=${revenueGrowthPct.toFixed(2)}%`);
        if (Number.isFinite(fcfMarginPct)) bits.push(`fcfM=${fcfMarginPct.toFixed(2)}%`);
        if (Number.isFinite(ruleOf40)) bits.push(`R40=${ruleOf40.toFixed(2)}`);
        console.log(`[ok] ${ticker} (${yahooSym}): ${bits.join(", ") || "partial"} | periods=${merged.length}`);
      } else {
        skipped += 1;
        console.warn(`[warn] ${ticker} (${yahooSym}): no metrics (merged periods=${merged.length})`);
      }
    } catch (e) {
      failed += 1;
      console.warn(`[skip] ${ticker}: ${e instanceof Error ? e.message : String(e)}`);
    }

    if (i < batch.length - 1 && delayMs > 0) await pause(1);
  }

  console.log(`Done. source=${SOURCE} upsert_attempts=${batch.length} ok_metrics=${ok} empty_parse=${skipped} failed=${failed}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
