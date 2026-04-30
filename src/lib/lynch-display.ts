/**
 * リンチ列の「表示・フィルタ・集計」用の有効分類。
 * ルールベース自動分類を優先し、未分類（null）のときだけ DB の expectation_category を補完する。
 */
import type { LynchCategoryCountSnapshot } from "@/src/lib/lynch-category-computed";
import {
  getLynchCategory,
  getLynchCategoryFromWatchItem,
} from "@/src/lib/lynch-category-computed";
import type { LynchCategory, Stock, ThemeEcosystemWatchItem } from "@/src/types/investment";
import { LYNCH_CATEGORY_KEYS } from "@/src/types/investment";

export function getEffectiveLynchCategoryForStock(stock: Stock): LynchCategory | null {
  return getLynchCategory(stock) ?? stock.expectationCategory;
}

export function getEffectiveLynchCategoryForWatchItem(item: ThemeEcosystemWatchItem): LynchCategory | null {
  return getLynchCategoryFromWatchItem(item) ?? item.expectationCategory;
}

export function aggregateEffectiveLynchCategoryCounts(stocks: readonly Stock[]): LynchCategoryCountSnapshot {
  let unset = 0;
  const byCategory = Object.fromEntries(LYNCH_CATEGORY_KEYS.map((k) => [k, 0])) as Record<LynchCategory, number>;
  for (const s of stocks) {
    const c = getEffectiveLynchCategoryForStock(s);
    if (c == null) unset += 1;
    else byCategory[c] += 1;
  }
  return { total: stocks.length, unset, byCategory };
}

export function aggregateEffectiveLynchCategoryCountsForWatchItems(
  items: readonly ThemeEcosystemWatchItem[],
): LynchCategoryCountSnapshot {
  let unset = 0;
  const byCategory = Object.fromEntries(LYNCH_CATEGORY_KEYS.map((k) => [k, 0])) as Record<LynchCategory, number>;
  for (const e of items) {
    const c = getEffectiveLynchCategoryForWatchItem(e);
    if (c == null) unset += 1;
    else byCategory[c] += 1;
  }
  return { total: items.length, unset, byCategory };
}
