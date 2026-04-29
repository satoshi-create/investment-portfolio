import type { LynchCategory } from "@/src/types/investment";
import type { InventoryColId } from "@/src/lib/inventory-column-order";

/** `lynchFilter` がリンチレンズ ON のときのみ（`""` は対象外） */
export type InventoryLynchLensUiFilterKey = LynchCategory | "__unset__";

export type InventoryLynchLensColumnUiSlice = {
  extras: InventoryColId[];
  hidden: InventoryColId[];
};

export type InventoryLynchLensColumnUiByFilter = Partial<
  Record<InventoryLynchLensUiFilterKey, InventoryLynchLensColumnUiSlice>
>;

/** レンズ中: 分類ローカルな非表示と、従来どおりのグローバル非表示を合成 */
export function mergeInventoryLynchLensHiddenForDisplay(
  lensHidden: readonly InventoryColId[],
  globalHidden: readonly InventoryColId[],
): InventoryColId[] {
  if (lensHidden.length === 0) return [...globalHidden];
  if (globalHidden.length === 0) return [...lensHidden];
  const s = new Set<InventoryColId>(lensHidden);
  for (const id of globalHidden) s.add(id);
  return [...s];
}
