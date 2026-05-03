/**
 * 「風が吹けば桶屋が儲かる（テンバーガー候補研究）」テーマ
 * URL: `/themes/okeya-flow` → `mapThemeLabelForQuery` で DB の `investment_themes.name` と一致させる。
 */

import { OKEYA_FLOW_ENTRIES, type OkeyaFlowEntry } from "@/constants/okeyaFlow";

export const OKEYA_FLOW_THEME_SLUG = "okeya-flow";

/** `investment_themes.name`・theme-detail API の `theme` パラメータと一致させる */
export const OKEYA_FLOW_THEME_QUERY_NAME = "風が吹けば桶屋が儲かる（テンバーガー候補研究）";

export const OKEYA_FLOW_THEME_ID = "theme-seed-okeya-flow" as const;

export function isOkeyaFlowThemePage(
  themeLabel: string,
  theme: { id: string; name?: string | null } | null,
): boolean {
  const raw = themeLabel.trim();
  const lower = raw.toLowerCase();
  if (lower === OKEYA_FLOW_THEME_SLUG) return true;
  if (raw === OKEYA_FLOW_THEME_QUERY_NAME) return true;
  if (theme?.id === OKEYA_FLOW_THEME_ID) return true;
  const nm = theme?.name != null ? theme.name.trim() : "";
  if (nm.length > 0 && nm === OKEYA_FLOW_THEME_QUERY_NAME) return true;
  return false;
}

/** `7532.T` / `7532` などを定数側のコード（7532）に揃える */
export function normalizeTickerForOkeyaLookup(ticker: string): string {
  const t = ticker.trim().toUpperCase();
  if (t.endsWith(".T")) return t.slice(0, -2);
  return t;
}

export function lookupOkeyaFlowEntryForTicker(ticker: string): OkeyaFlowEntry | null {
  const key = normalizeTickerForOkeyaLookup(ticker);
  for (const entry of OKEYA_FLOW_ENTRIES) {
    if (entry.ticker.toUpperCase() === key) return entry;
  }
  return null;
}
