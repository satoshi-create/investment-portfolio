/** URL スラッグから `investment_themes.name` / テーマ詳細 API の query へ解決する。 */
export const MAGNIFICENT_ARCHITECTS_THEME_SLUG = "magnificent-architects";

/** `investment_themes.name` と一致させる（`fetchInvestmentThemeRecord` の trim 一致）。 */
export const MAGNIFICENT_ARCHITECTS_THEME_QUERY_NAME = "Magnificent Architects（推論主権の覇者）";

export const MAGNIFICENT_ARCHITECTS_THEME_ID = "theme-seed-magnificent-architects" as const;

/** テーマページ `themeLabel`（URL）または DB の id / name で Magnificent Architects か。 */
export function isMagnificentArchitectsThemePage(
  themeLabel: string,
  theme: { id: string; name?: string | null } | null,
): boolean {
  const raw = themeLabel.trim();
  const lower = raw.toLowerCase();
  if (lower === MAGNIFICENT_ARCHITECTS_THEME_SLUG) return true;
  if (raw === MAGNIFICENT_ARCHITECTS_THEME_QUERY_NAME) return true;
  if (theme?.id === MAGNIFICENT_ARCHITECTS_THEME_ID) return true;
  const nm = theme?.name != null ? theme.name.trim() : "";
  if (nm.length > 0 && nm === MAGNIFICENT_ARCHITECTS_THEME_QUERY_NAME) return true;
  return false;
}
