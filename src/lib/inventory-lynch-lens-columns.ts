/**
 * Inventory の「リンチレンズ」: ツールバーで分類（または未分類）を選んだときの列セット。
 * ユーザーの列順・localStorage の並びには依存せず、一覧性優先の固定順。
 */
import type { LynchCategory } from "@/src/types/investment";
import type { InventoryColId } from "@/src/lib/inventory-column-order";

const LYNCH_LENS_BASE: readonly InventoryColId[] = ["bookmark", "asset", "lynch"];

export type InventoryLynchLensKey = LynchCategory | "__unset__";

/** 各キー 6〜10 列程度（bookmark+asset+lynch + 指標） */
export const INVENTORY_LYNCH_LENS_COLUMNS: Record<InventoryLynchLensKey, readonly InventoryColId[]> = {
  __unset__: [...LYNCH_LENS_BASE, "egrowth", "pe", "eps", "forecastEps", "judgment", "position", "price"],
  FastGrower: [...LYNCH_LENS_BASE, "egrowth", "peg", "pe", "ruleOf40", "alpha", "position", "price"],
  Turnaround: [...LYNCH_LENS_BASE, "eps", "forecastEps", "egrowth", "pe", "judgment", "earnings", "alpha", "position"],
  Stalwart: [...LYNCH_LENS_BASE, "mktCap", "egrowth", "pe", "trr", "fcfYield", "judgment", "position", "price"],
  SlowGrower: [...LYNCH_LENS_BASE, "research", "trr", "pe", "pbr", "egrowth", "position", "price"],
  Cyclical: [...LYNCH_LENS_BASE, "pe", "pbr", "egrowth", "judgment", "perfListed", "volRatio", "alpha", "position"],
  AssetPlay: [...LYNCH_LENS_BASE, "pbr", "netCash", "netCps", "pe", "judgment", "position", "price"],
};

export function inventoryLynchLensKeyFromFilter(
  lynchFilter: "" | "__unset__" | LynchCategory,
): InventoryLynchLensKey | null {
  if (lynchFilter === "") return null;
  if (lynchFilter === "__unset__") return "__unset__";
  return lynchFilter;
}
