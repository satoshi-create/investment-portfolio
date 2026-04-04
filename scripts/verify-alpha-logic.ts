/**
 * Pure checks for Alpha SSOT (no DB). Run: npm run verify:alpha
 */
import assert from "node:assert/strict";

import {
  classifyTickerInstrument,
  computeAlphaPercent,
  convertValueToJpy,
  dailyReturnPercent,
  quoteCurrencyForDashboardWeights,
  roundAlphaMetric,
  SIGNAL_BENCHMARK_TICKER,
  USD_JPY_RATE,
} from "../src/lib/alpha-logic";
import { normalizedHoldingValueJpy } from "../src/lib/dashboard-data";

function eq(actual: unknown, expected: unknown, msg?: string) {
  assert.equal(actual, expected, msg);
}

console.log("SIGNAL_BENCHMARK_TICKER:", SIGNAL_BENCHMARK_TICKER);
eq(SIGNAL_BENCHMARK_TICKER, "VOO");

eq(classifyTickerInstrument("06311181"), "JP_INVESTMENT_TRUST");
eq(classifyTickerInstrument(" 06311181 "), "JP_INVESTMENT_TRUST");
eq(classifyTickerInstrument("NVDA"), "US_EQUITY");
eq(classifyTickerInstrument("COP"), "US_EQUITY");
eq(classifyTickerInstrument("BRK.B"), "US_EQUITY");

eq(dailyReturnPercent(100, 110), 10);
eq(dailyReturnPercent(100, 95), -5);
eq(dailyReturnPercent(0, 100), null);
eq(dailyReturnPercent(100, 100), 0);

eq(roundAlphaMetric(1.236), 1.24);
eq(roundAlphaMetric(1.234), 1.23);

// Mock: stock +1%, VOO +0.25% → Alpha +0.75%
const rStock = dailyReturnPercent(400, 404);
const rVoo = dailyReturnPercent(500, 501.25);
eq(rStock, 1);
eq(rVoo, 0.25);
eq(computeAlphaPercent(rStock, rVoo), 0.75);

// JPY fund mock same formula (no FX): prev 10_000 JPY, today 10_200 → +2%; VOO flat 0%
eq(computeAlphaPercent(dailyReturnPercent(10_000, 10_200), 0), 2);

eq(computeAlphaPercent(null, 1), null);
eq(computeAlphaPercent(1, null), null);

eq(convertValueToJpy(100, "JPY"), 100);
eq(convertValueToJpy(2, "USD"), 2 * USD_JPY_RATE);

eq(quoteCurrencyForDashboardWeights("NVDA"), "USD");
eq(quoteCurrencyForDashboardWeights("06311181"), "JPY");

// NVDA: qty × USD price × factor × USD_JPY
eq(
  normalizedHoldingValueJpy({
    ticker: "NVDA",
    quantity: 10,
    currentPrice: 100,
    valuationFactor: 1,
  }),
  10 * 100 * USD_JPY_RATE,
);
// JP fund: JPY path (no FX), factor scales index-style quotes toward NAV
eq(
  normalizedHoldingValueJpy({
    ticker: "06311181",
    quantity: 100,
    currentPrice: 14_000,
    valuationFactor: 0.000_02,
  }),
  100 * 14_000 * 0.000_02,
);
eq(
  normalizedHoldingValueJpy({
    ticker: "06311181",
    quantity: 10,
    currentPrice: 1000,
    valuationFactor: 1,
  }),
  10_000,
);
eq(
  normalizedHoldingValueJpy({
    ticker: "06311181",
    quantity: 1,
    currentPrice: null,
    valuationFactor: 1,
  }),
  0,
);

console.log("verify-alpha-logic: all assertions passed.");
