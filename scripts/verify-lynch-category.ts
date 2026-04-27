/**
 * Pure checks for getLynchCategory (no DB). Run: npm run verify:lynch-category
 */
import assert from "node:assert/strict";

import {
  aggregateLynchCategoryCounts,
  aggregateLynchCategoryCountsForWatchItems,
  getLynchCategory,
  getLynchCategoryFromWatchItem,
  isLynchCyclicalSector,
  sortLynchToolbarSegments,
  themeEcosystemWatchItemToLynchInput,
} from "../src/lib/lynch-category-computed";
import type { Stock, ThemeEcosystemWatchItem } from "../src/types/investment";

function eq(actual: unknown, expected: unknown, msg?: string) {
  assert.equal(actual, expected, msg);
}

/** テストに必要なフィールドのみ埋めた最小 Stock（getLynchCategory が読む項目以外はダミー） */
function mk(overrides: Partial<Stock> & Pick<Stock, "ticker">): Stock {
  const { ticker, ...rest } = overrides;
  const base: Stock = {
    id: "h1",
    ticker,
    name: "",
    accountType: null,
    countryName: "米国",
    nextEarningsDate: null,
    daysToEarnings: null,
    exDividendDate: null,
    daysToExDividend: null,
    recordDate: null,
    daysToRecordDate: null,
    annualDividendRate: null,
    dividendYieldPercent: null,
    trailingPe: null,
    forwardPe: null,
    priceToBook: null,
    trailingEps: null,
    forwardEps: null,
    pegRatio: null,
    dividendAdjustedPeg: null,
    totalReturnYieldRatio: null,
    expectedGrowth: null,
    yahooCountry: null,
    ttmRepurchaseOfStock: null,
    consecutiveDividendYears: null,
    yahooBuybackPosture: null,
    yahooQuoteSharesOutstanding: null,
    yahooInsiderNetPurchaseShares: null,
    tag: "",
    alphaHistory: [],
    alphaHistoryObservationDates: [],
    weight: 0,
    quantity: 0,
    category: "Satellite",
    avgAcquisitionPrice: null,
    unrealizedPnlLocal: 0,
    unrealizedPnlJpy: 0,
    unrealizedPnlPercent: 0,
    dayChangePercent: null,
    previousClose: null,
    benchmarkDayChangePercent: null,
    liveAlphaBenchmarkTicker: null,
    latestAlphaObservationYmd: null,
    instrumentKind: "US_EQUITY",
    secondaryTag: "Other",
    sector: null,
    priceSource: "close",
    lastUpdatedAt: null,
    currentPrice: null,
    alphaDeviationZ: null,
    drawdownFromHigh90dPct: null,
    marketValue: 0,
    valuationFactor: 1,
    expectationCategory: null,
    earningsSummaryNote: null,
    listingDate: null,
    marketCap: null,
    listingPrice: null,
    memo: null,
    isBookmarked: false,
    stopLossPct: null,
    targetProfitPct: null,
    tradeDeadline: null,
    exitRuleEnabled: false,
    performanceSinceFoundation: null,
    revenueGrowth: NaN,
    fcfMargin: NaN,
    fcfYield: NaN,
    ruleOf40: NaN,
    judgmentStatus: "WATCH",
    judgmentReason: "",
    netCash: null,
    netCashPerShare: null,
    priceMinusNetCashPerShare: null,
    regularMarketVolume: null,
    averageDailyVolume10Day: null,
    volumeRatio: null,
    ...rest,
  };
  return base;
}

eq(getLynchCategory(mk({ ticker: "X", expectedGrowth: 0.25, sector: "Semiconductors" })), "Cyclical");
eq(getLynchCategory(mk({ ticker: "X", expectedGrowth: 0.25, sector: "Software" })), "FastGrower");
eq(
  getLynchCategory(mk({ ticker: "X", trailingEps: -0.5, forwardEps: 0.2, sector: "Software", expectedGrowth: 0.02 })),
  "Turnaround",
);
eq(
  getLynchCategory(
    mk({
      ticker: "X",
      marketCap: 120_000_000_000,
      expectedGrowth: 0.12,
      sector: "Software",
    }),
  ),
  "Stalwart",
);
eq(
  getLynchCategory(
    mk({ ticker: "X", expectedGrowth: 0.03, annualDividendRate: 1, sector: "Utilities", dividendYieldPercent: 2 }),
  ),
  "SlowGrower",
);
eq(getLynchCategory(mk({ ticker: "X", priceToBook: 0.7, sector: "Software" })), "AssetPlay");
eq(
  getLynchCategory(mk({ ticker: "X", priceToBook: 2, marketCap: 10e9, netCash: 2e9, sector: "Software" })),
  "AssetPlay",
);
eq(getLynchCategory(mk({ ticker: "X", sector: "Biotechnology" })), null);

eq(isLynchCyclicalSector(mk({ ticker: "S", sector: "Steel" })), true);
eq(isLynchCyclicalSector(mk({ ticker: "S", secondaryTag: "semiconductors", sector: null })), true);

const snap = aggregateLynchCategoryCounts([
  mk({ ticker: "A", sector: "Steel" }),
  mk({ ticker: "B", sector: "Steel" }),
  mk({ ticker: "C", expectedGrowth: 0.25, sector: "Software" }),
]);
eq(snap.total, 3);
eq(snap.byCategory.Cyclical, 2);
eq(snap.byCategory.FastGrower, 1);
eq(snap.unset, 0);
const ord = sortLynchToolbarSegments(snap);
eq(ord[0], "Cyclical");
eq(ord[1], "FastGrower");

/** 観測行テスト用: `getLynchCategoryFromWatchItem` が読むプロパティ以外は未使用 */
function asWatch(p: Pick<ThemeEcosystemWatchItem, "field" | "expectedGrowth"> & Partial<ThemeEcosystemWatchItem>): ThemeEcosystemWatchItem {
  return p as ThemeEcosystemWatchItem;
}

const wCyclical = asWatch({ field: "Semiconductors", expectedGrowth: 0.25 });
const inp = themeEcosystemWatchItemToLynchInput(wCyclical);
eq(inp.sector, null);
eq(inp.secondaryTag, "Semiconductors");
eq(inp.netCash, null);
eq(getLynchCategoryFromWatchItem(wCyclical), "Cyclical");

eq(getLynchCategoryFromWatchItem(asWatch({ field: "Software", expectedGrowth: 0.25 })), "FastGrower");

const wSnap = aggregateLynchCategoryCountsForWatchItems([
  asWatch({ field: "Steel", expectedGrowth: 0.1 }),
  asWatch({ field: "Software", expectedGrowth: 0.25 }),
]);
eq(wSnap.total, 2);
eq(wSnap.byCategory.Cyclical, 1);
eq(wSnap.byCategory.FastGrower, 1);

console.log("verify-lynch-category: OK");
