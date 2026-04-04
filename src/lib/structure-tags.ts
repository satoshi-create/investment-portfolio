import type { StructureTagSlice } from "@/src/types/investment";

/** Parse `holdings.structure_tags` JSON array of strings. */
export function parseStructureTags(structureTagsJson: string): string[] {
  try {
    const parsed: unknown = JSON.parse(structureTagsJson);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((s) => s.trim());
  } catch {
    return [];
  }
}

/** Parse holdings.structure_tags JSON array; first tag for display, or fallback. */
export function primaryStructureTag(structureTagsJson: string, fallback = "—"): string {
  const tags = parseStructureTags(structureTagsJson);
  return tags[0] ?? fallback;
}

const OTHER_TAG = "その他";

/** Non-negative finite market values only (missing / invalid price → 0, avoids NaN in totals). */
export function sanitizeMarketValueForAggregation(v: number): number {
  if (!Number.isFinite(v) || v < 0) return 0;
  return v;
}

/**
 * プライマリタグ（配列の先頭）ごとに評価額を合算し、ポートフォリオ全体に対する比率 % を返す。
 * タグ無しは「その他」に寄せる。分母は行ごとの評価額のサニタイズ済み合計（0 除算しない）。
 */
export function aggregateByPrimaryStructureTag(
  rows: Array<{ structureTagsJson: string; marketValue: number }>,
): StructureTagSlice[] {
  const byTag = new Map<string, number>();
  for (const r of rows) {
    const mv = sanitizeMarketValueForAggregation(r.marketValue);
    const tags = parseStructureTags(r.structureTagsJson);
    const key = tags.length > 0 ? tags[0]! : OTHER_TAG;
    byTag.set(key, (byTag.get(key) ?? 0) + mv);
  }

  const total = [...byTag.values()].reduce((a, b) => a + b, 0);
  const safeTotal = total > 0 && Number.isFinite(total) ? total : 0;
  const slices: StructureTagSlice[] = [...byTag.entries()]
    .map(([tag, marketValue]) => ({
      tag,
      marketValue,
      weightPercent:
        safeTotal > 0 ? Math.round((marketValue / safeTotal) * 10000) / 100 : 0,
    }))
    .sort((a, b) => b.marketValue - a.marketValue);

  return slices;
}
