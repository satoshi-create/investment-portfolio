/**
 * `theme_ecosystem_members.observation_notes` のキー:value 風テキストから
 * `chip: …` を抽出（Magnificent Architects の独自チップバッジ等）。
 */
export function extractChipLabelFromObservationNotes(notes: string | null | undefined): string | null {
  if (notes == null) return null;
  const s = notes.trim();
  if (s.length === 0) return null;
  const m = s.match(/\bchip:\s*([^,\n]+)/i);
  const raw = m?.[1]?.trim();
  return raw && raw.length > 0 ? raw : null;
}
