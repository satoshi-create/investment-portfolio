/**
 * Yahoo Finance integration — use only from Server Actions, Route Handlers, or scripts.
 * (Do not import from Client Components: exposes server-side usage and API load.)
 *
 * For `USD_JPY_RATE_FALLBACK` (client-safe), use `@/src/lib/fx-constants`.
 */
import YahooFinance from "yahoo-finance2";

import {
  classifyTickerInstrument,
  computeAlphaPercent,
  dailyReturnPercent,
  defaultBenchmarkTickerForTicker,
  imputeSpikeChronologicalDailyAlphaNumbers,
  imputeSpikeDatedAlphaRows,
  roundAlphaMetric,
  spikeImputeOptionsForStockAndBenchmark,
  SIGNAL_BENCHMARK_TICKER,
  utcTodayYmd,
  type DatedAlphaRow,
} from "@/src/lib/alpha-logic";
import { MARKET_GLANCE_MACRO_DEFS } from "@/src/lib/market-glance-macros";
import type { MarketIndicator, YahooBuybackPosture } from "@/src/types/investment";

/** Yahoo アンケートの初回表示を抑止。先物など quote スキーマ不一致は `fetchLiveQuoteSnapshot` で validateResult: false を使用。 */
const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
});

export type PriceBar = { date: string; close: number };

export async function fetchCompanyNameForTicker(
  ticker: string,
  providerSymbol?: string | null,
): Promise<string | null> {
  const t = ticker.trim();
  if (t.length === 0) return null;
  const sym = toYahooFinanceSymbol(t, providerSymbol ?? null);
  if (!sym) return null;
  try {
    const qs = await yahooFinance.quoteSummary(sym, { modules: ["price"] });
    type YahooPriceModule = { shortName?: unknown; longName?: unknown };
    type YahooQuoteSummaryPriceShape = { price?: YahooPriceModule };
    const p = (qs as unknown as YahooQuoteSummaryPriceShape).price ?? null;
    const shortName = typeof p?.shortName === "string" ? p.shortName.trim() : "";
    const longName = typeof p?.longName === "string" ? p.longName.trim() : "";
    const name = shortName || longName;
    return name.length > 0 ? name : null;
  } catch {
    return null;
  }
}

export type EquityResearchSnapshot = {
  ticker: string;
  /** YYYY-MM-DD */
  nextEarningsDate: string | null;
  /** Ex-dividend date (権利落ち日), YYYY-MM-DD */
  exDividendDate: string | null;
  /** Record date (権利確定日), YYYY-MM-DD */
  recordDate: string | null;
  /** Annual dividend per share/unit (local currency). */
  annualDividendRate: number | null;
  /** Dividend yield percent (e.g. 2.15). */
  dividendYieldPercent: number | null;
  /** Trailing P/E (TTM). */
  trailingPe: number | null;
  /** Forward P/E (next FY / forward estimate). */
  forwardPe: number | null;
  /** Price / book (Yahoo `defaultKeyStatistics.priceToBook`). */
  priceToBook: number | null;
  /** Trailing EPS (TTM). */
  trailingEps: number | null;
  /** Forward EPS (next FY / forward estimate). */
  forwardEps: number | null;
  /**
   * 予想EPS成長率（小数: 15% → 0.15）。`earningsTrend` / `financialData` 由来。
   * Yahoo の表記揺れ（% / 小数）を正規化済み。
   */
  expectedGrowth: number | null;
  /** Yahoo `defaultKeyStatistics.pegRatio`（自前計算のフォールバック用）。 */
  yahooPegRatio: number | null;
  /**
   * 直近4四半期の `repurchaseOfStock` 合算（絶対値）。四半期が空のときは年次 CF 最新1期にフォールバック。取得不能は null。
   */
  ttmRepurchaseOfStock: number | null;
  /**
   * `historical` 配当イベントから推定した「直近まで途切れない配当年数」（暦年ベースのヒューリスティック）。取得不能は null。
   */
  consecutiveDividendYears: number | null;
  /** `assetProfile.country`（例: United States）。 */
  yahooCountry: string | null;
  /**
   * 年次・四半期 CF の `repurchaseOfStock` から組み立てた自社株買いの複数期プロフィール。
   */
  yahooBuybackPosture: YahooBuybackPosture | null;
  /**
   * Yahoo `defaultKeyStatistics` の発行済（または近似）株数スナップ。リサーチ取得時点。
   * Efficiency の `shares_outstanding` と異なる場合あり。
   */
  yahooQuoteSharesOutstanding: number | null;
  /**
   * Yahoo `netSharePurchaseActivity.netInfoShares`（インサイダー取引の純株数・モジュールの period 内）。
   * 会社の自社株買い（CF の repurchase）とは別系列。ツールチップの補足のみ。
   */
  yahooInsiderNetPurchaseShares: number | null;
  /**
   * Yahoo `defaultKeyStatistics.heldPercentInstitutions`（小数 0.15 = 15%）。日本株などで欠損しやすい。取得不能は null。
   */
  institutionalOwnership: number | null;
};

function pickRecordDateFromQuoteSummary(qss: unknown): string | null {
  type YahooEarningsDateLike = { raw?: unknown; fmt?: unknown };
  type YahooQuoteSummaryShape = {
    calendarEvents?: {
      dividends?: {
        recordDate?: unknown;
        dividendDate?: unknown;
      };
    };
  };
  const s = qss as unknown as YahooQuoteSummaryShape;
  const raw =
    s.calendarEvents?.dividends?.recordDate ??
    s.calendarEvents?.dividends?.dividendDate ??
    null;
  if (raw == null) return null;
  if (typeof raw === "object" && raw != null) {
    const r = raw as YahooEarningsDateLike;
    return ymdFromYahooDateLike((r.raw ?? r.fmt ?? raw) as unknown);
  }
  return ymdFromYahooDateLike(raw);
}

/** Row ready for `alpha_history` / dashboard (daily alpha vs VOO, last shared session). */
export type LatestAlphaPriceRow = {
  holdingId: string;
  ticker: string;
  closePrice: number;
  recordedAt: string;
  alphaValue: number;
};

const CALENDAR_BUFFER_DAYS = 18;

function logSkip(context: string, detail: string, err?: unknown): void {
  const suffix = err !== undefined ? ` ${String(err instanceof Error ? err.message : err)}` : "";
  console.warn(`[price-service] skip ${context}: ${detail}${suffix}`);
}

function trimProvider(providerSymbol?: string | null): string | null {
  if (providerSymbol == null) return null;
  const t = providerSymbol.trim();
  return t.length > 0 ? t : null;
}

/**
 * Resolve Yahoo symbol: explicit `provider_symbol` wins; otherwise ticker-based rules (.T for JP digits, etc.).
 */
export function toYahooFinanceSymbol(ticker: string, providerSymbol?: string | null): string {
  const manual = trimProvider(providerSymbol);
  if (manual != null) return manual;
  const raw = ticker.trim();
  if (raw.length === 0) return raw;
  const kind = classifyTickerInstrument(raw);
  if (kind === "JP_INVESTMENT_TRUST" || kind === "JP_LISTED_EQUITY") {
    const base = raw.replace(/\.T$/i, "").trim();
    return `${base}.T`;
  }
  return raw.toUpperCase();
}

function autoYahooSymbolForFallbacks(ticker: string): string {
  return toYahooFinanceSymbol(ticker, null);
}

/**
 * 日次 Alpha 用: 米株等は未調整終値のまま、日本株・投信は分割調整後（adj 優先）に揃え分母と分子のベース。
 * （関数名に `use` 接頭辞を付けない — ESLint react-hooks/rules-of-hooks 回避）
 */
function tickerPrefersAdjustedClosesForAlpha(ticker: string): boolean {
  const k = classifyTickerInstrument(ticker.trim());
  return k === "JP_LISTED_EQUITY" || k === "JP_INVESTMENT_TRUST";
}

/** Alternate Yahoo symbols for JP codes when `.T` returns no series (extend as needed). */
function yahooSymbolFallbacks(primary: string, ticker: string): string[] {
  const raw = ticker.trim();
  const kind = classifyTickerInstrument(raw);
  if (kind !== "JP_INVESTMENT_TRUST" && kind !== "JP_LISTED_EQUITY") return [primary];
  const alts = [`${raw}.OK`, raw].filter((s) => s !== primary);
  return [primary, ...alts];
}

async function fetchChartClosesWithFallbacks(yahooSymbol: string, ticker: string, calendarDays: number): Promise<PriceBar[]> {
  let lastErr: unknown;
  for (const sym of yahooSymbolFallbacks(yahooSymbol, ticker)) {
    try {
      const bars = await fetchChartCloses(sym, calendarDays);
      if (bars.length > 0) return bars;
    } catch (e) {
      lastErr = e;
    }
  }
  if (lastErr !== undefined) logSkip(yahooSymbol, "all Yahoo symbol attempts failed", lastErr);
  return [];
}

/**
 * Yahoo 日足（`return: "array"`）の調整後終値（なければ名目終値）を 1 本/日。分割スパイク向け outlier フィルタ付き。
 */
async function fetchChartArrayAdjustedCloses(yahooSymbol: string, calendarDays: number): Promise<PriceBar[]> {
  const days = Math.max(1, Math.floor(Number.isFinite(calendarDays) ? calendarDays : 1));
  const { period1, period2 } = periodRangeForCalendarDays(days);
  const result = (await yahooFinance.chart(
    yahooSymbol,
    {
      period1,
      period2,
      interval: "1d",
      return: "array",
    },
    { validateResult: false },
  )) as { quotes?: ChartArrayQuote[] };
  const daily = collectSortedDailyBarsFromChartQuotes(result.quotes ?? []);
  const out: PriceBar[] = [];
  for (const b of daily) {
    const p = effectiveSortedBarPrice(b);
    if (p == null) continue;
    out.push({ date: b.ymd, close: p });
  }
  return out;
}

async function fetchChartAdjustedClosesWithFallbacks(yahooSymbol: string, ticker: string, calendarDays: number): Promise<PriceBar[]> {
  let lastErr: unknown;
  for (const sym of yahooSymbolFallbacks(yahooSymbol, ticker)) {
    try {
      const bars = await fetchChartArrayAdjustedCloses(sym, calendarDays);
      if (bars.length > 0) return bars;
    } catch (e) {
      lastErr = e;
    }
  }
  for (const sym of yahooSymbolFallbacks(yahooSymbol, ticker)) {
    try {
      const bars = await fetchChartCloses(sym, calendarDays);
      if (bars.length > 0) return bars;
    } catch (e) {
      lastErr = e;
    }
  }
  if (lastErr !== undefined) logSkip(yahooSymbol, "all Yahoo adjusted+close symbol attempts failed", lastErr);
  return [];
}

/**
 * Load daily bars: uses explicit provider symbol only (no .T fallbacks), or auto-resolution + JP fallbacks.
 * `forAlpha` かつ日本向けのとき `adjclose` 系（outlier 除去後）を優先し、分割直後の偽リターンを抑える。
 */
async function fetchBarsForInstrument(
  ticker: string,
  providerSymbol: string | null | undefined,
  calendarDays: number,
  logContext: string,
  options?: { forAlpha?: boolean },
): Promise<PriceBar[]> {
  const forAlpha = options?.forAlpha === true;
  const useAdj = forAlpha && tickerPrefersAdjustedClosesForAlpha(ticker);
  const manual = trimProvider(providerSymbol);
  if (manual != null) {
    try {
      if (useAdj) {
        const adj = await fetchChartArrayAdjustedCloses(manual, calendarDays);
        if (adj.length > 0) return adj;
        const raw = await fetchChartCloses(manual, calendarDays);
        if (raw.length === 0) logSkip(logContext, `no daily bars (provider_symbol=${manual}, adj empty; close also empty)`);
        return raw;
      }
      const bars = await fetchChartCloses(manual, calendarDays);
      if (bars.length === 0) logSkip(logContext, `no daily bars (provider_symbol=${manual})`);
      return bars;
    } catch (e) {
      logSkip(logContext, `chart failed (provider_symbol=${manual})`, e);
      return [];
    }
  }

  const yahooSymbol = autoYahooSymbolForFallbacks(ticker);
  if (!yahooSymbol) {
    logSkip(logContext, "empty symbol");
    return [];
  }
  if (useAdj) {
    return fetchChartAdjustedClosesWithFallbacks(yahooSymbol, ticker, calendarDays);
  }
  return fetchChartClosesWithFallbacks(yahooSymbol, ticker, calendarDays);
}

function formatDateYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function periodRangeForCalendarDays(calendarDays: number): { period1: string; period2: string } {
  const safeDays = Math.max(1, Math.floor(Number.isFinite(calendarDays) ? calendarDays : 1));
  const period2 = new Date();
  const period1 = new Date(period2.getTime());
  const span = safeDays + CALENDAR_BUFFER_DAYS;
  period1.setUTCDate(period1.getUTCDate() - span);
  let p1 = period1.toISOString().slice(0, 10);
  const p2 = period2.toISOString().slice(0, 10);
  if (p1 >= p2) {
    period1.setUTCDate(period1.getUTCDate() - 1);
    p1 = period1.toISOString().slice(0, 10);
  }
  return { period1: p1, period2: p2 };
}

function chartBarDateYmd(q: { date: unknown }): string | null {
  const d = q.date instanceof Date ? q.date : new Date(String(q.date));
  if (Number.isNaN(d.getTime())) return null;
  return formatDateYmd(d);
}

function ymdFromYahooDateLike(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return formatDateYmd(v);
  if (typeof v === "number" && Number.isFinite(v)) {
    // Yahoo sometimes returns epoch seconds.
    const ms = v > 10_000_000_000 ? v : v * 1000;
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return null;
    return formatDateYmd(d);
  }
  const s = String(v).trim();
  if (s.length === 0) return null;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return formatDateYmd(d);
  // Already YYYY-MM-DD?
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

function parseDividendYieldPercent(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  // Yahoo summaryDetail.dividendYield is usually ratio (e.g. 0.0215).
  return n <= 1.5 ? Math.round(n * 10000) / 100 : Math.round(n * 100) / 100;
}

function parseFiniteNumberOrNull(raw: unknown): number | null {
  if (raw == null) return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** `quoteSummary` の数値 leaf（`{ raw, fmt }`・略号付き fmt）を有限 number に。 */
function finiteNumberFromYahooField(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const t = raw.trim().replace(/,/g, "");
    if (t.length === 0) return null;
    const plain = Number(t);
    if (Number.isFinite(plain)) return plain;
    const m = t.match(/^(-?(?:\d+\.?\d*|\.\d+))\s*([KkMmBbTt])$/);
    if (!m) return null;
    const base = Number(m[1]);
    if (!Number.isFinite(base)) return null;
    const suf = (m[2] ?? "").toUpperCase();
    const mult = suf === "K" ? 1e3 : suf === "M" ? 1e6 : suf === "B" ? 1e9 : suf === "T" ? 1e12 : 1;
    return base * mult;
  }
  if (typeof raw === "object" && raw !== null && "raw" in raw) {
    const o = raw as Record<string, unknown>;
    const inner = finiteNumberFromYahooField(o["raw"]);
    if (inner != null) return inner;
    if (typeof o["fmt"] === "string") return finiteNumberFromYahooField(o["fmt"]);
  }
  return null;
}

function yahooSharesOutstandingFromQuoteSummary(qs: unknown): number | null {
  const dks = (qs as { defaultKeyStatistics?: Record<string, unknown> }).defaultKeyStatistics;
  if (!dks || typeof dks !== "object") return null;
  for (const key of ["sharesOutstanding", "impliedSharesOutstanding", "floatShares"]) {
    const v = finiteNumberFromYahooField(dks[key]);
    if (v != null && v > 0) return v;
  }
  return null;
}

function yahooInsiderNetPurchaseSharesFromQuoteSummary(qs: unknown): number | null {
  const mod = (qs as { netSharePurchaseActivity?: Record<string, unknown> }).netSharePurchaseActivity;
  if (!mod || typeof mod !== "object") return null;
  return finiteNumberFromYahooField(mod["netInfoShares"]);
}

/**
 * `defaultKeyStatistics.heldPercentInstitutions` → 0–1 の有限小数。Yahoo によっては 0–100 で返る。
 * 0 は 0 として通す（UI は「隠密」と null を区別し得る）。欠損・非有限は null。
 */
function heldPercentInstitutionsFromQuoteSummary(qs: unknown): number | null {
  const dks = (qs as { defaultKeyStatistics?: Record<string, unknown> }).defaultKeyStatistics;
  if (dks == null || typeof dks !== "object") return null;
  const n = finiteNumberFromYahooField((dks as { heldPercentInstitutions?: unknown }).heldPercentInstitutions);
  if (n == null || !Number.isFinite(n)) return null;
  if (n < 0) return null;
  let d = n;
  if (d > 1.0001 && d <= 100) d = d / 100;
  if (d < 0 || d > 1) return null;
  return d;
}

/** Yahoo: 成長率が小数（0.15）またはパーセント（15）のどちらでも正規化して小数に。 */
function normalizeYahooEarningsGrowthDecimal(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : raw != null ? Number(raw) : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n > 1 && n <= 400) return n / 100;
  if (n > 0 && n <= 1) return n;
  return null;
}

type YahooEarningsTrendRow = {
  period?: string;
  growth?: unknown;
  earningsEstimate?: { growth?: unknown };
};

function growthFromEarningsTrendRow(row: YahooEarningsTrendRow | undefined): number | null {
  if (row == null) return null;
  const direct = normalizeYahooEarningsGrowthDecimal(row.growth);
  if (direct != null) return direct;
  return normalizeYahooEarningsGrowthDecimal(row.earningsEstimate?.growth);
}

function pickExpectedEarningsGrowthDecimalFromQuoteSummary(qs: {
  earningsTrend?: { trend?: YahooEarningsTrendRow[] };
  financialData?: { earningsGrowth?: unknown };
}): number | null {
  const trends = qs.earningsTrend?.trend;
  if (Array.isArray(trends) && trends.length > 0) {
    const matchPeriod = (re: RegExp) => {
      const row = trends.find((t) => re.test(String(t.period ?? "")));
      return growthFromEarningsTrendRow(row);
    };
    for (const re of [/\+5y/i, /5y/i, /\+1y/i, /1y/i, /^0y$/i]) {
      const g = matchPeriod(re);
      if (g != null) return g;
    }
    for (const t of trends) {
      const g = growthFromEarningsTrendRow(t);
      if (g != null) return g;
    }
  }
  return normalizeYahooEarningsGrowthDecimal(qs.financialData?.earningsGrowth);
}

function daysUntilYmd(ymd: string): number | null {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const diffMs = d.getTime() - todayUtc.getTime();
  return Math.round(diffMs / (24 * 60 * 60 * 1000));
}

type YahooEarningsDateLike = { raw?: unknown; fmt?: unknown };
type YahooQuoteSummaryResearchShape = {
  calendarEvents?: {
    earnings?: {
      earningsDate?: unknown;
    };
    dividends?: {
      recordDate?: unknown;
      dividendDate?: unknown;
    };
  };
  summaryDetail?: {
    dividendRate?: unknown;
    dividendYield?: unknown;
    trailingPE?: unknown;
    forwardPE?: unknown;
    exDividendDate?: unknown;
  };
  defaultKeyStatistics?: {
    trailingEps?: unknown;
    forwardEps?: unknown;
    pegRatio?: unknown;
    priceToBook?: unknown;
    /** 機関投資家保有率（0–1 または 0–100 表記。） */
    heldPercentInstitutions?: unknown;
  };
  financialData?: { earningsGrowth?: unknown };
  earningsTrend?: { trend?: YahooEarningsTrendRow[] };
  assetProfile?: { country?: string };
  cashflowStatementHistoryQuarterly?: { cashflowStatements?: Array<Record<string, unknown> & { endDate?: Date }> };
};

/**
 * 暦年ベース: 最も新しい配当年から連続して遡り、年1回以上の配当があった年数。
 */
export function consecutiveDividendYearsFromDividendRows(
  rows: { date: Date; dividends?: number }[],
): number | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const years = new Set<number>();
  for (const r of rows) {
    const d = r?.date;
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) continue;
    const amt = typeof r.dividends === "number" ? r.dividends : Number((r as { dividends?: unknown }).dividends);
    if (Number.isFinite(amt) && (amt as number) > 0) {
      years.add(d.getUTCFullYear());
    }
  }
  if (years.size === 0) return null;
  const sorted = [...years].sort((a, b) => b - a);
  const anchor = sorted[0]!;
  let streak = 0;
  for (let y = anchor; y >= anchor - 50; y--) {
    if (years.has(y)) streak += 1;
    else break;
  }
  return streak > 0 ? streak : null;
}

/** Yahoo CF 行の `repurchaseOfStock` を絶対値で取り出す（無・ゼロは null）。 */
function parseRepurchaseAbsFromCashflowRow(r: Record<string, unknown>): number | null {
  const raw = r["repurchaseOfStock"];
  const n =
    typeof raw === "number"
      ? raw
      : raw != null && typeof raw === "object" && "raw" in (raw as object)
        ? Number((raw as { raw?: unknown }).raw)
        : raw != null
          ? Number(raw)
          : NaN;
  if (!Number.isFinite(n) || n === 0) return null;
  return Math.abs(n);
}

/**
 * `quoteSummary` の CF 行は `endDate` が `Date` / ISO 文字列 / epoch 秒・ms のいずれかで返り得る。
 */
function coerceCashflowEndDateMs(raw: unknown): number | null {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw.getTime();
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const ms = Math.abs(raw) < 1e12 ? raw * 1000 : raw;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : ms;
  }
  if (typeof raw === "string" && raw.trim().length > 0) {
    const t = Date.parse(raw.trim());
    return Number.isFinite(t) ? t : null;
  }
  return null;
}

function coerceCashflowEndDate(raw: unknown): Date | null {
  const ms = coerceCashflowEndDateMs(raw);
  return ms == null ? null : new Date(ms);
}

function cashflowStatementsSortedByEndDesc(
  qs: unknown,
  key: "cashflowStatementHistoryQuarterly" | "cashflowStatementHistory",
): Array<Record<string, unknown> & { endDate?: Date }> {
  const stmts = (qs as Record<string, { cashflowStatements?: unknown[] } | undefined>)[key]?.cashflowStatements;
  if (!Array.isArray(stmts) || stmts.length === 0) return [];
  const withT = stmts
    .map((row) => {
      const r = row as Record<string, unknown> & { endDate?: Date };
      const t = coerceCashflowEndDateMs(r.endDate);
      return { t: t ?? NaN, r };
    })
    .filter((x) => Number.isFinite(x.t))
    .sort((a, b) => b.t - a.t)
    .map((x) => x.r as Record<string, unknown> & { endDate?: Date });
  return withT;
}

/**
 * 年次 CF が空のときに四半期から暦年へ寄せて自社株買いの「還元姿勢」系列を組み立てる。
 */
export function buildYahooBuybackPostureFromQuoteSummary(qs: unknown): YahooBuybackPosture | null {
  const quarterly = cashflowStatementsSortedByEndDesc(qs, "cashflowStatementHistoryQuarterly");
  const annual = cashflowStatementsSortedByEndDesc(qs, "cashflowStatementHistory");

  let fiscalRepurchasesAbs: { endDateYmd: string; amountAbs: number }[] = [];

  if (annual.length > 0) {
    fiscalRepurchasesAbs = annual
      .map((r) => {
        const end = coerceCashflowEndDate(r.endDate);
        const abs = parseRepurchaseAbsFromCashflowRow(r);
        if (end == null || abs == null) return null;
        return { endDateYmd: formatDateYmd(end), amountAbs: abs };
      })
      .filter((x): x is { endDateYmd: string; amountAbs: number } => x != null)
      .slice(0, 12);
  }

  if (fiscalRepurchasesAbs.length === 0 && quarterly.length > 0) {
    const byYear = new Map<number, { sum: number; lastEnd: Date }>();
    for (const r of quarterly) {
      const end = coerceCashflowEndDate(r.endDate);
      if (end == null) continue;
      const abs = parseRepurchaseAbsFromCashflowRow(r);
      if (abs == null) continue;
      const y = end.getUTCFullYear();
      const cur = byYear.get(y) ?? { sum: 0, lastEnd: end };
      cur.sum += abs;
      if (end.getTime() >= cur.lastEnd.getTime()) cur.lastEnd = end;
      byYear.set(y, cur);
    }
    const years = [...byYear.entries()].sort((a, b) => b[0] - a[0]).slice(0, 10);
    fiscalRepurchasesAbs = years.map(([, v]) => ({
      endDateYmd: formatDateYmd(v.lastEnd),
      amountAbs: v.sum,
    }));
  }

  const last4 = quarterly.slice(0, 4);
  let activeQuartersLast4 = 0;
  for (const r of last4) {
    if (parseRepurchaseAbsFromCashflowRow(r) != null) activeQuartersLast4 += 1;
  }

  const hasSignal = fiscalRepurchasesAbs.length > 0 || activeQuartersLast4 > 0;
  if (!hasSignal) return null;

  const byCalYear = new Map<number, number>();
  for (const p of fiscalRepurchasesAbs) {
    const y = Number(p.endDateYmd.slice(0, 4));
    if (!Number.isFinite(y)) continue;
    byCalYear.set(y, (byCalYear.get(y) ?? 0) + p.amountAbs);
  }
  const ys = [...byCalYear.entries()].sort((a, b) => b[0] - a[0]);
  const sum3yAbs = ys.length > 0 ? ys.slice(0, 3).reduce((s, [, v]) => s + v, 0) : null;
  const sum5yAbs = ys.length > 0 ? ys.slice(0, 5).reduce((s, [, v]) => s + v, 0) : null;

  return {
    fiscalRepurchasesAbs,
    sum3yAbs,
    sum5yAbs,
    activeQuartersLast4: quarterly.length > 0 ? activeQuartersLast4 : null,
  };
}

/**
 * `historical(..., dividends)` が取れないときの控えめなヒント（最低 1 年）。
 * `summaryDetail.trailingAnnualDividendRate` と `defaultKeyStatistics.lastDividend*` が揃い、最終配当が比較的新しいとき。
 */
export function consecutiveDividendYearsFromQuoteSummaryHint(qs: unknown): number | null {
  const sd = (qs as { summaryDetail?: Record<string, unknown> }).summaryDetail;
  const trail = sd?.trailingAnnualDividendRate != null ? Number(sd.trailingAnnualDividendRate) : NaN;
  if (!Number.isFinite(trail) || trail <= 0) return null;
  const dks = (qs as { defaultKeyStatistics?: Record<string, unknown> }).defaultKeyStatistics;
  const lastVal = dks?.lastDividendValue != null ? Number(dks.lastDividendValue) : NaN;
  if (!Number.isFinite(lastVal) || lastVal <= 0) return null;
  const ld = dks?.lastDividendDate;
  if (!(ld instanceof Date) || Number.isNaN(ld.getTime())) return null;
  const ageMs = Date.now() - ld.getTime();
  if (ageMs > 900 * 86_400_000) return null;
  return 1;
}

function ttmAbsRepurchaseFromCashflowQuarterly(qs: unknown): number | null {
  const stmts = (qs as { cashflowStatementHistoryQuarterly?: { cashflowStatements?: unknown[] } })
    .cashflowStatementHistoryQuarterly?.cashflowStatements;
  if (!Array.isArray(stmts) || stmts.length === 0) return null;
  const withDates = stmts
    .map((row) => {
      const r = row as Record<string, unknown> & { endDate?: Date };
      const t = coerceCashflowEndDateMs(r.endDate);
      const abs = parseRepurchaseAbsFromCashflowRow(r);
      return { t: t ?? NaN, abs };
    })
    .filter((x) => Number.isFinite(x.t))
    .sort((a, b) => b.t - a.t);
  const last4 = withDates.slice(0, 4);
  let sum = 0;
  let c = 0;
  for (const x of last4) {
    if (x.abs == null) continue;
    sum += x.abs;
    c += 1;
  }
  return c > 0 ? sum : null;
}

/** 年次 CF の最新1期の `repurchaseOfStock`（四半期が無い・空のときの 1 年相当フォールバック）。 */
function ttmAbsRepurchaseFromCashflowAnnualLatest(qs: unknown): number | null {
  const annual = cashflowStatementsSortedByEndDesc(qs, "cashflowStatementHistory");
  if (annual.length === 0) return null;
  return parseRepurchaseAbsFromCashflowRow(annual[0]! as Record<string, unknown>);
}

/**
 * 直近4四半期の repurchase 合算を優先し、ダメなときは年次 CF の直近1期の絶対値を採用。
 */
function ttmAbsRepurchaseFromQuoteSummaryCashflows(qs: unknown): number | null {
  const q = ttmAbsRepurchaseFromCashflowQuarterly(qs);
  if (q != null && Number.isFinite(q) && q > 0) return q;
  const a = ttmAbsRepurchaseFromCashflowAnnualLatest(qs);
  if (a != null && Number.isFinite(a) && a > 0) return a;
  return q ?? a;
}

function countCashflowStatementRows(
  qs: unknown,
  key: "cashflowStatementHistoryQuarterly" | "cashflowStatementHistory",
): number {
  const stmts = (qs as Record<string, { cashflowStatements?: unknown[] } | undefined>)[key]?.cashflowStatements;
  return Array.isArray(stmts) ? stmts.length : 0;
}

/** 自社株買いが空のとき、サーバーで原因切り分けしやすいよう1行ログ（成功レスポンス内の欠損向け）。 */
function logEquityResearchBuybackDiagnostics(
  yahooSymbol: string,
  qs: unknown,
  snapshot: EquityResearchSnapshot,
): void {
  const ttm = snapshot.ttmRepurchaseOfStock;
  const posture = snapshot.yahooBuybackPosture;
  const ttmOk = ttm != null && Number.isFinite(ttm) && ttm > 0;
  const postureOk =
    posture != null &&
    (posture.fiscalRepurchasesAbs.length > 0 ||
      (posture.sum3yAbs != null && posture.sum3yAbs > 0) ||
      (posture.sum5yAbs != null && posture.sum5yAbs > 0) ||
      (posture.activeQuartersLast4 != null && posture.activeQuartersLast4 > 0));
  if (ttmOk || postureOk) return;

  const nQ = countCashflowStatementRows(qs, "cashflowStatementHistoryQuarterly");
  const nA = countCashflowStatementRows(qs, "cashflowStatementHistory");
  const hasFin = (qs as { financialData?: unknown }).financialData != null;
  const hasNspa = (qs as { netSharePurchaseActivity?: unknown }).netSharePurchaseActivity != null;
  const qss = qs as { summaryDetail?: { dividendYield?: unknown } };
  console.log(
    `[price-service] equity-research gaps symbol=${yahooSymbol} ticker=${snapshot.ticker} ` +
      `ttmRepurchaseOfStock=${ttm === null ? "null" : String(ttm)} yahooBuybackPosture=null ` +
      `cashflowStatementHistoryQuarterly.rows=${nQ} cashflowStatementHistory.rows=${nA} financialData=${hasFin ? "yes" : "no"} ` +
      `netSharePurchaseActivity=${hasNspa ? "yes" : "no"} sharesOutstandingSnap=${snapshot.yahooQuoteSharesOutstanding === null ? "null" : "ok"} ` +
      `dividendYieldPercent=${snapshot.dividendYieldPercent === null ? "null" : String(snapshot.dividendYieldPercent)} ` +
      `rawDividendYield=${String(qss.summaryDetail?.dividendYield)} pegRatio=${snapshot.yahooPegRatio === null ? "null" : String(snapshot.yahooPegRatio)} ` +
      `expectedGrowth=${snapshot.expectedGrowth === null ? "null" : String(snapshot.expectedGrowth)}`,
  );
}

/**
 * `quoteSummary` の結果から Koyomi / リサーチ用スナップショットを組み立てる（サーバー専用）。
 * 四半期 PL/CF モジュールを同じレスポンスに含めてもよい。
 */
export function equityResearchSnapshotFromQuoteSummary(qs: unknown, tickerUpper: string): EquityResearchSnapshot {
  const qss = qs as YahooQuoteSummaryResearchShape;

  const earningsArr = qss.calendarEvents?.earnings?.earningsDate ?? null;
  const firstE =
    Array.isArray(earningsArr) && earningsArr.length > 0 ? earningsArr[0] : earningsArr ?? null;
  const nextEarningsDate =
    ymdFromYahooDateLike(
      (typeof firstE === "object" && firstE != null
        ? ((firstE as YahooEarningsDateLike).raw ?? (firstE as YahooEarningsDateLike).fmt ?? firstE)
        : firstE) as unknown,
    ) ?? null;

  const annualDividendRateRaw = qss.summaryDetail?.dividendRate;
  const annualDividendRate =
    typeof annualDividendRateRaw === "number" && Number.isFinite(annualDividendRateRaw) && annualDividendRateRaw > 0
      ? annualDividendRateRaw
      : null;

  const dividendYieldPercent = parseDividendYieldPercent(qss.summaryDetail?.dividendYield);
  const exDividendDate = ymdFromYahooDateLike(qss.summaryDetail?.exDividendDate as unknown) ?? null;
  const recordDate = pickRecordDateFromQuoteSummary(qss);

  const trailingPe0 = parseFiniteNumberOrNull(qss.summaryDetail?.trailingPE);
  const forwardPe0 = parseFiniteNumberOrNull(qss.summaryDetail?.forwardPE);
  const trailingEps0 = parseFiniteNumberOrNull(qss.defaultKeyStatistics?.trailingEps);
  const forwardEps0 = parseFiniteNumberOrNull(qss.defaultKeyStatistics?.forwardEps);
  const expectedGrowth = pickExpectedEarningsGrowthDecimalFromQuoteSummary(qss);
  const yahooPeg0 = parseFiniteNumberOrNull(qss.defaultKeyStatistics?.pegRatio);
  const yahooPegRatio = yahooPeg0 != null && yahooPeg0 > 0 ? yahooPeg0 : null;
  const priceToBookRaw = qss.defaultKeyStatistics?.priceToBook;
  const priceToBook0 = finiteNumberFromYahooField(priceToBookRaw);
  const priceToBook =
    priceToBook0 != null && Number.isFinite(priceToBook0) && priceToBook0 > 0 ? priceToBook0 : null;

  const ap = (qs as { assetProfile?: { country?: unknown } }).assetProfile;
  const cRaw = ap?.country;
  const yahooCountry =
    typeof cRaw === "string" && cRaw.trim().length > 0 ? cRaw.trim() : null;
  const ttmRepurchaseOfStock = ttmAbsRepurchaseFromQuoteSummaryCashflows(qs);
  const yahooBuybackPosture = buildYahooBuybackPostureFromQuoteSummary(qs);
  const yahooQuoteSharesOutstanding = yahooSharesOutstandingFromQuoteSummary(qs);
  const yahooInsiderNetPurchaseShares = yahooInsiderNetPurchaseSharesFromQuoteSummary(qs);
  const institutionalOwnership = heldPercentInstitutionsFromQuoteSummary(qs);

  return {
    ticker: tickerUpper,
    nextEarningsDate,
    exDividendDate,
    recordDate,
    annualDividendRate,
    dividendYieldPercent,
    trailingPe: trailingPe0 != null && trailingPe0 > 0 ? trailingPe0 : null,
    forwardPe: forwardPe0 != null && forwardPe0 > 0 ? forwardPe0 : null,
    priceToBook,
    trailingEps: trailingEps0,
    forwardEps: forwardEps0,
    expectedGrowth,
    yahooPegRatio,
    ttmRepurchaseOfStock,
    consecutiveDividendYears: null,
    yahooCountry,
    yahooBuybackPosture,
    yahooQuoteSharesOutstanding,
    yahooInsiderNetPurchaseShares,
    institutionalOwnership,
  } satisfies EquityResearchSnapshot;
}

/**
 * `quoteSummary` の `price` モジュールから、当日セッションの騰落率（%）を取り出す。
 * Yahoo の typicalValue 形式（`{ raw, fmt }`）に対応。
 */
export function regularMarketChangePercentFromQuoteSummary(qs: unknown): number | null {
  const p = (qs as { price?: Record<string, unknown> }).price;
  if (p == null || typeof p !== "object") return null;
  const v = p["regularMarketChangePercent"] as unknown;
  if (v == null) return null;
  if (typeof v === "object" && v !== null && "raw" in (v as object)) {
    const n = Number((v as { raw: unknown }).raw);
    if (Number.isFinite(n)) return roundAlphaMetric(n);
  }
  if (typeof v === "number" && Number.isFinite(v)) return roundAlphaMetric(v);
  return null;
}

/** `fetchEquityResearchSnapshots` が要求する `quoteSummary` モジュール（CF・financialData を含む）。 */
export const QUOTE_SUMMARY_EQUITY_RESEARCH_MODULES = [
  "calendarEvents",
  "summaryDetail",
  "defaultKeyStatistics",
  "financialData",
  "earningsTrend",
  "cashflowStatementHistory",
  "cashflowStatementHistoryQuarterly",
  "netSharePurchaseActivity",
  "assetProfile",
] as const;

/**
 * Yahoo から「次回決算日」「配当（年率/利回り）」を取得（軽量な quoteSummary）。
 * 失敗した銘柄は null（ログのみ）で継続。
 */
export async function fetchEquityResearchSnapshots(
  inputs: { ticker: string; providerSymbol?: string | null }[],
  options?: { concurrency?: number; batchDelayMs?: number },
): Promise<Map<string, EquityResearchSnapshot>> {
  const concurrency = Math.max(1, options?.concurrency ?? 3);
  const batchDelayMs = options?.batchDelayMs ?? 350;

  const settled = await runBatched(inputs, concurrency, batchDelayMs, async (it) => {
    const ticker = it.ticker.trim();
    if (ticker.length === 0) return null;
    const sym = toYahooFinanceSymbol(ticker, it.providerSymbol ?? null);
    if (!sym) return null;
    try {
      const qs = await yahooFinance.quoteSummary(sym, {
        modules: [...QUOTE_SUMMARY_EQUITY_RESEARCH_MODULES],
      });

      const base = equityResearchSnapshotFromQuoteSummary(qs, ticker.toUpperCase());
      logEquityResearchBuybackDiagnostics(sym, qs, base);
      let consecutiveDividendYears: number | null = null;
      try {
        const period2 = new Date();
        const period1 = new Date(period2);
        period1.setUTCFullYear(period1.getUTCFullYear() - 20);
        const divRows = await yahooFinance.historical(sym, {
          period1,
          period2,
          events: "dividends",
        });
        if (Array.isArray(divRows) && divRows.length > 0) {
          consecutiveDividendYears = consecutiveDividendYearsFromDividendRows(
            divRows as { date: Date; dividends: number }[],
          );
        }
      } catch {
        /* 配当系列は補助指標 */
      }
      const mergedYears =
        consecutiveDividendYears ?? consecutiveDividendYearsFromQuoteSummaryHint(qs);
      return { ...base, consecutiveDividendYears: mergedYears };
    } catch (e) {
      console.log(
        `[price-service] equity-research quoteSummary failed ticker=${ticker} symbol=${sym} detail=${e instanceof Error ? e.message : String(e)}`,
      );
      logSkip(sym, "quoteSummary failed (research snapshot)", e);
      return null;
    }
  });

  const out = new Map<string, EquityResearchSnapshot>();
  for (const r of settled) {
    if (r == null) continue;
    out.set(r.ticker, r);
  }
  return out;
}

/** Yahoo quoteSummary 由来の時価総額・初回取引日（上場日の近似）。 */
export type YahooInstrumentMetadata = {
  marketCap: number | null;
  /** YYYY-MM-DD（UTC 暦日） */
  listingDate: string | null;
  /**
   * 長期日足チャートの最古バーにおける調整後終値優先（なければ終値）。未取得は null。
   * `fetchYahooInstrumentMetadata` の `fetchListingPrice` が true のときのみ埋まる。
   */
  listingPrice: number | null;
};

/** `fetchYahooInstrumentMetadata` のオプション。 */
export type FetchYahooInstrumentMetadataOptions = {
  /**
   * true のときのみ `yahooFinance.chart`（1970-01-01 〜 現在）で最古日の終値を取得。
   * 未設定の `listing_price` 補完向け（毎回のチャート負荷を避ける）。
   */
  fetchListingPrice?: boolean;
};

const CHART_LISTING_PRICE_START = new Date(Date.UTC(1970, 0, 1));

function parseYahooMarketCapField(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
  if (typeof raw === "object" && raw !== null && "raw" in (raw as object)) {
    const n = Number((raw as { raw?: unknown }).raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

/**
 * 時価総額・上場日（初回取引日）を Yahoo から取得。失敗時は null 多めで返す。
 * Server Actions / Route / `dashboard-data` のみから呼ぶこと。
 */
export async function fetchYahooInstrumentMetadata(
  ticker: string,
  providerSymbol?: string | null,
  options?: FetchYahooInstrumentMetadataOptions,
): Promise<YahooInstrumentMetadata> {
  const t = ticker.trim();
  if (t.length === 0) return { marketCap: null, listingDate: null, listingPrice: null };
  const sym = toYahooFinanceSymbol(t, providerSymbol ?? null);
  if (!sym) return { marketCap: null, listingDate: null, listingPrice: null };

  let marketCap: number | null = null;
  let listingDate: string | null = null;
  let listingPrice: number | null = null;

  try {
    const qs = await yahooFinance.quoteSummary(sym, {
      modules: ["price", "defaultKeyStatistics", "summaryProfile"],
    });
    const q = qs as Record<string, unknown>;
    const priceMod = q.price as Record<string, unknown> | undefined;
    const dks = q.defaultKeyStatistics as Record<string, unknown> | undefined;
    const prof = q.summaryProfile as Record<string, unknown> | undefined;

    marketCap =
      parseYahooMarketCapField(priceMod?.marketCap) ??
      parseYahooMarketCapField(dks?.marketCap);

    const epochUtc = prof?.firstTradeDateEpochUtc ?? priceMod?.firstTradeDateMilliseconds;
    listingDate = ymdFromYahooDateLike(epochUtc);
    if (listingDate == null && priceMod?.firstTradeDateMilliseconds != null) {
      listingDate = ymdFromYahooDateLike(priceMod.firstTradeDateMilliseconds);
    }
  } catch (e) {
    logSkip(sym, "quoteSummary instrument metadata", e);
  }

  if (listingDate == null) {
    listingDate = await fetchEarliestChartTradeDateYmd(sym, t);
  }

  if (options?.fetchListingPrice === true) {
    listingPrice = await fetchOldestDailyListingPriceFromChart(sym, t);
  }

  return { marketCap, listingDate, listingPrice };
}

type ChartArrayQuote = {
  date?: unknown;
  close?: number | null;
  adjclose?: number | null;
};

function pickCloseOrAdjClose(q: ChartArrayQuote): number | null {
  const adj = q.adjclose != null ? Number(q.adjclose) : NaN;
  const cl = q.close != null ? Number(q.close) : NaN;
  if (Number.isFinite(adj) && adj > 0) return adj;
  if (Number.isFinite(cl) && cl > 0) return cl;
  return null;
}

/**
 * 1970-01-01 からの日足で最古の取引日の終値（adj 優先）。JP 銘柄は `.T` フォールバックを試行。
 */
async function fetchOldestDailyListingPriceFromChart(yahooSymbol: string, ticker: string): Promise<number | null> {
  let lastErr: unknown;
  for (const sym of yahooSymbolFallbacks(yahooSymbol, ticker)) {
    try {
      const result = (await yahooFinance.chart(
        sym,
        {
          period1: CHART_LISTING_PRICE_START,
          period2: new Date(),
          interval: "1d",
          return: "array",
        },
        { validateResult: false },
      )) as { quotes?: ChartArrayQuote[] };

      const quotes = result.quotes ?? [];
      let bestYmd: string | null = null;
      let bestPrice: number | null = null;
      for (const q of quotes) {
        const ymd = chartBarDateYmd(q as { date: unknown });
        if (ymd == null) continue;
        const price = pickCloseOrAdjClose(q as ChartArrayQuote);
        if (price == null) continue;
        if (bestYmd == null || ymd.localeCompare(bestYmd) < 0) {
          bestYmd = ymd;
          bestPrice = price;
        }
      }
      if (bestPrice != null) return bestPrice;
    } catch (e) {
      lastErr = e;
    }
  }
  if (lastErr !== undefined) logSkip(yahooSymbol, "oldest chart bar for listing price", lastErr);
  return null;
}

type SortedDailyBar = { ymd: string; adj: number | null; cl: number | null };

function effectiveSortedBarPrice(b: SortedDailyBar): number | null {
  if (b.adj != null && b.adj > 0) return b.adj;
  if (b.cl != null && b.cl > 0) return b.cl;
  return null;
}

/**
 * Yahoo 日足に混じる孤立スパイク（分割誤判定・壊れた1バー等）を除き、上場来%・区間損益の分母/分子を安定化する。
 * 隣接バーと整合しない**内点**を落とし、**先端**が隣の集団から外れすぎていれば1本削る。
 */
function filterSortedDailyBarChartOutliers(bars: SortedDailyBar[]): SortedDailyBar[] {
  if (bars.length < 3) return bars;
  const R = 5;

  function median3(a: number, b: number, c: number): number {
    const s = [a, b, c].sort((x, y) => x - y);
    return s[1]!;
  }

  let b = bars;
  for (let pass = 0; pass < 4; pass++) {
    const next: SortedDailyBar[] = [];
    for (let i = 0; i < b.length; i++) {
      const p = effectiveSortedBarPrice(b[i]!);
      if (p == null) continue;
      if (i > 0 && i < b.length - 1) {
        const pl = effectiveSortedBarPrice(b[i - 1]!);
        const pr = effectiveSortedBarPrice(b[i + 1]!);
        if (pl != null && pr != null && pl > 0 && pr > 0) {
          const nLo = pl < pr ? pl : pr;
          const nHi = pl > pr ? pl : pr;
          if (nLo > 0 && nHi / nLo < 2) {
            if (p / nLo > R || nHi / p > R) continue;
          }
        }
      }
      next.push(b[i]!);
    }
    if (next.length === b.length) break;
    b = next;
  }

  while (b.length >= 4) {
    const p0 = effectiveSortedBarPrice(b[0]!);
    const p1 = effectiveSortedBarPrice(b[1]!);
    const p2 = effectiveSortedBarPrice(b[2]!);
    const p3 = effectiveSortedBarPrice(b[3]!);
    if (p0 == null || p0 <= 0 || p1 == null || p2 == null || p3 == null) break;
    const m = median3(p1, p2, p3);
    if (m > 0 && (p0 / m > R || m / p0 > R)) b = b.slice(1);
    else break;
  }
  while (b.length >= 4) {
    const L = b.length - 1;
    const pL = effectiveSortedBarPrice(b[L]!);
    const pa = effectiveSortedBarPrice(b[L - 1]!);
    const pb = effectiveSortedBarPrice(b[L - 2]!);
    const pc = effectiveSortedBarPrice(b[L - 3]!);
    if (pL == null || pL <= 0 || pa == null || pb == null || pc == null) break;
    const m = median3(pa, pb, pc);
    if (m > 0 && (pL / m > R || m / pL > R)) b = b.slice(0, -1);
    else break;
  }
  return b;
}

function collectSortedDailyBarsFromChartQuotes(quotes: ChartArrayQuote[]): SortedDailyBar[] {
  const out: SortedDailyBar[] = [];
  for (const q of quotes) {
    const ymd = chartBarDateYmd(q as { date: unknown });
    if (ymd == null) continue;
    const adjRaw = q.adjclose != null ? Number(q.adjclose) : NaN;
    const clRaw = q.close != null ? Number(q.close) : NaN;
    const adj = Number.isFinite(adjRaw) && adjRaw > 0 ? adjRaw : null;
    const cl = Number.isFinite(clRaw) && clRaw > 0 ? clRaw : null;
    if (adj == null && cl == null) continue;
    out.push({ ymd, adj, cl });
  }
  out.sort((a, b) => a.ymd.localeCompare(b.ymd));
  return filterSortedDailyBarChartOutliers(out);
}

/**
 * 日足系列の **最古日と最新日** で、同一基準（両方 adj 可能なら adj、それ以外は両方 close）の
 * トータルリターン (%) = (末日 / 初日 − 1) × 100。分子・分母の混在を避ける。
 */
function totalReturnPercentFromSortedDailyBars(bars: SortedDailyBar[]): number | null {
  if (bars.length < 2) return null;
  const first = bars[0]!;
  const last = bars[bars.length - 1]!;
  if (first.adj != null && last.adj != null) {
    return roundAlphaMetric((last.adj / first.adj - 1) * 100);
  }
  if (first.cl != null && last.cl != null) {
    return roundAlphaMetric((last.cl / first.cl - 1) * 100);
  }
  return null;
}

/**
 * Yahoo 日足（1970-01-01 〜 現在）の **データ上の最初の取引日から最新バーまで** の変化率（%）。
 * 調整後終値が初日・末日ともにあればそれを使用し、なければ名目終値のみでペアを揃える。
 * 表示「上場来%」向け（IPO 初値とは限らない）。失敗時は null。
 */
export async function fetchChartTotalReturnPercentSinceFirstDailyBar(
  ticker: string,
  providerSymbol?: string | null,
): Promise<number | null> {
  const t = ticker.trim();
  if (t.length === 0) return null;
  const sym = toYahooFinanceSymbol(t, providerSymbol ?? null);
  if (!sym) return null;
  let lastErr: unknown;
  for (const cand of yahooSymbolFallbacks(sym, t)) {
    try {
      const result = (await yahooFinance.chart(
        cand,
        {
          period1: CHART_LISTING_PRICE_START,
          period2: new Date(),
          interval: "1d",
          return: "array",
        },
        { validateResult: false },
      )) as { quotes?: ChartArrayQuote[] };
      const bars = collectSortedDailyBarsFromChartQuotes(result.quotes ?? []);
      const pct = totalReturnPercentFromSortedDailyBars(bars);
      if (pct != null) return pct;
    } catch (e) {
      lastErr = e;
    }
  }
  if (lastErr !== undefined) logSkip(sym, "chart total return since first daily bar", lastErr);
  return null;
}

/**
 * イベント暦日（決算日など）**以降の最初の取引日**の終値から、**直近の日足**までの累積リターン（%）。
 * 調整後終値が初日・末日ともに取れるときは adj で揃える（`totalReturnPercentFromSortedDailyBars` と同じ）。
 */
export async function fetchChartCumulativeReturnPercentSinceEventYmd(
  ticker: string,
  providerSymbol: string | null | undefined,
  eventYmd: string,
): Promise<number | null> {
  const anchor = eventYmd.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchor)) return null;
  if (anchor > utcTodayYmd()) return null;

  const t = ticker.trim();
  if (t.length === 0) return null;

  const runChart = async (sym: string): Promise<number | null> => {
    const start = new Date(`${anchor}T12:00:00.000Z`);
    start.setUTCDate(start.getUTCDate() - 14);
    const period1 = formatDateYmd(start);
    const result = (await yahooFinance.chart(
      sym,
      {
        period1,
        period2: new Date(),
        interval: "1d",
        return: "array",
      },
      { validateResult: false },
    )) as { quotes?: ChartArrayQuote[] };
    const bars = collectSortedDailyBarsFromChartQuotes(result.quotes ?? []);
    const fromEvent = bars.filter((b) => b.ymd >= anchor);
    if (fromEvent.length < 2) return null;
    return totalReturnPercentFromSortedDailyBars(fromEvent);
  };

  const manual = trimProvider(providerSymbol);
  if (manual != null) {
    try {
      return await runChart(manual);
    } catch (e) {
      logSkip(manual, "chart cumulative since event ymd", e);
      return null;
    }
  }

  const sym = toYahooFinanceSymbol(t, null);
  if (!sym) return null;
  let lastErr: unknown;
  for (const cand of yahooSymbolFallbacks(sym, t)) {
    try {
      const pct = await runChart(cand);
      if (pct != null) return pct;
    } catch (e) {
      lastErr = e;
    }
  }
  if (lastErr !== undefined) logSkip(sym, "chart cumulative since event ymd", lastErr);
  return null;
}

/** 長期チャートの最古バー日付 ≒ 上場日以降の最初の取引日（フォールバック）。 */
async function fetchEarliestChartTradeDateYmd(yahooSymbol: string, ticker: string): Promise<string | null> {
  try {
    const bars = await fetchChartClosesWithFallbacks(yahooSymbol, ticker, 365 * 40);
    if (bars.length === 0) return null;
    let min = bars[0]!.date;
    for (const b of bars) {
      if (b.date.localeCompare(min) < 0) min = b.date;
    }
    return min.length >= 10 ? min.slice(0, 10) : null;
  } catch (e) {
    logSkip(yahooSymbol, "earliest chart bar for listing date", e);
    return null;
  }
}

async function fetchChartCloses(yahooSymbol: string, calendarDays: number): Promise<PriceBar[]> {
  const days = Math.max(1, Math.floor(Number.isFinite(calendarDays) ? calendarDays : 1));
  const { period1, period2 } = periodRangeForCalendarDays(days);
  const result = (await yahooFinance.chart(
    yahooSymbol,
    {
      period1,
      period2,
      interval: "1d",
    },
    { validateResult: false },
  )) as { quotes?: { close?: unknown; date?: unknown }[] };

  const quotes = result.quotes ?? [];
  const bars: PriceBar[] = [];
  for (const q of quotes) {
    const close = Number((q as { close?: unknown }).close);
    if (!Number.isFinite(close) || close <= 0) continue;
    const ymd = chartBarDateYmd(q as { date: unknown });
    if (ymd == null) continue;
    bars.push({ date: ymd, close });
  }
  bars.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return bars;
}

async function fetchBarsForBenchmark(
  benchmarkTicker: string,
  calendarDays: number,
  options?: { forAlpha?: boolean },
): Promise<PriceBar[]> {
  return fetchBarsForInstrument(benchmarkTicker, null, calendarDays, `bench=${benchmarkTicker}`, options);
}

/**
 * Latest completed daily bar (highest date with valid close). Network/errors → null (logged).
 */
export async function fetchLatestPrice(
  ticker: string,
  providerSymbol?: string | null,
): Promise<{ close: number; date: string } | null> {
  const manual = trimProvider(providerSymbol);
  const logLabel = manual ?? ticker;
  try {
    const bars = await fetchBarsForInstrument(ticker, providerSymbol, 45, logLabel);
    if (bars.length === 0) {
      logSkip(logLabel, "no daily bars for fetchLatestPrice");
      return null;
    }
    const last = bars[bars.length - 1]!;
    return { close: last.close, date: last.date };
  } catch (e) {
    logSkip(logLabel, "fetchLatestPrice failed", e);
    return null;
  }
}

/** USD/JPY (JPY=X) latest close. Returns null on failures. */
export async function fetchUsdJpyRate(): Promise<{ rate: number; date: string } | null> {
  const snap = await fetchLatestPrice("JPY=X", null);
  if (snap == null) return null;
  const r = Number(snap.close);
  if (!Number.isFinite(r) || r <= 0) return null;
  return { rate: r, date: snap.date };
}

/**
 * Latest close + prev close (shared sessions) for daily change %.
 * Returns null changePct if insufficient series.
 */
export async function fetchLatestPriceWithChangePct(
  ticker: string,
  providerSymbol?: string | null,
): Promise<{ close: number; date: string; changePct: number | null }> {
  const bars = await fetchPriceHistory(ticker, 3, providerSymbol);
  if (bars.length === 0) return { close: 0, date: "", changePct: null };
  const last = bars[bars.length - 1]!;
  const prev = bars.length >= 2 ? bars[bars.length - 2]! : null;
  const changePct =
    prev != null ? dailyReturnPercent(prev.close, last.close) : null;
  return {
    close: last.close,
    date: last.date,
    changePct: changePct != null && Number.isFinite(changePct) ? roundAlphaMetric(changePct) : null,
  };
}

/** Yahoo `quote` 由来のライブに近い価格（優先）＋ chart 日次（フォールバック）の合成結果。 */
export type HybridHoldingPriceSnapshot = {
  price: number;
  changePct: number | null;
  source: "live" | "close";
  /** ISO 8601 */
  asOf: string;
  /** 直前取引日終値（`regularMarketPreviousClose`）。 */
  previousClose: number | null;
  regularMarketVolume: number | null;
  /** 10 日平均出来高。Volume Ratio = regularMarketVolume / これ。 */
  averageDailyVolume10Day: number | null;
  /** 当日（セッション）出来高 / 10 日平均。算出不能時は null。 */
  volumeRatio: number | null;
};

function finitePositive(n: unknown): number | null {
  const x = Number(n);
  if (!Number.isFinite(x) || x <= 0) return null;
  return x;
}

function pctFromQuoteField(n: unknown): number | null {
  if (n == null) return null;
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return roundAlphaMetric(x);
}

/** Yahoo の *Time は秒またはミリ秒の UNIX。`Date` も可。 */
function quoteTimeToUnixMs(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === "object" && raw instanceof Date) {
    const t = raw.getTime();
    return Number.isFinite(t) && t > 0 ? t : null;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n < 1e12 ? n * 1000 : n;
}

/** Yahoo の *Time は秒またはミリ秒の UNIX。`Date` も可。 */
function quoteTimeToIso(raw: unknown): string | null {
  const ms = quoteTimeToUnixMs(raw);
  if (ms == null) return null;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

type QuoteSessionKind = "reg" | "post" | "pre";

/** 同一ミリ秒タイのとき本場を優先（取引所公式セッション寄り）。 */
function quoteSessionTieOrder(kind: QuoteSessionKind): number {
  return kind === "reg" ? 3 : kind === "pre" ? 2 : 1;
}

/**
 * `quote` から最も「今」に近い価格を選択。
 * - `regularMarketTime` / `postMarketTime` / `preMarketTime` が取れるときは **最新タイムスタンプ** を採用（Yahoo が `marketState: REGULAR` のまま Overnight を `postMarket*` に載せるケースに対応）。
 * - いずれの時刻も無いときは従来どおり `marketState` 分岐。
 */
export function pickLivePriceFromQuote(q: Record<string, unknown>): {
  price: number;
  changePct: number | null;
  asOf: string;
} | null {
  const state = String(q["marketState"] ?? "").toUpperCase();
  const prevClose = finitePositive(q["regularMarketPreviousClose"]);
  const reg = finitePositive(q["regularMarketPrice"]);
  const post = finitePositive(q["postMarketPrice"]);
  const pre = finitePositive(q["preMarketPrice"]);
  const nowIso = new Date().toISOString();

  const pctVsPrev = (price: number): number | null => {
    if (prevClose == null || prevClose <= 0) return null;
    return roundAlphaMetric(((price - prevClose) / prevClose) * 100);
  };

  type Cand = {
    kind: QuoteSessionKind;
    price: number;
    changePct: number | null;
    timeMs: number | null;
    asOf: string;
  };

  const cands: Cand[] = [];
  if (reg != null) {
    cands.push({
      kind: "reg",
      price: reg,
      changePct: pctFromQuoteField(q["regularMarketChangePercent"]) ?? pctVsPrev(reg),
      timeMs: quoteTimeToUnixMs(q["regularMarketTime"]),
      asOf: quoteTimeToIso(q["regularMarketTime"]) ?? nowIso,
    });
  }
  if (post != null) {
    cands.push({
      kind: "post",
      price: post,
      changePct: pctFromQuoteField(q["postMarketChangePercent"]) ?? pctVsPrev(post),
      timeMs: quoteTimeToUnixMs(q["postMarketTime"]),
      asOf: quoteTimeToIso(q["postMarketTime"]) ?? quoteTimeToIso(q["regularMarketTime"]) ?? nowIso,
    });
  }
  if (pre != null) {
    cands.push({
      kind: "pre",
      price: pre,
      changePct: pctFromQuoteField(q["preMarketChangePercent"]) ?? pctVsPrev(pre),
      timeMs: quoteTimeToUnixMs(q["preMarketTime"]),
      asOf: quoteTimeToIso(q["preMarketTime"]) ?? quoteTimeToIso(q["regularMarketTime"]) ?? nowIso,
    });
  }

  const timed = cands.filter((c) => c.timeMs != null) as (Cand & { timeMs: number })[];
  if (timed.length > 0) {
    timed.sort((a, b) => {
      if (b.timeMs !== a.timeMs) return b.timeMs - a.timeMs;
      return quoteSessionTieOrder(b.kind) - quoteSessionTieOrder(a.kind);
    });
    const best = timed[0]!;
    return { price: best.price, changePct: best.changePct, asOf: best.asOf };
  }

  if (state === "POST" || state === "POSTPOST") {
    if (post != null) {
      return {
        price: post,
        changePct: pctFromQuoteField(q["postMarketChangePercent"]) ?? pctVsPrev(post),
        asOf: quoteTimeToIso(q["postMarketTime"]) ?? quoteTimeToIso(q["regularMarketTime"]) ?? nowIso,
      };
    }
    if (reg != null) {
      return {
        price: reg,
        changePct: pctFromQuoteField(q["regularMarketChangePercent"]) ?? pctVsPrev(reg),
        asOf: quoteTimeToIso(q["regularMarketTime"]) ?? nowIso,
      };
    }
  }

  if (state === "PRE" || state === "PREPRE") {
    if (pre != null) {
      return {
        price: pre,
        changePct: pctFromQuoteField(q["preMarketChangePercent"]) ?? pctVsPrev(pre),
        asOf: quoteTimeToIso(q["preMarketTime"]) ?? nowIso,
      };
    }
    if (reg != null) {
      return {
        price: reg,
        changePct: pctFromQuoteField(q["regularMarketChangePercent"]) ?? pctVsPrev(reg),
        asOf: quoteTimeToIso(q["regularMarketTime"]) ?? nowIso,
      };
    }
  }

  if (state === "REGULAR" && reg != null) {
    return {
      price: reg,
      changePct: pctFromQuoteField(q["regularMarketChangePercent"]) ?? pctVsPrev(reg),
      asOf: quoteTimeToIso(q["regularMarketTime"]) ?? nowIso,
    };
  }

  if (state === "CLOSED") {
    if (post != null) {
      return {
        price: post,
        changePct: pctFromQuoteField(q["postMarketChangePercent"]) ?? pctVsPrev(post),
        asOf: quoteTimeToIso(q["postMarketTime"]) ?? quoteTimeToIso(q["regularMarketTime"]) ?? nowIso,
      };
    }
    if (reg != null) {
      return {
        price: reg,
        changePct: pctFromQuoteField(q["regularMarketChangePercent"]) ?? pctVsPrev(reg),
        asOf: quoteTimeToIso(q["regularMarketTime"]) ?? nowIso,
      };
    }
  }

  if (post != null) {
    return {
      price: post,
      changePct: pctFromQuoteField(q["postMarketChangePercent"]) ?? pctVsPrev(post),
      asOf: quoteTimeToIso(q["postMarketTime"]) ?? nowIso,
    };
  }
  if (reg != null) {
    return {
      price: reg,
      changePct: pctFromQuoteField(q["regularMarketChangePercent"]) ?? pctVsPrev(reg),
      asOf: quoteTimeToIso(q["regularMarketTime"]) ?? nowIso,
    };
  }
  if (pre != null) {
    return {
      price: pre,
      changePct: pctFromQuoteField(q["preMarketChangePercent"]) ?? pctVsPrev(pre),
      asOf: quoteTimeToIso(q["preMarketTime"]) ?? nowIso,
    };
  }
  return null;
}

function volumeRatioFromQuote(q: Record<string, unknown>): number | null {
  const rv = finitePositive(q["regularMarketVolume"]);
  const av = finitePositive(q["averageDailyVolume10Day"]);
  if (rv == null || av == null || av <= 0) return null;
  return roundAlphaMetric(rv / av);
}

export type LiveQuoteSnapshot = {
  price: number;
  changePct: number | null;
  asOf: string;
  previousClose: number | null;
  regularMarketVolume: number | null;
  averageDailyVolume10Day: number | null;
  volumeRatio: number | null;
};

/**
 * `yahooFinance.quote` でライブに近い最新値を取得（chart とは独立）。
 * 出来高は同一レスポンスから `regularMarketVolume` / `averageDailyVolume10Day` を採用。
 */
export async function fetchLiveQuoteSnapshot(
  ticker: string,
  providerSymbol?: string | null,
): Promise<LiveQuoteSnapshot | null> {
  const yahooSymbol = toYahooFinanceSymbol(ticker, providerSymbol);
  if (!yahooSymbol) return null;
  const logLabel = trimProvider(providerSymbol) ?? ticker;
  try {
    const q = (await yahooFinance.quote(
      yahooSymbol,
      {
        fields: [
          "symbol",
          "marketState",
          "regularMarketPrice",
          "regularMarketChangePercent",
          "regularMarketTime",
          "regularMarketPreviousClose",
          "regularMarketVolume",
          "averageDailyVolume10Day",
          "postMarketPrice",
          "postMarketChangePercent",
          "postMarketTime",
          "preMarketPrice",
          "preMarketChangePercent",
          "preMarketTime",
        ],
      },
      // FUTURE 等、Yahoo 応答が yahoo-finance2 の Quote スキーマと不一致になることがある（例: GC=F）
      { validateResult: false },
    )) as unknown as Record<string, unknown>;
    if (q == null || typeof q !== "object") return null;
    const picked = pickLivePriceFromQuote(q);
    if (picked == null) return null;
    return {
      ...picked,
      previousClose: finitePositive(q["regularMarketPreviousClose"]),
      regularMarketVolume: finitePositive(q["regularMarketVolume"]),
      averageDailyVolume10Day: finitePositive(q["averageDailyVolume10Day"]),
      volumeRatio: volumeRatioFromQuote(q),
    };
  } catch (e) {
    logSkip(logLabel, "fetchLiveQuoteSnapshot (quote) failed", e);
    return null;
  }
}

/**
 * ダッシュボード用: quote ライブ（最優先）→ 日足 chart 終値 → 呼び出し側で alpha 系列へフォールバック。
 */
export async function fetchHoldingsHybridPriceSnapshots(
  holdings: { ticker: string; providerSymbol?: string | null }[],
  options?: { concurrency?: number; batchDelayMs?: number },
): Promise<Map<string, HybridHoldingPriceSnapshot>> {
  const uniq = new Map<string, { ticker: string; providerSymbol: string | null }>();
  for (const h of holdings) {
    const k = holdingLivePriceKey(h.ticker, h.providerSymbol);
    if (!uniq.has(k)) {
      uniq.set(k, { ticker: h.ticker, providerSymbol: trimProvider(h.providerSymbol) });
    }
  }
  const entries = [...uniq.values()];
  const concurrency = Math.max(1, options?.concurrency ?? 3);
  const batchDelayMs = options?.batchDelayMs ?? 350;
  const results = await runBatched(entries, concurrency, batchDelayMs, async (it) => {
    const key = holdingLivePriceKey(it.ticker, it.providerSymbol);
    const live = await fetchLiveQuoteSnapshot(it.ticker, it.providerSymbol);
    if (live != null && Number.isFinite(live.price) && live.price > 0) {
      return {
        key,
        value: {
          price: live.price,
          changePct: live.changePct,
          source: "live" as const,
          asOf: live.asOf,
          previousClose: live.previousClose,
          regularMarketVolume: live.regularMarketVolume,
          averageDailyVolume10Day: live.averageDailyVolume10Day,
          volumeRatio: live.volumeRatio,
        } satisfies HybridHoldingPriceSnapshot,
      };
    }
    const snap = await fetchLatestPriceWithChangePct(it.ticker, it.providerSymbol);
    if (!Number.isFinite(snap.close) || snap.close <= 0 || snap.date.length < 10) {
      return { key, value: null as HybridHoldingPriceSnapshot | null };
    }
    return {
      key,
      value: {
        price: snap.close,
        changePct: snap.changePct,
        source: "close" as const,
        asOf: `${snap.date.slice(0, 10)}T00:00:00.000Z`,
        previousClose: null,
        regularMarketVolume: null,
        averageDailyVolume10Day: null,
        volumeRatio: null,
      } satisfies HybridHoldingPriceSnapshot,
    };
  });
  const out = new Map<string, HybridHoldingPriceSnapshot>();
  for (const r of results) {
    if (r.value != null) out.set(r.key, r.value);
  }
  return out;
}

/** Stable key for `fetchLatestHoldingsPriceSnapshots` map (ticker + optional Yahoo override). */
export function holdingLivePriceKey(ticker: string, providerSymbol?: string | null): string {
  const t = ticker.trim();
  const manual = trimProvider(providerSymbol);
  return `${t}\u0000${manual ?? ""}`;
}

/**
 * Per-holding latest daily close + prior-bar change % (same Yahoo path as `fetchLatestPriceWithChangePct`).
 * Use for dashboard so「現在価格」と「前日比」が同一データ源になる。
 */
export async function fetchLatestHoldingsPriceSnapshots(
  holdings: { ticker: string; providerSymbol?: string | null }[],
  options?: { concurrency?: number; batchDelayMs?: number },
): Promise<Map<string, { close: number; changePct: number | null }>> {
  const uniq = new Map<string, { ticker: string; providerSymbol: string | null }>();
  for (const h of holdings) {
    const k = holdingLivePriceKey(h.ticker, h.providerSymbol);
    if (!uniq.has(k)) {
      uniq.set(k, { ticker: h.ticker, providerSymbol: trimProvider(h.providerSymbol) });
    }
  }
  const entries = [...uniq.values()];
  const concurrency = Math.max(1, options?.concurrency ?? 3);
  const batchDelayMs = options?.batchDelayMs ?? 350;
  const results = await runBatched(entries, concurrency, batchDelayMs, async (it) => {
    const key = holdingLivePriceKey(it.ticker, it.providerSymbol);
    const snap = await fetchLatestPriceWithChangePct(it.ticker, it.providerSymbol);
    if (!Number.isFinite(snap.close) || snap.close <= 0) {
      return { key, value: null as { close: number; changePct: number | null } | null };
    }
    return { key, value: { close: snap.close, changePct: snap.changePct } };
  });
  const out = new Map<string, { close: number; changePct: number | null }>();
  for (const r of results) {
    if (r.value != null) out.set(r.key, r.value);
  }
  return out;
}

/**
 * Daily closes for backfill (~`days` trading sessions; uses extra calendar window).
 * `forAlpha: true` のとき日本株/投信/1306.T は調整後列を使い、かつ**系列単体では slice しない**（与ベンチの共有日付で caller がカットする）。
 */
export async function fetchPriceHistory(
  ticker: string,
  days: number,
  providerSymbol?: string | null,
  options?: { forAlpha?: boolean },
): Promise<PriceBar[]> {
  const manual = trimProvider(providerSymbol);
  const logLabel = manual ?? ticker;
  const safeDays = Math.max(1, Math.floor(Number.isFinite(days) ? days : 1));
  const calendarWindow = Math.max(30, Math.ceil(safeDays * 2));
  const forAlpha = options?.forAlpha === true;
  try {
    const bars = await fetchBarsForInstrument(ticker, providerSymbol, calendarWindow, logLabel, { forAlpha });
    if (bars.length === 0) return [];
    if (forAlpha) {
      return bars;
    }
    if (bars.length <= safeDays) return bars;
    return bars.slice(-safeDays);
  } catch (e) {
    logSkip(logLabel, "fetchPriceHistory failed", e);
    return [];
  }
}

function sharedSortedDatesForBenchmarkOverlap(stockBars: PriceBar[], benchBars: PriceBar[]): string[] {
  const benchSet = new Set(benchBars.map((b) => b.date));
  return [...new Set(stockBars.map((b) => b.date).filter((d) => benchSet.has(d)))].sort();
}

/**
 * Yahoo から日次 Alpha % 系列（株 − ベンチマーク）を構築。`alpha_history` が無いウォッチリスト銘柄用。
 */
export async function fetchRecentDailyAlphaSeriesVsBenchmark(
  ticker: string,
  calendarDays: number,
  benchmarkTicker: string,
  providerSymbol?: string | null,
): Promise<{ alphas: number[]; lastClose: number | null }> {
  const safeDays = Math.max(15, Math.min(120, Math.floor(Number.isFinite(calendarDays) ? calendarDays : 45)));
  const forAlpha =
    tickerPrefersAdjustedClosesForAlpha(ticker) || tickerPrefersAdjustedClosesForAlpha(benchmarkTicker);
  try {
    const [stockBars, benchBars] = await Promise.all([
      fetchPriceHistory(ticker, safeDays, providerSymbol, { forAlpha: true }),
      fetchPriceHistory(benchmarkTicker, safeDays, null, { forAlpha: true }),
    ]);
    if (stockBars.length < 2 || benchBars.length < 2) {
      const last = stockBars.length > 0 ? stockBars[stockBars.length - 1]!.close : null;
      return { alphas: [], lastClose: last };
    }
    const benchByDate = new Map(benchBars.map((b) => [b.date, b.close]));
    const stockBy = new Map(stockBars.map((b) => [b.date, b.close]));
    let shared = sharedSortedDatesForBenchmarkOverlap(stockBars, benchBars);
    if (shared.length < 2) {
      return { alphas: [], lastClose: stockBars[stockBars.length - 1]!.close };
    }
    if (shared.length > safeDays) {
      shared = shared.slice(-safeDays);
    }
    const rawAlphas: number[] = [];
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
      if (alpha === null) continue;
      rawAlphas.push(roundAlphaMetric(alpha));
    }
    const alphas = forAlpha
      ? imputeSpikeChronologicalDailyAlphaNumbers(
          rawAlphas,
          spikeImputeOptionsForStockAndBenchmark(ticker, benchmarkTicker),
        )
      : rawAlphas;
    const lastClose =
      stockBy.get(shared[shared.length - 1]!) ?? stockBars[stockBars.length - 1]!.close ?? null;
    return { alphas, lastClose };
  } catch (e) {
    logSkip(ticker, "fetchRecentDailyAlphaSeriesVsBenchmark failed", e);
    return { alphas: [], lastClose: null };
  }
}

/**
 * Yahoo から日次 Alpha（株 − ベンチマーク）を **観測日（各区間の終端日）付き**で返す。累積 Alpha の起点計算用。
 */
export async function fetchRecentDatedDailyAlphasVsBenchmark(
  ticker: string,
  calendarDays: number,
  benchmarkTicker: string,
  providerSymbol?: string | null,
): Promise<{ rows: DatedAlphaRow[]; lastClose: number | null }> {
  const safeDays = Math.max(15, Math.min(120, Math.floor(Number.isFinite(calendarDays) ? calendarDays : 45)));
  const forAlpha =
    tickerPrefersAdjustedClosesForAlpha(ticker) || tickerPrefersAdjustedClosesForAlpha(benchmarkTicker);
  try {
    const [stockBars, benchBars] = await Promise.all([
      fetchPriceHistory(ticker, safeDays, providerSymbol, { forAlpha: true }),
      fetchPriceHistory(benchmarkTicker, safeDays, null, { forAlpha: true }),
    ]);
    if (stockBars.length < 2 || benchBars.length < 2) {
      const last = stockBars.length > 0 ? stockBars[stockBars.length - 1]!.close : null;
      return { rows: [], lastClose: last };
    }
    const benchByDate = new Map(benchBars.map((b) => [b.date, b.close]));
    const stockBy = new Map(stockBars.map((b) => [b.date, b.close]));
    let shared = sharedSortedDatesForBenchmarkOverlap(stockBars, benchBars);
    if (shared.length < 2) {
      return { rows: [], lastClose: stockBars[stockBars.length - 1]!.close };
    }
    if (shared.length > safeDays) {
      shared = shared.slice(-safeDays);
    }
    const rowDraft: DatedAlphaRow[] = [];
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
      if (alpha === null) continue;
      rowDraft.push({ recordedAt: dCur, alphaValue: roundAlphaMetric(alpha) });
    }
    const rows = forAlpha
      ? imputeSpikeDatedAlphaRows(
          rowDraft,
          spikeImputeOptionsForStockAndBenchmark(ticker, benchmarkTicker),
        )
      : rowDraft;
    const lastClose =
      stockBy.get(shared[shared.length - 1]!) ?? stockBars[stockBars.length - 1]!.close ?? null;
    return { rows, lastClose };
  } catch (e) {
    logSkip(ticker, "fetchRecentDatedDailyAlphasVsBenchmark failed", e);
    return { rows: [], lastClose: null };
  }
}

// Legacy wrappers (keep stable call sites).
export async function fetchRecentDailyAlphaSeriesVsVoo(
  ticker: string,
  calendarDays: number,
  providerSymbol?: string | null,
): Promise<{ alphas: number[]; lastClose: number | null }> {
  return fetchRecentDailyAlphaSeriesVsBenchmark(ticker, calendarDays, SIGNAL_BENCHMARK_TICKER, providerSymbol);
}

export async function fetchRecentDatedDailyAlphasVsVoo(
  ticker: string,
  calendarDays: number,
  providerSymbol?: string | null,
): Promise<{ rows: DatedAlphaRow[]; lastClose: number | null }> {
  return fetchRecentDatedDailyAlphasVsBenchmark(ticker, calendarDays, SIGNAL_BENCHMARK_TICKER, providerSymbol);
}

function buildCloseByDate(bars: PriceBar[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const b of bars) m.set(b.date, b.close);
  return m;
}

/** Last two ascending dates present in both maps (shared sessions). */
function lastTwoSharedDates(stockDates: string[], benchDates: string[]): [string, string] | null {
  const benchSet = new Set(benchDates);
  const shared = stockDates.filter((d) => benchSet.has(d)).sort();
  if (shared.length < 2) return null;
  return [shared[shared.length - 2]!, shared[shared.length - 1]!];
}

/**
 * Latest daily alpha vs VOO using the last two calendar days that have **both** stock and benchmark closes.
 * Misaligned holidays (JP vs US) are handled by intersecting dates.
 */
export async function fetchLatestAlphaSnapshot(input: {
  holdingId: string;
  ticker: string;
  providerSymbol?: string | null;
  benchmarkTicker?: string;
}): Promise<LatestAlphaPriceRow | null> {
  const { holdingId, ticker } = input;
  const benchTicker = input.benchmarkTicker ?? defaultBenchmarkTickerForTicker(ticker);
  const manual = trimProvider(input.providerSymbol);
  const stockLog = manual ?? ticker;
  const forAlpha = tickerPrefersAdjustedClosesForAlpha(ticker) || tickerPrefersAdjustedClosesForAlpha(benchTicker);

  if (!ticker.trim() && manual == null) {
    logSkip(`holdingId=${holdingId}`, "empty ticker");
    return null;
  }

  const benchSym = toYahooFinanceSymbol(benchTicker, null);
  if (!benchSym) {
    logSkip(`holdingId=${holdingId}`, "empty benchmark symbol");
    return null;
  }

  try {
    const [stockBars, benchBars] = await Promise.all([
      fetchBarsForInstrument(ticker, input.providerSymbol, 90, `holding=${holdingId}`, { forAlpha }),
      fetchBarsForBenchmark(benchTicker, 90, { forAlpha }),
    ]);

    const stockDates = [...new Set(stockBars.map((b) => b.date))].sort();
    const benchDates = [...new Set(benchBars.map((b) => b.date))].sort();
    const pair = lastTwoSharedDates(stockDates, benchDates);
    if (!pair) {
      logSkip(stockLog, "fewer than 2 shared sessions with benchmark");
      return null;
    }

    const [dPrev, dCur] = pair;
    const stockBy = buildCloseByDate(stockBars);
    const benchBy = buildCloseByDate(benchBars);

    const s0 = stockBy.get(dPrev);
    const s1 = stockBy.get(dCur);
    const b0 = benchBy.get(dPrev);
    const b1 = benchBy.get(dCur);
    if (s0 == null || s1 == null || b0 == null || b1 == null) {
      logSkip(stockLog, "missing close on shared date");
      return null;
    }

    const rStock = dailyReturnPercent(s0, s1);
    const rBench = dailyReturnPercent(b0, b1);
    const alpha = computeAlphaPercent(rStock, rBench);
    if (alpha === null) {
      logSkip(stockLog, "alpha not computable (return null)");
      return null;
    }

    return {
      holdingId,
      ticker: ticker.trim(),
      closePrice: s1,
      recordedAt: dCur,
      alphaValue: alpha,
    };
  } catch (e) {
    logSkip(stockLog, "fetchLatestAlphaSnapshot failed", e);
    return null;
  }
}

async function runBatched<T, R>(
  items: T[],
  concurrency: number,
  delayBetweenBatchesMs: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const slice = items.slice(i, i + concurrency);
    out.push(...(await Promise.all(slice.map(fn))));
    if (i + concurrency < items.length && delayBetweenBatchesMs > 0) {
      await new Promise((r) => setTimeout(r, delayBetweenBatchesMs));
    }
  }
  return out;
}

export type HoldingPriceInput = {
  holdingId: string;
  ticker: string;
  providerSymbol?: string | null;
};

/**
 * Fetches latest alpha rows with bounded concurrency (default 2) and pause between batches to ease Yahoo load.
 */
export async function fetchLatestAlphaSnapshotsForHoldings(
  rows: HoldingPriceInput[],
  options?: { concurrency?: number; batchDelayMs?: number },
): Promise<LatestAlphaPriceRow[]> {
  const concurrency = Math.max(1, options?.concurrency ?? 2);
  const batchDelayMs = options?.batchDelayMs ?? 450;
  const results = await runBatched(rows, concurrency, batchDelayMs, (row) =>
    fetchLatestAlphaSnapshot({
      holdingId: row.holdingId,
      ticker: row.ticker,
      providerSymbol: row.providerSymbol,
    }),
  );
  return results.filter((r): r is LatestAlphaPriceRow => r != null);
}

/** Yahoo シンボル直近 2 営業日の終値と前日比 %（取得失敗時は null）。 */
async function fetchYahooCloseAndDayChangePct(yahooSymbol: string): Promise<{ close: number; changePct: number } | null> {
  try {
    const bars = await fetchChartCloses(yahooSymbol, 21);
    if (bars.length < 2) {
      logSkip(yahooSymbol, "fewer than 2 bars for day change");
      return null;
    }
    const prev = bars[bars.length - 2]!;
    const last = bars[bars.length - 1]!;
    const raw = dailyReturnPercent(prev.close, last.close);
    const changePct = raw != null && Number.isFinite(raw) ? roundAlphaMetric(raw) : 0;
    return { close: last.close, changePct };
  } catch (e) {
    logSkip(yahooSymbol, "fetchYahooCloseAndDayChangePct failed", e);
    return null;
  }
}

/**
 * 指数・FX・ETF など Yahoo シンボル 1 本について、quote ライブ優先 → 日足フォールバック。
 * `providerSymbol` に同じシンボルを渡し、`^GSPC` / `JPY=X` 等をそのまま解決する。
 */
async function fetchHybridCloseAndChangeForYahooSymbol(
  yahooSymbol: string,
): Promise<{ close: number; changePct: number } | null> {
  try {
    const live = await fetchLiveQuoteSnapshot(yahooSymbol, yahooSymbol);
    if (live != null && Number.isFinite(live.price) && live.price > 0) {
      let changePct = live.changePct;
      if (changePct == null || !Number.isFinite(changePct)) {
        const chart = await fetchYahooCloseAndDayChangePct(yahooSymbol);
        if (chart != null) changePct = chart.changePct;
      }
      return {
        close: live.price,
        changePct: changePct != null && Number.isFinite(changePct) ? changePct : 0,
      };
    }
  } catch (e) {
    logSkip(yahooSymbol, "fetchHybridCloseAndChangeForYahooSymbol (quote) failed", e);
  }
  return fetchYahooCloseAndDayChangePct(yahooSymbol);
}

/**
 * ダッシュボード用マーケットグレンス（並列 Yahoo）。`quote` ライブ優先、失敗時は日足。
 * 失敗した指標は `value: -1`（UI は —）。
 */
export async function fetchGlobalMarketIndicators(): Promise<MarketIndicator[]> {
  const settled = await Promise.allSettled(
    MARKET_GLANCE_MACRO_DEFS.map(async ({ label, symbol }) => {
      const snap = await fetchHybridCloseAndChangeForYahooSymbol(symbol);
      if (snap == null) return { label, value: -1, changePct: 0 } satisfies MarketIndicator;
      return { label, value: snap.close, changePct: snap.changePct };
    }),
  );
  return settled.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    const { label } = MARKET_GLANCE_MACRO_DEFS[i]!;
    logSkip(label, "indicator fetch rejected", r.reason);
    return { label, value: -1, changePct: 0 };
  });
}
