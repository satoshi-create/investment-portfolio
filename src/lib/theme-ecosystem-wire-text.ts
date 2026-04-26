/**
 * theme-detail API の ecosystem 行から、任意テキスト列を正規化する。
 * JSON の型ゆれ（数値・その他）や camel / snake の両方に耐性を持たせる。
 */
export function themeEcosystemWireText(
  rec: Record<string, unknown>,
  camelKey: string,
  snakeKey?: string,
): string | null {
  const raw = rec[camelKey] ?? (snakeKey != null ? rec[snakeKey] : undefined);
  if (raw == null) return null;
  if (typeof raw === "string") {
    const t = raw.trim();
    return t.length > 0 ? t : null;
  }
  const t = String(raw).trim();
  return t.length > 0 ? t : null;
}
