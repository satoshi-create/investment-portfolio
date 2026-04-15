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
  type DatedAlphaRow,
} from "@/src/lib/alpha-logic";
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
  /** Annual dividend per share/unit (local currency). */
  annualDividendRate: number | null;
  /** Dividend yield percent (e.g. 2.15). */
  dividendYieldPercent: number | null;
};

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

function daysUntilYmd(ymd: string): number | null {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const diffMs = d.getTime() - todayUtc.getTime();
  return Math.round(diffMs / (24 * 60 * 60 * 1000));
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
        modules: ["calendarEvents", "summaryDetail"],
      });

      type YahooEarningsDateLike = { raw?: unknown; fmt?: unknown };
      type YahooQuoteSummaryShape = {
        calendarEvents?: {
          earnings?: {
            earningsDate?: unknown;
          };
        };
        summaryDetail?: {
          dividendRate?: unknown;
          dividendYield?: unknown;
        };
      };
      const qss = qs as unknown as YahooQuoteSummaryShape;

      // calendarEvents.earnings.earningsDate: array of { raw, fmt } or Date-like
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

      return {
        ticker: ticker.toUpperCase(),
        nextEarningsDate,
        annualDividendRate,
        dividendYieldPercent,
      } satisfies EquityResearchSnapshot;
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

/**
 * `yahooFinance.quote` でライブに近い最新値を取得（chart とは独立）。
 */
export async function fetchLiveQuoteSnapshot(
  ticker: string,
  providerSymbol?: string | null,
): Promise<{ price: number; changePct: number | null; asOf: string } | null> {
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
    return pickLivePriceFromQuote(q);
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

function sharedSortedDatesForVooOverlap(stockBars: PriceBar[], vooBars: PriceBar[]): string[] {
  const vooSet = new Set(vooBars.map((b) => b.date));
  return [...new Set(stockBars.map((b) => b.date).filter((d) => vooSet.has(d)))].sort();
}

/**
 * Yahoo から日次 Alpha % 系列（株 − VOO）を構築。`alpha_history` が無いウォッチリスト銘柄用。
 */
export async function fetchRecentDailyAlphaSeriesVsVoo(
  ticker: string,
  calendarDays: number,
  providerSymbol?: string | null,
): Promise<{ alphas: number[]; lastClose: number | null }> {
  const safeDays = Math.max(15, Math.min(120, Math.floor(Number.isFinite(calendarDays) ? calendarDays : 45)));
  try {
    const [stockBars, benchBars] = await Promise.all([
      fetchPriceHistory(ticker, safeDays, providerSymbol),
      fetchPriceHistory(SIGNAL_BENCHMARK_TICKER, safeDays, null),
    ]);
    if (stockBars.length < 2 || benchBars.length < 2) {
      const last = stockBars.length > 0 ? stockBars[stockBars.length - 1]!.close : null;
      return { alphas: [], lastClose: last };
    }
    const vooByDate = new Map(benchBars.map((b) => [b.date, b.close]));
    const stockBy = new Map(stockBars.map((b) => [b.date, b.close]));
    const shared = sharedSortedDatesForVooOverlap(stockBars, benchBars);
    if (shared.length < 2) {
      return { alphas: [], lastClose: stockBars[stockBars.length - 1]!.close };
    }
    const alphas: number[] = [];
    for (let i = 1; i < shared.length; i++) {
      const dPrev = shared[i - 1]!;
      const dCur = shared[i]!;
      const s0 = stockBy.get(dPrev);
      const s1 = stockBy.get(dCur);
      const b0 = vooByDate.get(dPrev);
      const b1 = vooByDate.get(dCur);
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
    logSkip(ticker, "fetchRecentDailyAlphaSeriesVsVoo failed", e);
    return { alphas: [], lastClose: null };
  }
}

/**
 * Yahoo から日次 Alpha（株 − VOO）を **観測日（各区間の終端日）付き**で返す。累積 Alpha の起点計算用。
 */
export async function fetchRecentDatedDailyAlphasVsVoo(
  ticker: string,
  calendarDays: number,
  providerSymbol?: string | null,
): Promise<{ rows: DatedAlphaRow[]; lastClose: number | null }> {
  const safeDays = Math.max(15, Math.min(120, Math.floor(Number.isFinite(calendarDays) ? calendarDays : 45)));
  try {
    const [stockBars, benchBars] = await Promise.all([
      fetchPriceHistory(ticker, safeDays, providerSymbol),
      fetchPriceHistory(SIGNAL_BENCHMARK_TICKER, safeDays, null),
    ]);
    if (stockBars.length < 2 || benchBars.length < 2) {
      const last = stockBars.length > 0 ? stockBars[stockBars.length - 1]!.close : null;
      return { rows: [], lastClose: last };
    }
    const vooByDate = new Map(benchBars.map((b) => [b.date, b.close]));
    const stockBy = new Map(stockBars.map((b) => [b.date, b.close]));
    const shared = sharedSortedDatesForVooOverlap(stockBars, benchBars);
    if (shared.length < 2) {
      return { rows: [], lastClose: stockBars[stockBars.length - 1]!.close };
    }
    const rows: DatedAlphaRow[] = [];
    for (let i = 1; i < shared.length; i++) {
      const dPrev = shared[i - 1]!;
      const dCur = shared[i]!;
      const s0 = stockBy.get(dPrev);
      const s1 = stockBy.get(dCur);
      const b0 = vooByDate.get(dPrev);
      const b1 = vooByDate.get(dCur);
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
    logSkip(ticker, "fetchRecentDatedDailyAlphasVsVoo failed", e);
    return { rows: [], lastClose: null };
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

const GLOBAL_MARKET_BAR_DEFS: readonly { label: string; symbol: string }[] = [
  { label: "USD/JPY", symbol: "JPY=X" },
  { label: "Crude (USO)", symbol: "USO" },
  { label: "Gold", symbol: "GC=F" },
  { label: "BTC", symbol: "BTC-USD" },
  { label: "S&P 500", symbol: "^GSPC" },
  { label: "NASDAQ 100", symbol: "^NDX" },
  { label: "SOX", symbol: "^SOX" },
  { label: "VIX", symbol: "^VIX" },
  { label: "Nikkei 225", symbol: "^N225" },
  { label: "10Y Yield", symbol: "^TNX" },
  { label: "DJIA", symbol: "^DJI" },
];

/**
 * ダッシュボード用マーケットグレンス（並列 Yahoo）。`quote` ライブ優先、失敗時は日足。
 * 失敗した指標は `value: -1`（UI は —）。
 */
export async function fetchGlobalMarketIndicators(): Promise<MarketIndicator[]> {
  const settled = await Promise.allSettled(
    GLOBAL_MARKET_BAR_DEFS.map(async ({ label, symbol }) => {
      const snap = await fetchHybridCloseAndChangeForYahooSymbol(symbol);
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
