/**
 * Single source of truth for Alpha (relative performance vs benchmark) interpretation.
 * Spec: no FX — compare local-currency daily returns directly (returns / Alpha %).
 *
 * For **portfolio valuation weights** (dashboard), pass a live `usdJpyRate` from `price-service` (`JPY=X`).
 */

import type { TickerInstrumentKind } from "@/src/types/investment";

/** Benchmark ticker persisted in `alpha_history` / used by signal rules (must exist in `benchmarks`). */
export const SIGNAL_BENCHMARK_TICKER = "VOO";

export type QuoteCurrency = "JPY" | "USD";

/**
 * Convert a nominal amount in `currency` to Japanese yen (identity for JPY).
 * For USD, `usdJpyRate` must be a positive finite number (callers supply API rate or `USD_JPY_RATE_FALLBACK` from `fx-constants`).
 */
export function convertValueToJpy(value: number, currency: QuoteCurrency, usdJpyRate: number): number {
  if (!Number.isFinite(value)) return 0;
  if (currency === "JPY") return value;
  if (!Number.isFinite(usdJpyRate) || usdJpyRate <= 0) return 0;
  return value * usdJpyRate;
}

const DIGITS_ONLY = /^\d+$/;

export function classifyTickerInstrument(ticker: string): TickerInstrumentKind {
  const t = ticker.trim();
  if (DIGITS_ONLY.test(t)) return "JP_INVESTMENT_TRUST";
  return "US_EQUITY";
}

/**
 * Currency for dashboard market value: digit-only tickers (投信等) → JPY、それ以外 → USD×為替。
 * 指数連動のスケールずれは `valuation_factor` で調整（ティッカーが数字でも provider が ^ でも円レートは乗せない）。
 */
export function quoteCurrencyForDashboardWeights(ticker: string): QuoteCurrency {
  return classifyTickerInstrument(ticker) === "JP_INVESTMENT_TRUST" ? "JPY" : "USD";
}

/**
 * Daily return (%): ((close_t - close_{t-1}) / close_{t-1}) * 100
 * Returns null if previous close is missing or non-positive.
 */
export function dailyReturnPercent(prevClose: number, todayClose: number): number | null {
  if (!Number.isFinite(prevClose) || !Number.isFinite(todayClose) || prevClose <= 0) {
    return null;
  }
  return ((todayClose - prevClose) / prevClose) * 100;
}

/** Round to 2 decimal places (Alpha and aligned metrics). */
export function roundAlphaMetric(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Alpha = stockReturn% - benchmarkReturn%. Null if either input is null.
 * Output rounded to 2 decimals.
 */
export function computeAlphaPercent(
  stockReturnPercent: number | null,
  benchmarkReturnPercent: number | null,
): number | null {
  if (stockReturnPercent === null || benchmarkReturnPercent === null) return null;
  return roundAlphaMetric(stockReturnPercent - benchmarkReturnPercent);
}

/** `alpha_history` 等から渡す 1 日分の超過リターン（Ticker% − Bench%）。 */
export type DatedAlphaRow = {
  /** `recorded_at`（YYYY-MM-DD または ISO。先頭 10 文字を日付として扱う） */
  recordedAt: string;
  alphaValue: number;
};

function toYmd(recordedAt: string): string {
  const t = recordedAt.trim();
  return t.length >= 10 ? t.slice(0, 10) : t;
}

/**
 * テーマ設定日（または任意の起点）に最も近い観測日をアンカーとし、そこを累積 0 として
 * 以降の日次 Alpha（対ベンチマーク超過）を単純合算した累積系列を返す。
 * （厳密な相対リターンは (P/P0)/(B/B0)-1 だが、日次 Alpha の和で実装する。）
 */
export function calculateCumulativeAlpha(alphaRows: DatedAlphaRow[], startDate: string): { date: string; cumulative: number }[] {
  if (alphaRows.length === 0) return [];

  const sorted = [...alphaRows]
    .map((r) => ({
      ymd: toYmd(r.recordedAt),
      alpha: Number(r.alphaValue),
    }))
    .filter((r) => r.ymd.length === 10)
    .sort((a, b) => a.ymd.localeCompare(b.ymd));

  if (sorted.length === 0) return [];

  const startYmd = toYmd(startDate);
  const anchorTime =
    startYmd.length === 10 ? new Date(`${startYmd}T12:00:00Z`).getTime() : Number.NaN;

  let bestIdx = 0;
  if (Number.isFinite(anchorTime)) {
    let bestDist = Infinity;
    for (let i = 0; i < sorted.length; i++) {
      const t = new Date(`${sorted[i]!.ymd}T12:00:00Z`).getTime();
      const d = Math.abs(t - anchorTime);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
  }

  const out: { date: string; cumulative: number }[] = [];
  out.push({ date: sorted[bestIdx]!.ymd, cumulative: 0 });

  let cum = 0;
  for (let i = bestIdx + 1; i < sorted.length; i++) {
    const a = sorted[i]!.alpha;
    cum += Number.isFinite(a) ? a : 0;
    out.push({ date: sorted[i]!.ymd, cumulative: roundAlphaMetric(cum) });
  }

  return out;
}

/**
 * テーマ内複数銘柄の累積 Alpha 系列を、評価額ウェイトで加重平均（各日はデータがある銘柄のみでウェイト再正規化）。
 */
export function mergeWeightedCumulativeAlphaSeries(
  inputs: { weight: number; series: { date: string; cumulative: number }[] }[],
): { date: string; cumulative: number }[] {
  if (inputs.length === 0) return [];

  const positive = inputs.filter((x) => x.series.length > 0);
  if (positive.length === 0) return [];

  const totalW = positive.reduce((s, x) => s + (x.weight > 0 ? x.weight : 0), 0);
  const weighted = positive.map((x) => ({
    w: totalW > 0 ? x.weight / totalW : 1 / positive.length,
    series: x.series,
  }));

  const dateSet = new Set<string>();
  for (const { series } of weighted) {
    for (const p of series) dateSet.add(p.date);
  }
  const dates = [...dateSet].sort();

  function cumAtOrBefore(series: { date: string; cumulative: number }[], ymd: string): number | null {
    let last: number | null = null;
    for (const p of series) {
      if (p.date <= ymd) last = p.cumulative;
      else break;
    }
    return last;
  }

  const out: { date: string; cumulative: number }[] = [];
  for (const d of dates) {
    let sum = 0;
    let wsum = 0;
    for (const { w, series } of weighted) {
      const v = cumAtOrBefore(series, d);
      if (v !== null) {
        sum += w * v;
        wsum += w;
      }
    }
    if (wsum > 0) {
      out.push({ date: d, cumulative: roundAlphaMetric(sum / wsum) });
    }
  }
  return out;
}
