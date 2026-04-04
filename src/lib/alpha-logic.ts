/**
 * Single source of truth for Alpha (relative performance vs benchmark) interpretation.
 * Spec: no FX — compare local-currency daily returns directly (returns / Alpha %).
 *
 * For **portfolio valuation weights** (dashboard), use `convertValueToJpy` / `USD_JPY_RATE` below.
 */

import type { TickerInstrumentKind } from "@/src/types/investment";

/** Benchmark ticker persisted in `alpha_history` / used by signal rules (must exist in `benchmarks`). */
export const SIGNAL_BENCHMARK_TICKER = "VOO";

/** Simple USD→JPY rate for dashboard weights (replace with live FX API later). */
export const USD_JPY_RATE = 150;

export type QuoteCurrency = "JPY" | "USD";

/** Convert a nominal amount in `currency` to Japanese yen (identity for JPY). */
export function convertValueToJpy(value: number, currency: QuoteCurrency): number {
  if (!Number.isFinite(value)) return 0;
  if (currency === "JPY") return value;
  return value * USD_JPY_RATE;
}

const DIGITS_ONLY = /^\d+$/;

export function classifyTickerInstrument(ticker: string): TickerInstrumentKind {
  const t = ticker.trim();
  if (DIGITS_ONLY.test(t)) return "JP_INVESTMENT_TRUST";
  return "US_EQUITY";
}

/**
 * Currency for dashboard market value: digit-only tickers (投信等) → JPY、それ以外 → USD×USD_JPY。
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
