/**
 * Koyomi: 銘柄ごとに **quoteSummary を 1 回**だけ取り、リサーチ + 四半期 Rule of 40 をまとめて算出。
 * 四半期 PL/CF が空の場合は `fundamentalsTimeSeries`（quarterly）にフォールバック（yahoo-finance2 推奨）。
 * Route Handler / Server のみから import。
 */

import YahooFinance from "yahoo-finance2";

import {
  computeFundamentalMuscleDeltaStatus,
  computeQuarterlyMuscleScoreFromAdjacent,
  computeQuarterlyRuleOf40FromAdjacent,
  computeRuleOf40DeltaStatus,
  type FundamentalMuscleDeltaStatus,
  type RuleOf40DeltaStatus,
} from "@/src/lib/alpha-logic";
import {
  equityResearchSnapshotFromQuoteSummary,
  regularMarketChangePercentFromQuoteSummary,
  toYahooFinanceSymbol,
  type EquityResearchSnapshot,
} from "@/src/lib/price-service";

const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
});

/**
 * リサーチ用のみ（`equityResearchSnapshotFromQuoteSummary` と同じ）。
 * 四半期 PL/CF は Nov 2024 以降ほぼ空のため `quoteSummary` には載せず、
 * `fundamentalsTimeSeries` を並列取得する。
 */
const KOYOMI_QUOTE_SUMMARY_MODULES = [
  "calendarEvents",
  "summaryDetail",
  "defaultKeyStatistics",
  "financialData",
  "earningsTrend",
  /** セッション騰落率（Mispriced 用） */
  "price",
  /** 可能なら 1 リクエストで四半期 PL/CF を得て TS 呼び出しを減らす */
  "incomeStatementHistoryQuarterly",
  "cashflowStatementHistory",
  "cashflowStatementHistoryQuarterly",
] as const;

/** 次回決算の有無だけ見る軽量プローブ（重い TS / 全モジュールの前に使用） */
const KOYOMI_CALENDAR_PROBE_MODULES = ["calendarEvents"] as const;

const TS_QUARTERLY_PERIOD1 = "2020-01-01";

/** デイリー・スナップショット: 同一暦日内の再取得はプロセス内メモリで抑止（24h） */
const KOYOMI_YAHOO_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

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

function rowDateMsTs(row: unknown): number | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  if (r.date instanceof Date && !Number.isNaN(r.date.getTime())) return r.date.getTime();
  return dateKeyMs(r.date ?? r.endDate);
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

type MergedQuarter = {
  dateMs: number;
  totalRevenue: number | null;
  freeCashFlow: number | null;
  operatingIncome: number | null;
};

function finitePosRev(r: MergedQuarter): number | null {
  const v = r.totalRevenue;
  if (v == null || !Number.isFinite(v) || v <= 0) return null;
  return v;
}

function incomeStatementHistoryQuarterlyRows(qs: Record<string, unknown>): unknown {
  const mod = qs["incomeStatementHistoryQuarterly"];
  if (!mod || typeof mod !== "object") return null;
  return (mod as Record<string, unknown>)["incomeStatementHistory"];
}

function cashflowStatementHistoryQuarterlyRows(qs: Record<string, unknown>): unknown {
  const mod = qs["cashflowStatementHistoryQuarterly"];
  if (!mod || typeof mod !== "object") return null;
  return (mod as Record<string, unknown>)["cashflowStatements"];
}

function mergeQuarterlyRowsFromQuoteSummary(qs: Record<string, unknown>): MergedQuarter[] {
  const map = new Map<number, MergedQuarter>();

  const ingest = (
    rows: unknown,
    field: "totalRevenue" | "freeCashFlow" | "operatingIncome",
    keyCandidates: string[],
  ) => {
    if (!Array.isArray(rows)) return;
    for (const raw of rows) {
      if (!raw || typeof raw !== "object") continue;
      const r = raw as Record<string, unknown>;
      const dk = dateKeyMs(r["endDate"] ?? r["date"]);
      if (dk == null) continue;
      const v = pickNum(r, keyCandidates);
      const cur = map.get(dk) ?? { dateMs: dk, totalRevenue: null, freeCashFlow: null, operatingIncome: null };
      if (Number.isFinite(v)) {
        if (field === "totalRevenue") cur.totalRevenue = v;
        if (field === "freeCashFlow") cur.freeCashFlow = v;
        if (field === "operatingIncome") cur.operatingIncome = v;
      }
      map.set(dk, cur);
    }
  };

  ingest(incomeStatementHistoryQuarterlyRows(qs), "totalRevenue", ["totalRevenue", "TotalRevenue"]);
  ingest(incomeStatementHistoryQuarterlyRows(qs), "operatingIncome", [
    "operatingIncome",
    "OperatingIncome",
    "ebit",
    "EBIT",
  ]);
  ingest(cashflowStatementHistoryQuarterlyRows(qs), "freeCashFlow", ["freeCashFlow", "FreeCashFlow"]);

  return [...map.values()].sort((a, b) => b.dateMs - a.dateMs);
}

/** fundamentalsTimeSeries（quarterly）の financials + cash-flow を日付でマージ */
function mergeQuarterlyRowsFromTimeSeries(financials: unknown[], cashFlows: unknown[]): MergedQuarter[] {
  const map = new Map<number, MergedQuarter>();

  for (const raw of financials) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const dk = rowDateMsTs(raw);
    if (dk == null) continue;
    const rev = pickNum(r, ["totalRevenue", "quarterlyTotalRevenue"]);
    const oi = pickNum(r, ["operatingIncome", "quarterlyOperatingIncome", "ebit", "EBIT"]);
    if (!Number.isFinite(rev) && !Number.isFinite(oi)) continue;
    const cur = map.get(dk) ?? { dateMs: dk, totalRevenue: null, freeCashFlow: null, operatingIncome: null };
    if (Number.isFinite(rev)) cur.totalRevenue = rev;
    if (Number.isFinite(oi)) cur.operatingIncome = oi;
    map.set(dk, cur);
  }

  for (const raw of cashFlows) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const dk = rowDateMsTs(raw);
    if (dk == null) continue;
    let v = pickNum(r, ["freeCashFlow", "quarterlyFreeCashFlow"]);
    if (!Number.isFinite(v)) {
      const ocf = pickNum(r, ["operatingCashFlow", "cashFlowFromContinuingOperatingActivities"]);
      const capex = pickNum(r, ["capitalExpenditure", "purchaseOfPPE"]);
      if (Number.isFinite(ocf) && Number.isFinite(capex)) v = ocf + capex;
    }
    if (!Number.isFinite(v)) continue;
    const cur = map.get(dk) ?? { dateMs: dk, totalRevenue: null, freeCashFlow: null, operatingIncome: null };
    cur.freeCashFlow = v;
    map.set(dk, cur);
  }

  return [...map.values()].sort((a, b) => b.dateMs - a.dateMs);
}

async function mergeQuarterlyFromFundamentalsTimeSeries(sym: string): Promise<MergedQuarter[]> {
  try {
    const [fin, cf] = await Promise.all([
      yahooFinance.fundamentalsTimeSeries(
        sym,
        { period1: TS_QUARTERLY_PERIOD1, type: "quarterly", module: "financials" },
        { validateResult: false },
      ),
      yahooFinance.fundamentalsTimeSeries(
        sym,
        { period1: TS_QUARTERLY_PERIOD1, type: "quarterly", module: "cash-flow" },
        { validateResult: false },
      ),
    ]);
    const finArr = Array.isArray(fin) ? (fin as unknown[]) : [];
    const cfArr = Array.isArray(cf) ? (cf as unknown[]) : [];
    return mergeQuarterlyRowsFromTimeSeries(finArr as unknown[], cfArr as unknown[]);
  } catch {
    return [];
  }
}

export type KoyomiTickerQuarterlyR40 = {
  ruleOf40Current: number | null;
  ruleOf40Prior: number | null;
  ruleOf40Delta: number | null;
  ruleOf40DeltaStatus: RuleOf40DeltaStatus;
};

/**
 * 直近2四半期の Rule of 40（売上成長% + FCF マージン%）: `alpha-logic` の
 * `computeQuarterlyRuleOf40FromAdjacent` および `computeRuleOf40DeltaStatus`。
 * 業界用語の「Rule of 55」は本プロダクトでは**別指標未実装**（55 専用ロジックは置かない）。
 */
function computeTwoQuarterRuleOf40(sortedNewestFirst: MergedQuarter[]): {
  current: number | null;
  prior: number | null;
} {
  const chain = sortedNewestFirst.filter((r) => finitePosRev(r) != null);
  if (chain.length < 3) return { current: null, prior: null };

  const q0 = chain[0]!;
  const q1 = chain[1]!;
  const q2 = chain[2]!;
  const r0 = finitePosRev(q0)!;
  const r1 = finitePosRev(q1)!;
  const r2 = finitePosRev(q2)!;
  const f0 = q0.freeCashFlow;
  const f1 = q1.freeCashFlow;
  if (f0 == null || !Number.isFinite(f0) || f1 == null || !Number.isFinite(f1)) {
    return { current: null, prior: null };
  }

  const current = computeQuarterlyRuleOf40FromAdjacent(r0, r1, f0);
  const prior = computeQuarterlyRuleOf40FromAdjacent(r1, r2, f1);
  return { current, prior };
}

function rule40FromMerged(merged: MergedQuarter[]): KoyomiTickerQuarterlyR40 {
  const { current, prior } = computeTwoQuarterRuleOf40(merged);
  const { delta, status } = computeRuleOf40DeltaStatus(prior, current);
  return {
    ruleOf40Current: current,
    ruleOf40Prior: prior,
    ruleOf40Delta: delta,
    ruleOf40DeltaStatus: status,
  };
}

function hasAtLeastThreeRevenueQuarters(merged: MergedQuarter[]): boolean {
  return merged.filter((r) => finitePosRev(r) != null).length >= 3;
}

function computeTwoQuarterMuscle(sortedNewestFirst: MergedQuarter[]): {
  current: number | null;
  prior: number | null;
} {
  const chain = sortedNewestFirst.filter((r) => finitePosRev(r) != null);
  if (chain.length < 3) return { current: null, prior: null };

  const q0 = chain[0]!;
  const q1 = chain[1]!;
  const q2 = chain[2]!;
  const r0 = finitePosRev(q0)!;
  const r1 = finitePosRev(q1)!;
  const r2 = finitePosRev(q2)!;
  const current = computeQuarterlyMuscleScoreFromAdjacent(r0, r1, q0.operatingIncome);
  const prior = computeQuarterlyMuscleScoreFromAdjacent(r1, r2, q1.operatingIncome);
  return { current, prior };
}

export type KoyomiTickerMuscle = {
  muscleCurrent: number | null;
  musclePrior: number | null;
  muscleDelta: number | null;
  muscleDeltaStatus: FundamentalMuscleDeltaStatus;
};

function muscleFromMerged(merged: MergedQuarter[]): KoyomiTickerMuscle {
  const { current, prior } = computeTwoQuarterMuscle(merged);
  const { delta, status } = computeFundamentalMuscleDeltaStatus(prior, current);
  return {
    muscleCurrent: current,
    musclePrior: prior,
    muscleDelta: delta,
    muscleDeltaStatus: status,
  };
}

export type KoyomiResearchAndRule40 = {
  research: EquityResearchSnapshot;
  rule40: KoyomiTickerQuarterlyR40;
  muscle: KoyomiTickerMuscle;
  /** 当日（セッション基準）の株価変化率（%）。`price` モジュール */
  regularMarketChangePercent: number | null;
};

const koyomiYahooCache = new Map<string, { expiresAt: number; payload: KoyomiResearchAndRule40 }>();
const calendarProbeCache = new Map<string, { expiresAt: number; nextYmd: string | null }>();

function cacheKeyForKoyomi(tickerUpper: string, providerSymbol: string | null | undefined): string {
  const p = providerSymbol != null && String(providerSymbol).trim().length > 0 ? String(providerSymbol).trim() : "";
  return `${tickerUpper}::${p}`;
}

function nextEarningsYmdFromCalendarProbe(qs: unknown, tickerUpper: string): string | null {
  const snap = equityResearchSnapshotFromQuoteSummary(qs, tickerUpper);
  const s = snap.nextEarningsDate != null ? snap.nextEarningsDate.trim().slice(0, 10) : "";
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

async function fetchOneCalendarProbe(
  input: {
    ticker: string;
    providerSymbol?: string | null;
  },
  opts?: { bypassCache?: boolean },
): Promise<{ upper: string; nextYmd: string | null } | null> {
  const bypassCache = opts?.bypassCache === true;
  const ticker = input.ticker.trim();
  if (ticker.length === 0) return null;
  const sym = toYahooFinanceSymbol(ticker, input.providerSymbol ?? null);
  if (!sym) return null;
  const upper = ticker.toUpperCase();
  const ck = `cal:${cacheKeyForKoyomi(upper, input.providerSymbol ?? null)}`;
  if (!bypassCache) {
    const hit = calendarProbeCache.get(ck);
    if (hit != null && hit.expiresAt > Date.now()) {
      return { upper, nextYmd: hit.nextYmd };
    }
  }
  try {
    const qs = await yahooFinance.quoteSummary(sym, {
      modules: [...KOYOMI_CALENDAR_PROBE_MODULES],
    });
    const nextYmd = nextEarningsYmdFromCalendarProbe(qs, upper);
    calendarProbeCache.set(ck, { expiresAt: Date.now() + KOYOMI_YAHOO_CACHE_TTL_MS, nextYmd });
    return { upper, nextYmd };
  } catch {
    calendarProbeCache.set(ck, { expiresAt: Date.now() + KOYOMI_YAHOO_CACHE_TTL_MS, nextYmd: null });
    return { upper, nextYmd: null };
  }
}

/**
 * 次回決算日（YYYY-MM-DD または null）だけを並列取得。フル `fetchKoyomiResearchAndRule40Map` より遥かに軽い。
 */
export async function fetchKoyomiCalendarProbeMap(
  inputs: { ticker: string; providerSymbol?: string | null }[],
  options?: { concurrency?: number; delayMs?: number; bypassCache?: boolean },
): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  const seen = new Set<string>();
  const deduped: { ticker: string; providerSymbol?: string | null }[] = [];
  for (const it of inputs) {
    const t = it.ticker.trim();
    if (t.length === 0) continue;
    const u = t.toUpperCase();
    if (seen.has(u)) continue;
    seen.add(u);
    deduped.push({ ticker: t, providerSymbol: it.providerSymbol ?? null });
  }

  const concurrency = Math.max(1, Math.min(18, Math.floor(options?.concurrency ?? 16)));
  const delayMs = Math.max(0, Math.floor(options?.delayMs ?? 0));
  const bypassCache = options?.bypassCache === true;

  let idx = 0;
  async function worker(): Promise<void> {
    for (;;) {
      const i = idx++;
      if (i >= deduped.length) return;
      const it = deduped[i]!;
      const row = await fetchOneCalendarProbe(it, { bypassCache });
      if (row != null) out.set(row.upper, row.nextYmd);
      if (delayMs > 0 && i + 1 < deduped.length) await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, deduped.length) }, () => worker()));
  return out;
}

async function fetchOneCombined(
  input: {
    ticker: string;
    providerSymbol?: string | null;
  },
  opts?: { bypassCache?: boolean },
): Promise<KoyomiResearchAndRule40 | null> {
  const bypassCache = opts?.bypassCache === true;
  const ticker = input.ticker.trim();
  if (ticker.length === 0) return null;
  const sym = toYahooFinanceSymbol(ticker, input.providerSymbol ?? null);
  if (!sym) return null;
  const upper = ticker.toUpperCase();
  const ck = cacheKeyForKoyomi(upper, input.providerSymbol ?? null);
  if (!bypassCache) {
    const hit = koyomiYahooCache.get(ck);
    if (hit != null && hit.expiresAt > Date.now()) {
      return hit.payload;
    }
  }
  try {
    const qs = await yahooFinance.quoteSummary(sym, {
      modules: [...KOYOMI_QUOTE_SUMMARY_MODULES],
    });
    const research = equityResearchSnapshotFromQuoteSummary(qs, upper);
    let merged = mergeQuarterlyRowsFromQuoteSummary(qs as unknown as Record<string, unknown>);
    const r40FromQs = rule40FromMerged(merged);
    const needTs = !hasAtLeastThreeRevenueQuarters(merged) || r40FromQs.ruleOf40Current == null;
    if (needTs) {
      const tsMerged = await mergeQuarterlyFromFundamentalsTimeSeries(sym);
      if (tsMerged.length >= 3) merged = tsMerged;
    }
    const r40 = rule40FromMerged(merged);
    const muscle = muscleFromMerged(merged);
    const regularMarketChangePercent = regularMarketChangePercentFromQuoteSummary(qs);

    const payload: KoyomiResearchAndRule40 = { research, rule40: r40, muscle, regularMarketChangePercent };
    koyomiYahooCache.set(ck, { expiresAt: Date.now() + KOYOMI_YAHOO_CACHE_TTL_MS, payload });
    return payload;
  } catch {
    return null;
  }
}

/**
 * テーマ暦用: 銘柄ごと **1 回の quoteSummary** でリサーチ + Rule of 40（必要時のみ TS 追加）。
 */
export async function fetchKoyomiResearchAndRule40Map(
  inputs: { ticker: string; providerSymbol?: string | null }[],
  options?: { concurrency?: number; delayMs?: number; bypassYahooCache?: boolean },
): Promise<Map<string, KoyomiResearchAndRule40>> {
  const out = new Map<string, KoyomiResearchAndRule40>();
  const seen = new Set<string>();
  const deduped: { ticker: string; providerSymbol?: string | null }[] = [];
  for (const it of inputs) {
    const t = it.ticker.trim();
    if (t.length === 0) continue;
    const u = t.toUpperCase();
    if (seen.has(u)) continue;
    seen.add(u);
    deduped.push({ ticker: t, providerSymbol: it.providerSymbol ?? null });
  }

  const concurrency = Math.max(1, Math.min(12, Math.floor(options?.concurrency ?? 10)));
  const delayMs = Math.max(0, Math.floor(options?.delayMs ?? 0));
  const bypassYahooCache = options?.bypassYahooCache === true;

  let idx = 0;
  async function worker(): Promise<void> {
    for (;;) {
      const i = idx++;
      if (i >= deduped.length) return;
      const it = deduped[i]!;
      const row = await fetchOneCombined(it, { bypassCache: bypassYahooCache });
      if (row != null) {
        out.set(row.research.ticker.toUpperCase(), row);
      }
      if (delayMs > 0 && i + 1 < deduped.length) await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, deduped.length) }, () => worker());
  await Promise.all(workers);
  return out;
}
