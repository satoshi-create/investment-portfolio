/**
 * Yahoo Finance integration — use only from Server Actions, Route Handlers, or scripts.
 * (Do not import from Client Components: exposes server-side usage and API load.)
 */
import YahooFinance from "yahoo-finance2";

import {
  classifyTickerInstrument,
  computeAlphaPercent,
  dailyReturnPercent,
  roundAlphaMetric,
  SIGNAL_BENCHMARK_TICKER,
} from "@/src/lib/alpha-logic";
import type { MarketIndicator } from "@/src/types/investment";

const yahooFinance = new YahooFinance();

export type PriceBar = { date: string; close: number };

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
  if (kind === "JP_INVESTMENT_TRUST") return `${raw}.T`;
  return raw.toUpperCase();
}

function autoYahooSymbolForFallbacks(ticker: string): string {
  return toYahooFinanceSymbol(ticker, null);
}

/** Alternate Yahoo symbols for JP codes when `.T` returns no series (extend as needed). */
function yahooSymbolFallbacks(primary: string, ticker: string): string[] {
  const raw = ticker.trim();
  if (classifyTickerInstrument(raw) !== "JP_INVESTMENT_TRUST") return [primary];
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

async function fetchChartCloses(yahooSymbol: string, calendarDays: number): Promise<PriceBar[]> {
  const days = Math.max(1, Math.floor(Number.isFinite(calendarDays) ? calendarDays : 1));
  const { period1, period2 } = periodRangeForCalendarDays(days);
  const result = await yahooFinance.chart(yahooSymbol, {
    period1,
    period2,
    interval: "1d",
  });

  const quotes = result.quotes ?? [];
  const bars: PriceBar[] = [];
  for (const q of quotes) {
    if (q.close == null || !Number.isFinite(q.close) || q.close <= 0) continue;
    const ymd = chartBarDateYmd(q);
    if (ymd == null) continue;
    bars.push({ date: ymd, close: q.close });
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

const GLOBAL_MARKET_BAR_DEFS: readonly { label: string; symbol: string }[] = [
  { label: "USD/JPY", symbol: "JPY=X" },
  { label: "Crude (USO)", symbol: "USO" },
  { label: "S&P 500", symbol: "^GSPC" },
  { label: "NASDAQ 100", symbol: "^NDX" },
  { label: "SOX", symbol: "^SOX" },
  { label: "VIX", symbol: "^VIX" },
  { label: "Nikkei 225", symbol: "^N225" },
  { label: "10Y Yield", symbol: "^TNX" },
  { label: "DJIA", symbol: "^DJI" },
];

/**
 * ダッシュボード用マーケットグレンス（並列 Yahoo）。失敗した指標は `value: -1`（UI は —）。
 */
export async function fetchGlobalMarketIndicators(): Promise<MarketIndicator[]> {
  const settled = await Promise.allSettled(
    GLOBAL_MARKET_BAR_DEFS.map(async ({ label, symbol }) => {
      const snap = await fetchYahooCloseAndDayChangePct(symbol);
      if (snap == null) return { label, value: -1, changePct: 0 } satisfies MarketIndicator;
      return { label, value: snap.close, changePct: snap.changePct };
    }),
  );
  return settled.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    const { label } = GLOBAL_MARKET_BAR_DEFS[i]!;
    logSkip(label, "indicator fetch rejected", r.reason);
    return { label, value: -1, changePct: 0 };
  });
}
