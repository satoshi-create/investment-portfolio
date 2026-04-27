import type { LynchCategory, Stock, ThemeEcosystemWatchItem } from "@/src/types/investment";
import { LYNCH_CATEGORY_LABEL_JA } from "@/src/types/investment";
import { lynchCategorySortRank } from "@/src/lib/expectation-category";
import { getLynchCategory, getLynchCategoryFromWatchItem } from "@/src/lib/lynch-category-computed";

/** インべントリのバッジ色に近い塗り（recharts 用） */
export const LYNCH_PIE_FILL: Record<LynchCategory, string> = {
  SlowGrower: "#64748b",
  Stalwart: "#38bdf8",
  FastGrower: "#34d399",
  AssetPlay: "#fbbf24",
  Cyclical: "#a78bfa",
  Turnaround: "#fb923c",
};
export const LYNCH_PIE_UNSET = "#475569";

export type LynchPieRow = {
  key: string;
  name: string;
  value: number;
  fill: string;
  pct: number;
  count: number;
};

/** Strategy / テーマ保有と同じ母集団: 数量 > 0 かつ評価額あり。分類は getLynchCategory（ルールベース）。 */
export function buildLynchPieRows(stocks: Stock[]): LynchPieRow[] {
  const rows = stocks.filter(
    (s) => s.quantity > 0 && Number.isFinite(s.marketValue) && s.marketValue > 0,
  );
  if (rows.length === 0) return [];

  const byKey = new Map<string, { mv: number; count: number }>();
  for (const s of rows) {
    const k = getLynchCategory(s) ?? "__unset__";
    const cur = byKey.get(k) ?? { mv: 0, count: 0 };
    cur.mv += s.marketValue;
    cur.count += 1;
    byKey.set(k, cur);
  }
  const total = [...byKey.values()].reduce((acc, x) => acc + x.mv, 0);
  if (total <= 0) return [];

  const out: LynchPieRow[] = [];
  for (const [key, { mv, count }] of byKey) {
    const pct = (mv / total) * 100;
    let name: string;
    let fill: string;
    if (key === "__unset__") {
      name = "未分類";
      fill = LYNCH_PIE_UNSET;
    } else {
      name = LYNCH_CATEGORY_LABEL_JA[key as LynchCategory];
      fill = LYNCH_PIE_FILL[key as LynchCategory];
    }
    out.push({ key, name, value: mv, fill, pct, count });
  }
  out.sort(
    (a, b) =>
      lynchCategorySortRank(a.key === "__unset__" ? null : (a.key as LynchCategory)) -
      lynchCategorySortRank(b.key === "__unset__" ? null : (b.key as LynchCategory)),
  );
  return out;
}

/**
 * 観測ウォッチ 1 行の円グラフ用ウェイト（相対比のみに使用）。
 * 時価総額（marketCap）→ 直近ラウンド評価額（lastRoundValuation）→ 等重み 1 の順。
 */
export function watchItemPieWeight(e: ThemeEcosystemWatchItem): number {
  const mc = e.marketCap;
  if (mc != null && Number.isFinite(mc) && mc > 0) return mc;
  const lr = e.lastRoundValuation;
  if (lr != null && Number.isFinite(lr) && lr > 0) return lr;
  return 1;
}

/**
 * テーマ観測エコシステム行からリンチ円用の行を構築する。
 * 分類は `getLynchCategoryFromWatchItem`（ルールベース）。DB `expectation_category` は使わない。
 */
export function buildLynchPieRowsFromWatchItems(items: readonly ThemeEcosystemWatchItem[]): LynchPieRow[] {
  if (items.length === 0) return [];

  const byKey = new Map<string, { w: number; count: number }>();
  for (const e of items) {
    const w = watchItemPieWeight(e);
    const k = getLynchCategoryFromWatchItem(e) ?? "__unset__";
    const cur = byKey.get(k) ?? { w: 0, count: 0 };
    cur.w += w;
    cur.count += 1;
    byKey.set(k, cur);
  }
  const total = [...byKey.values()].reduce((acc, x) => acc + x.w, 0);
  if (total <= 0) return [];

  const out: LynchPieRow[] = [];
  for (const [key, { w, count }] of byKey) {
    const pct = (w / total) * 100;
    let name: string;
    let fill: string;
    if (key === "__unset__") {
      name = "未分類";
      fill = LYNCH_PIE_UNSET;
    } else {
      name = LYNCH_CATEGORY_LABEL_JA[key as LynchCategory];
      fill = LYNCH_PIE_FILL[key as LynchCategory];
    }
    out.push({ key, name, value: w, fill, pct, count });
  }
  out.sort(
    (a, b) =>
      lynchCategorySortRank(a.key === "__unset__" ? null : (a.key as LynchCategory)) -
      lynchCategorySortRank(b.key === "__unset__" ? null : (b.key as LynchCategory)),
  );
  return out;
}
