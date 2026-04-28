import type { CSSProperties } from "react";

/** `InventoryTable` がストーリーパネルを開いたとき、`document.documentElement` にセットする（px または `0px`）。 */
export const STORY_PANEL_INSET_VAR = "--story-panel-inset";

/** メインコンテンツの中央寄せラッパーに付け、`fixed` 右パネルと座標を揃える。 */
export const storyPanelInsetPageStyle: CSSProperties = {
  paddingRight: `var(${STORY_PANEL_INSET_VAR}, 0px)`,
};

export const STORY_PANEL_PAGE_PAD_TRANSITION_CLASS =
  "transition-[padding,max-width,width,margin-inline] duration-300 ease-out";

/** メインコンテンツの中央寄せラッパーに付与（パネル開時に globals.css で幅を解放する） */
export const STORY_PANEL_PAGE_SHELL_CLASS = "story-panel-page-shell";
