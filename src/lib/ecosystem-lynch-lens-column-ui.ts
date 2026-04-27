import type { LynchCategory } from "@/src/types/investment";
import type { EcosystemWatchlistColId } from "@/src/lib/ecosystem-watchlist-column-order";

/** `ecoLynchFilter` がリンチレンズ ON のときのみ（`""` は対象外） */
export type EcoLynchLensUiFilterKey = LynchCategory | "__unset__";

export type EcoLynchLensColumnUiSlice = {
  extras: EcosystemWatchlistColId[];
  hidden: EcosystemWatchlistColId[];
};

export type EcoLynchLensColumnUiByFilter = Partial<Record<EcoLynchLensUiFilterKey, EcoLynchLensColumnUiSlice>>;

/** レンズ中: 分類ローカルな非表示と、従来どおりのグローバル非表示を合成 */
export function mergeEcosystemLynchLensHiddenForDisplay(
  lensHidden: readonly EcosystemWatchlistColId[],
  globalHidden: readonly EcosystemWatchlistColId[],
): EcosystemWatchlistColId[] {
  if (lensHidden.length === 0) return [...globalHidden];
  if (globalHidden.length === 0) return [...lensHidden];
  const s = new Set<EcosystemWatchlistColId>(lensHidden);
  for (const id of globalHidden) s.add(id);
  return [...s];
}
