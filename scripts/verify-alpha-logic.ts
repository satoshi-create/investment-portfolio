/**
 * Pure checks for Alpha SSOT (no DB). Run: npm run verify:alpha
 */
import assert from "node:assert/strict";

import {
  classifyTickerInstrument,
  computeAlphaPercent,
  dailyReturnPercent,
  roundAlphaMetric,
  SIGNAL_BENCHMARK_TICKER,
} from "../src/lib/alpha-logic";

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

console.log("verify-alpha-logic: all assertions passed.");
