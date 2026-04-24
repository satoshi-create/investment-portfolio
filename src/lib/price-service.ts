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
  roundAlphaMetric,
  SIGNAL_BENCHMARK_TICKER,
  utcTodayYmd,
  type DatedAlphaRow,
} from "@/src/lib/alpha-logic";
import { MARKET_GLANCE_MACRO_DEFS } from "@/src/lib/market-glance-macros";
import type { MarketIndicator } from "@/src/types/investment";

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
 * Load daily bars: uses explicit provider symbol only (no .T fallbacks), or auto-resolution + JP fallbacks.
 */
async function fetchBarsForInstrument(
  ticker: string,
  providerSymbol: string | null | undefined,
  calendarDays: number,
  logContext: string,
): Promise<PriceBar[]> {
  const manual = trimProvider(providerSymbol);
  if (manual != null) {
    try {
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
  };
  financialData?: { earningsGrowth?: unknown };
  earningsTrend?: { trend?: YahooEarningsTrendRow[] };
};

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

  return {
    ticker: tickerUpper,
    nextEarningsDate,
    exDividendDate,
    recordDate,
    annualDividendRate,
    dividendYieldPercent,
    trailingPe: trailingPe0 != null && trailingPe0 > 0 ? trailingPe0 : null,
    forwardPe: forwardPe0 != null && forwardPe0 > 0 ? forwardPe0 : null,
    trailingEps: trailingEps0,
    forwardEps: forwardEps0,
    expectedGrowth,
    yahooPegRatio,
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
        modules: ["calendarEvents", "summaryDetail", "defaultKeyStatistics", "financialData", "earningsTrend"],
      });

      return equityResearchSnapshotFromQuoteSummary(qs, ticker.toUpperCase());
    } catch (e) {
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
  return out;
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

async function fetchBarsForBenchmark(benchmarkTicker: string, calendarDays: number): Promise<PriceBar[]> {
  const sym = toYahooFinanceSymbol(benchmarkTicker, null);
  if (!sym) return [];
  return fetchChartClosesWithFallbacks(sym, benchmarkTicker, calendarDays);
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

/** Yahoo の *Time は秒またはミリ秒の UNIX。 */
function quoteTimeToIso(raw: unknown): string | null {
  if (raw == null) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  const ms = n < 1e12 ? n * 1000 : n;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/**
 * `quote` から市場状態に応じて最も「今」に近い価格を選択（REGULAR / PRE / POST / CLOSED）。
 */
export function pickLivePriceFromQuote(q: Record<string, unknown>): {
  price: number;
  changePct: number | null;
  asOf: string;
} | null {
  const state = String(q["marketState"] ?? "");
  const prevClose = finitePositive(q["regularMarketPreviousClose"]);
  const reg = finitePositive(q["regularMarketPrice"]);
  const post = finitePositive(q["postMarketPrice"]);
  const pre = finitePositive(q["preMarketPrice"]);
  const nowIso = new Date().toISOString();

  const pctVsPrev = (price: number): number | null => {
    if (prevClose == null || prevClose <= 0) return null;
    return roundAlphaMetric(((price - prevClose) / prevClose) * 100);
  };

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
 */
export async function fetchPriceHistory(
  ticker: string,
  days: number,
  providerSymbol?: string | null,
): Promise<PriceBar[]> {
  const manual = trimProvider(providerSymbol);
  const logLabel = manual ?? ticker;
  const safeDays = Math.max(1, Math.floor(Number.isFinite(days) ? days : 1));
  const calendarWindow = Math.max(30, Math.ceil(safeDays * 2));
  try {
    const bars = await fetchBarsForInstrument(ticker, providerSymbol, calendarWindow, logLabel);
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
  try {
    const [stockBars, benchBars] = await Promise.all([
      fetchPriceHistory(ticker, safeDays, providerSymbol),
      fetchPriceHistory(benchmarkTicker, safeDays, null),
    ]);
    if (stockBars.length < 2 || benchBars.length < 2) {
      const last = stockBars.length > 0 ? stockBars[stockBars.length - 1]!.close : null;
      return { alphas: [], lastClose: last };
    }
    const benchByDate = new Map(benchBars.map((b) => [b.date, b.close]));
    const stockBy = new Map(stockBars.map((b) => [b.date, b.close]));
    const shared = sharedSortedDatesForBenchmarkOverlap(stockBars, benchBars);
    if (shared.length < 2) {
      return { alphas: [], lastClose: stockBars[stockBars.length - 1]!.close };
    }
    const alphas: number[] = [];
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
      alphas.push(roundAlphaMetric(alpha));
    }
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
  try {
    const [stockBars, benchBars] = await Promise.all([
      fetchPriceHistory(ticker, safeDays, providerSymbol),
      fetchPriceHistory(benchmarkTicker, safeDays, null),
    ]);
    if (stockBars.length < 2 || benchBars.length < 2) {
      const last = stockBars.length > 0 ? stockBars[stockBars.length - 1]!.close : null;
      return { rows: [], lastClose: last };
    }
    const benchByDate = new Map(benchBars.map((b) => [b.date, b.close]));
    const stockBy = new Map(stockBars.map((b) => [b.date, b.close]));
    const shared = sharedSortedDatesForBenchmarkOverlap(stockBars, benchBars);
    if (shared.length < 2) {
      return { rows: [], lastClose: stockBars[stockBars.length - 1]!.close };
    }
    const rows: DatedAlphaRow[] = [];
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
      rows.push({ recordedAt: dCur, alphaValue: roundAlphaMetric(alpha) });
    }
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
  const benchTicker = input.benchmarkTicker ?? SIGNAL_BENCHMARK_TICKER;
  const manual = trimProvider(input.providerSymbol);
  const stockLog = manual ?? ticker;

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
      fetchBarsForInstrument(ticker, input.providerSymbol, 90, `holding=${holdingId}`),
      fetchBarsForBenchmark(benchTicker, 90),
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
