import { ecoFcfYieldSortValue, ecoNetCashSortValue, ecoNetCashYieldSortValue, ecoRuleOf40SortValue } from "@/src/components/dashboard/eco-efficiency-display";
import type { StructuralEcoSortKey } from "@/src/components/dashboard/StructuralEcosystemThead";
import { lastDailyAlphaForTrendSort } from "@/src/lib/eco-trend-daily";
import { ecosystemDividendPayoutPercent } from "@/src/lib/eco-dividend-payout";
import { lynchCategorySortRank } from "@/src/lib/expectation-category";
import { getLynchCategoryFromWatchItem } from "@/src/lib/lynch-category-computed";
import { judgmentPriorityRank, type JudgmentStatus } from "@/src/lib/judgment-logic";
import type { ThemeEcosystemWatchItem } from "@/src/types/investment";

function ecoPeOf(e: ThemeEcosystemWatchItem): number | null {
  const v = e.trailingPe ?? e.forwardPe ?? null;
  return v != null && Number.isFinite(v) && v > 0 ? v : null;
}

function ecoPbrOf(e: ThemeEcosystemWatchItem): number | null {
  const v = e.priceToBook;
  return v != null && Number.isFinite(v) && v > 0 ? v : null;
}

function ecoPegOf(e: ThemeEcosystemWatchItem): number | null {
  const v = e.pegRatio;
  return v != null && Number.isFinite(v) && v > 0 ? v : null;
}

function ecoTrrOf(e: ThemeEcosystemWatchItem): number | null {
  const v = e.totalReturnYieldRatio;
  return v != null && Number.isFinite(v) ? v : null;
}

function ecoExpectedGrowthOf(e: ThemeEcosystemWatchItem): number | null {
  const v = e.expectedGrowth;
  return v != null && Number.isFinite(v) && v > 0 ? v : null;
}

function ecoEpsOf(e: ThemeEcosystemWatchItem): number | null {
  const v = e.trailingEps ?? e.forwardEps ?? null;
  return v != null && Number.isFinite(v) ? v : null;
}

function ecoForecastEpsOf(e: ThemeEcosystemWatchItem): number | null {
  const v = e.forwardEps;
  return v != null && Number.isFinite(v) ? v : null;
}

function ecoListingYmdKey(e: ThemeEcosystemWatchItem): string | null {
  const d = e.listingDate;
  if (d == null || String(d).trim().length < 10) return null;
  const ymd = String(d).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null;
}

function ecoEarningsSortValue(e: ThemeEcosystemWatchItem): number | null {
  const d = e.daysToEarnings;
  if (d == null || !Number.isFinite(d) || d < 0) return null;
  return d;
}

function ecoDividendSortScore(e: ThemeEcosystemWatchItem): number {
  const d = e.daysToExDividend;
  if (d == null || !Number.isFinite(d)) return 1e9;
  if (d >= 0) return d;
  return 20000 + d;
}

export type StructuralEcosystemSortOptions = {
  ecoSortKey: StructuralEcoSortKey;
  ecoSortDir: "asc" | "desc";
  ecoSortMode: "column" | "dip_rank" | "deep_value_rank";
};

/**
 * 構造テーマの Ecosystem ウォッチリストと同一の並び替え（`ThemeStructuralPageClient` 共有）。
 */
export function sortStructuralEcosystemWatchlist<T extends ThemeEcosystemWatchItem>(
  items: T[],
  opts: StructuralEcosystemSortOptions,
): T[] {
  const { ecoSortKey, ecoSortDir, ecoSortMode } = opts;
  const cmpStr = (a: string, b: string) => a.localeCompare(b, "ja");
  const cmpNum = (a: number | null, b: number | null) => {
    const ax = a == null || !Number.isFinite(a) ? null : a;
    const by = b == null || !Number.isFinite(b) ? null : b;
    if (ax == null && by == null) return 0;
    if (ax == null) return 1;
    if (by == null) return -1;
    return ax < by ? -1 : ax > by ? 1 : 0;
  };
  const dir = ecoSortDir === "asc" ? 1 : -1;
  const lastCumulativeAlpha = (e: ThemeEcosystemWatchItem) =>
    e.alphaHistory.length > 0 ? e.alphaHistory[e.alphaHistory.length - 1]! : null;
  const devZ = (e: ThemeEcosystemWatchItem) =>
    e.alphaDeviationZ != null && Number.isFinite(e.alphaDeviationZ) ? e.alphaDeviationZ : null;
  const ddOf = (e: ThemeEcosystemWatchItem) =>
    e.drawdownFromHigh90dPct != null && Number.isFinite(e.drawdownFromHigh90dPct)
      ? e.drawdownFromHigh90dPct
      : null;
  const absZ = (e: ThemeEcosystemWatchItem) => {
    const z = devZ(e);
    return z == null ? null : Math.abs(z);
  };

  function cmpNumDir(a: number | null, b: number | null, d: 1 | -1) {
    return d * cmpNum(a, b);
  }

  const arr = [...items];
  arr.sort((a, b) => {
    if (ecoSortMode === "dip_rank") {
      const c1 = cmpNumDir(ddOf(a), ddOf(b), 1);
      if (c1 !== 0) return c1;
      const c2 = cmpNumDir(absZ(a), absZ(b), 1);
      if (c2 !== 0) return c2;
      const c3 = cmpNumDir(a.latestAlpha, b.latestAlpha, -1);
      if (c3 !== 0) return c3;
      return cmpStr(a.ticker, b.ticker);
    }
    if (ecoSortMode === "deep_value_rank") {
      const c1 = cmpNumDir(devZ(a), devZ(b), 1);
      if (c1 !== 0) return c1;
      const c2 = cmpNumDir(ddOf(a), ddOf(b), 1);
      if (c2 !== 0) return c2;
      const c3 = cmpNumDir(a.latestAlpha, b.latestAlpha, -1);
      if (c3 !== 0) return c3;
      return cmpStr(a.ticker, b.ticker);
    }

    if (ecoSortKey === "asset") return dir * cmpStr(a.ticker, b.ticker);
    if (ecoSortKey === "lynch") {
      const ra = lynchCategorySortRank(getLynchCategoryFromWatchItem(a));
      const rb = lynchCategorySortRank(getLynchCategoryFromWatchItem(b));
      if (ra !== rb) return dir * (ra - rb);
      return dir * cmpStr(a.ticker, b.ticker);
    }
    if (ecoSortKey === "earnings") return dir * cmpNum(ecoEarningsSortValue(a), ecoEarningsSortValue(b));
    if (ecoSortKey === "listing")
      return dir * cmpStr(ecoListingYmdKey(a) ?? "\uFFFF", ecoListingYmdKey(b) ?? "\uFFFF");
    if (ecoSortKey === "mktCap") return dir * cmpNum(a.marketCap, b.marketCap);
    if (ecoSortKey === "perfListed") return dir * cmpNum(a.performanceSinceFoundation, b.performanceSinceFoundation);
    if (ecoSortKey === "judgment") {
      const ja = judgmentPriorityRank(a.judgmentStatus as JudgmentStatus);
      const jb = judgmentPriorityRank(b.judgmentStatus as JudgmentStatus);
      if (ja !== jb) return dir * (ja - jb);
      return dir * cmpStr(a.ticker, b.ticker);
    }
    if (ecoSortKey === "ruleOf40") return dir * cmpNum(ecoRuleOf40SortValue(a), ecoRuleOf40SortValue(b));
    if (ecoSortKey === "fcfYield") return dir * cmpNum(ecoFcfYieldSortValue(a), ecoFcfYieldSortValue(b));
    if (ecoSortKey === "netCash") return dir * cmpNum(ecoNetCashSortValue(a), ecoNetCashSortValue(b));
    if (ecoSortKey === "netCashYield") return dir * cmpNum(ecoNetCashYieldSortValue(a), ecoNetCashYieldSortValue(b));
    if (ecoSortKey === "pe") return dir * cmpNum(ecoPeOf(a), ecoPeOf(b));
    if (ecoSortKey === "pbr") return dir * cmpNum(ecoPbrOf(a), ecoPbrOf(b));
    if (ecoSortKey === "peg") return dir * cmpNum(ecoPegOf(a), ecoPegOf(b));
    if (ecoSortKey === "trr") return dir * cmpNum(ecoTrrOf(a), ecoTrrOf(b));
    if (ecoSortKey === "egrowth") return dir * cmpNum(ecoExpectedGrowthOf(a), ecoExpectedGrowthOf(b));
    if (ecoSortKey === "eps") return dir * cmpNum(ecoEpsOf(a), ecoEpsOf(b));
    if (ecoSortKey === "forecastEps") return dir * cmpNum(ecoForecastEpsOf(a), ecoForecastEpsOf(b));
    if (ecoSortKey === "alpha") return dir * cmpNum(a.latestAlpha, b.latestAlpha);
    if (ecoSortKey === "trend5d") return dir * cmpNum(lastDailyAlphaForTrendSort(a), lastDailyAlphaForTrendSort(b));
    if (ecoSortKey === "cumTrend") return dir * cmpNum(lastCumulativeAlpha(a), lastCumulativeAlpha(b));
    if (ecoSortKey === "volRatio") return dir * cmpNum(a.volumeRatio, b.volumeRatio);
    if (ecoSortKey === "price") return dir * cmpNum(a.currentPrice, b.currentPrice);
    if (ecoSortKey === "deviation") return dir * cmpNum(devZ(a), devZ(b));
    if (ecoSortKey === "drawdown") return dir * cmpNum(ddOf(a), ddOf(b));
    if (ecoSortKey === "dividend") {
      const c1 = cmpNum(ecoDividendSortScore(a), ecoDividendSortScore(b));
      if (c1 !== 0) return dir * c1;
      return dir * cmpNum(a.dividendYieldPercent, b.dividendYieldPercent);
    }
    if (ecoSortKey === "payout")
      return dir * cmpNum(ecosystemDividendPayoutPercent(a), ecosystemDividendPayoutPercent(b));
    if (ecoSortKey === "research") {
      const earnCmp = cmpNum(
        a.daysToEarnings != null && a.daysToEarnings >= 0 ? a.daysToEarnings : null,
        b.daysToEarnings != null && b.daysToEarnings >= 0 ? b.daysToEarnings : null,
      );
      if (earnCmp !== 0) return dir * earnCmp;
      const divEx = cmpNum(ecoDividendSortScore(a), ecoDividendSortScore(b));
      if (divEx !== 0) return dir * divEx;
      return dir * cmpNum(a.dividendYieldPercent, b.dividendYieldPercent);
    }
    if (ecoSortKey === "viScore") return dir * cmpNum(a.viScore, b.viScore);
    return 0;
  });
  return arr;
}
