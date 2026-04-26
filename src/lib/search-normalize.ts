/**
 * 検索入力の正規化（全角半角・互換文字の揃え）。未対応環境では trim のみ。
 */
export function normalizeSearchQuery(raw: string): string {
  const t = raw.trim();
  if (t.length === 0) return "";
  try {
    return t.normalize("NFKC").trim().toLowerCase();
  } catch {
    return t.toLowerCase();
  }
}
