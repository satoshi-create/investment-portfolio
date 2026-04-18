/**
 * Pure checks for Alpha SSOT (no DB). Run: npm run verify:alpha
 */
import assert from "node:assert/strict";

import {
  benchmarkDailyReturnPercentByEndDate,
  calculateCumulativeAlpha,
  classifyTickerInstrument,
  computeAlphaDeviationZScore,
  computeAlphaPercent,
  computePriceDrawdownFromHighPercent,
  computeSyntheticBenchmarkDailyReturnPercent,
  computeThemeCumulativeAlphaVsSyntheticFromDailyExcesses,
  computeThemeUsJpRatiosFromStocks,
  convertValueToJpy,
  dailyReturnPercent,
  isCumulativeSeriesTrendUpward,
  mergeWeightedCumulativeAlphaSeries,
  quoteCurrencyForDashboardWeights,
  roundAlphaMetric,
  SIGNAL_BENCHMARK_TICKER,
} from "../src/lib/alpha-logic";
import { normalizedHoldingValueJpy } from "../src/lib/dashboard-data";
import { USD_JPY_RATE_FALLBACK } from "../src/lib/fx-constants";

/** Test-assumed FX (matches operational fallback when API is unavailable). */
const TEST_USD_JPY = USD_JPY_RATE_FALLBACK;

function eq(actual: unknown, expected: unknown, msg?: string) {
  assert.equal(actual, expected, msg);
}

console.log("SIGNAL_BENCHMARK_TICKER:", SIGNAL_BENCHMARK_TICKER);
eq(SIGNAL_BENCHMARK_TICKER, "VOO");

eq(classifyTickerInstrument("06311181"), "JP_INVESTMENT_TRUST");
eq(classifyTickerInstrument(" 06311181 "), "JP_INVESTMENT_TRUST");
eq(classifyTickerInstrument("4401"), "JP_LISTED_EQUITY");
eq(classifyTickerInstrument("8035"), "JP_LISTED_EQUITY");
eq(classifyTickerInstrument("7203.T"), "JP_LISTED_EQUITY");
eq(classifyTickerInstrument("300"), "US_EQUITY");
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

eq(convertValueToJpy(100, "JPY", TEST_USD_JPY), 100);
eq(convertValueToJpy(2, "USD", TEST_USD_JPY), 2 * TEST_USD_JPY);

eq(quoteCurrencyForDashboardWeights("NVDA"), "USD");
eq(quoteCurrencyForDashboardWeights("06311181"), "JPY");
eq(quoteCurrencyForDashboardWeights("4401"), "JPY");
eq(quoteCurrencyForDashboardWeights("7203.T"), "JPY");

// Theme synthetic: US/JP ratios (market-value weighted)
{
  const r = computeThemeUsJpRatiosFromStocks([
    { instrumentKind: "US_EQUITY", marketValue: 70 },
    { instrumentKind: "JP_LISTED_EQUITY", marketValue: 30 },
  ]);
  eq(r.basis, "market_value");
  eq(r.usRatio, 0.7);
  eq(r.jpRatio, 0.3);
}
// All US → JP ratio 0 (single VOO leg)
{
  const r = computeThemeUsJpRatiosFromStocks([
    { instrumentKind: "US_EQUITY", marketValue: 100 },
    { instrumentKind: "US_EQUITY", marketValue: 50 },
  ]);
  eq(r.usRatio, 1);
  eq(r.jpRatio, 0);
}
// Synthetic daily return: 0.7*1 + 0.3*2 = 1.3
eq(computeSyntheticBenchmarkDailyReturnPercent(1, 2, 0.7, 0.3), 1.3);
eq(computeSyntheticBenchmarkDailyReturnPercent(1, null, 1, 0), 1);
eq(computeSyntheticBenchmarkDailyReturnPercent(null, 2, 0, 1), 2);

// End-date return map
{
  const m = benchmarkDailyReturnPercentByEndDate([
    { date: "2025-01-01", close: 100 },
    { date: "2025-01-02", close: 110 },
  ]);
  eq(m.get("2025-01-02"), 10);
}

// Pure-US theme: cumulative sums daily excess after anchor session (see `calculateCumulativeAlpha`)
{
  const series = computeThemeCumulativeAlphaVsSyntheticFromDailyExcesses({
    startAnchorYmd: "2025-01-02",
    stocks: [
      {
        ticker: "A",
        weight: 1,
        instrumentKind: "US_EQUITY",
        dailyAlphaByEndDateYmd: new Map([
          ["2025-01-02", 0.5],
          ["2025-01-03", 0.3],
        ]),
      },
    ],
    usRatio: 1,
    jpRatio: 0,
    vooReturnByEndDateYmd: new Map([
      ["2025-01-02", 1],
      ["2025-01-03", 0],
    ]),
    topixReturnByEndDateYmd: new Map(),
  });
  eq(series.length >= 2, true);
  eq(series[series.length - 1]!.cumulative, 0.3);
}

// NVDA: qty × USD price × factor × USD/JPY
eq(
  normalizedHoldingValueJpy({
    ticker: "NVDA",
    quantity: 10,
    currentPrice: 100,
    valuationFactor: 1,
    fxUsdJpy: TEST_USD_JPY,
  }),
  10 * 100 * TEST_USD_JPY,
);
// JP listed (4-digit): JPY path (no FX)
eq(
  normalizedHoldingValueJpy({
    ticker: "4401",
    quantity: 100,
    currentPrice: 3500,
    valuationFactor: 1,
    fxUsdJpy: TEST_USD_JPY,
  }),
  100 * 3500,
);
// JP fund: JPY path (no FX), factor scales index-style quotes toward NAV
eq(
  normalizedHoldingValueJpy({
    ticker: "06311181",
    quantity: 100,
    currentPrice: 14_000,
    valuationFactor: 0.000_02,
    fxUsdJpy: TEST_USD_JPY,
  }),
  100 * 14_000 * 0.000_02,
);
eq(
  normalizedHoldingValueJpy({
    ticker: "06311181",
    quantity: 10,
    currentPrice: 1000,
    valuationFactor: 1,
    fxUsdJpy: TEST_USD_JPY,
  }),
  10_000,
);
eq(
  normalizedHoldingValueJpy({
    ticker: "06311181",
    quantity: 1,
    currentPrice: null,
    valuationFactor: 1,
    fxUsdJpy: TEST_USD_JPY,
  }),
  0,
);

// Base-date cumulative: anchor is calendar-closest row (2024-01-10 for start 2024-01-09); prior rows omitted
const cum = calculateCumulativeAlpha(
  [
    { recordedAt: "2024-01-02", alphaValue: 0.5 },
    { recordedAt: "2024-01-10", alphaValue: 0.2 },
    { recordedAt: "2024-01-11", alphaValue: 1 },
    { recordedAt: "2024-01-12", alphaValue: -0.5 },
  ],
  "2024-01-09",
);
eq(cum.length, 3);
eq(cum[0]!.date, "2024-01-10");
eq(cum[0]!.cumulative, 0);
eq(cum[1]!.cumulative, 1);
eq(cum[2]!.cumulative, 0.5);

const merged = mergeWeightedCumulativeAlphaSeries([
  {
    weight: 0.5,
    series: [
      { date: "2024-01-01", cumulative: 0 },
      { date: "2024-01-02", cumulative: 2 },
    ],
  },
  {
    weight: 0.5,
    series: [
      { date: "2024-01-01", cumulative: 0 },
      { date: "2024-01-02", cumulative: 4 },
    ],
  },
]);
eq(merged.length, 2);
eq(merged[1]!.cumulative, 3);

// Alpha deviation Z: oscillating baseline then cold last day (baseline σ > 0)
const altBaseline: number[] = [];
for (let i = 0; i < 29; i++) altBaseline.push(i % 2 === 0 ? 0.15 : -0.15);
const zCold = computeAlphaDeviationZScore([...altBaseline, -2.5], 30);
eq(zCold != null && zCold < -1.5, true);

eq(computeAlphaDeviationZScore([0, 1]), null);
eq(computeAlphaDeviationZScore([1, 1, 1, 1]), null);

eq(computePriceDrawdownFromHighPercent([80, 100, 90], 90), -10);
eq(computePriceDrawdownFromHighPercent([100], 100), 0);
eq(computePriceDrawdownFromHighPercent([], 100), null);

eq(isCumulativeSeriesTrendUpward([{ cumulative: 0 }, { cumulative: 1 }]), true);
eq(isCumulativeSeriesTrendUpward([{ cumulative: 1 }, { cumulative: 0 }]), false);

console.log("verify-alpha-logic: all assertions passed.");
