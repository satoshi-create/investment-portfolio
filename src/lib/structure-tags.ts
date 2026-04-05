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

/** Second tag as provisional industry / sub-category (dashboard accounting view). */
export function secondaryStructureTag(structureTagsJson: string, fallback = "Other"): string {
  const tags = parseStructureTags(structureTagsJson);
  return tags[1] ?? fallback;
}

/** DB `holdings.sector` があればそれを、無ければ `structure_tags` の 2 番目（なければ fallback）。 */
export function holdingSectorKey(
  sectorColumn: string | null | undefined,
  structureTagsJson: string,
  fallback = "Other",
): string {
  const s = sectorColumn != null ? String(sectorColumn).trim() : "";
  if (s.length > 0) return s;
  return secondaryStructureTag(structureTagsJson, fallback);
}

/** スナップショット等: 既に算出済みのセカンダリタグ文字列と `sector` 列の優先表示。 */
export function holdingSectorDisplay(
  sectorColumn: string | null | undefined,
  secondaryFromStructureTags: string,
): string {
  const s = sectorColumn != null ? String(sectorColumn).trim() : "";
  if (s.length > 0) return s;
  return secondaryFromStructureTags;
}

const OTHER_TAG = "その他";

type TagAgg = { marketValue: number; count: number };

/** Non-negative finite market values only (missing / invalid price → 0, avoids NaN in totals). */
export function sanitizeMarketValueForAggregation(v: number): number {
  if (!Number.isFinite(v) || v < 0) return 0;
  return v;
}

function finalizeSlices(byTag: Map<string, TagAgg>): StructureTagSlice[] {
  const total = [...byTag.values()].reduce((a, b) => a + b.marketValue, 0);
  const safeTotal = total > 0 && Number.isFinite(total) ? total : 0;
  return [...byTag.entries()]
    .map(([tag, agg]) => ({
      tag,
      marketValue: agg.marketValue,
      count: agg.count,
      weightPercent:
        safeTotal > 0 ? Math.round((agg.marketValue / safeTotal) * 10000) / 100 : 0,
    }))
    .sort((a, b) => b.marketValue - a.marketValue);
}

/**
 * プライマリタグ（配列の先頭）ごとに評価額・銘柄数を合算し、ポートフォリオ全体に対する比率 % を返す。
 * タグ無しは「その他」に寄せる。
 */
export function aggregateByPrimaryStructureTag(
  rows: Array<{ structureTagsJson: string; marketValue: number }>,
): StructureTagSlice[] {
  const byTag = new Map<string, TagAgg>();
  for (const r of rows) {
    const mv = sanitizeMarketValueForAggregation(r.marketValue);
    const tags = parseStructureTags(r.structureTagsJson);
    const key = tags.length > 0 ? tags[0]! : OTHER_TAG;
    const cur = byTag.get(key) ?? { marketValue: 0, count: 0 };
    cur.marketValue += mv;
    cur.count += 1;
    byTag.set(key, cur);
  }
  return finalizeSlices(byTag);
}

/**
 * セカンダリタグ（配列の 2 番目）ごとに評価額・銘柄数を合算。未設定は `secondaryStructureTag` と同じく "Other"。
 */
export function aggregateBySecondaryStructureTag(
  rows: Array<{ structureTagsJson: string; marketValue: number }>,
): StructureTagSlice[] {
  const byTag = new Map<string, TagAgg>();
  for (const r of rows) {
    const mv = sanitizeMarketValueForAggregation(r.marketValue);
    const key = secondaryStructureTag(r.structureTagsJson);
    const cur = byTag.get(key) ?? { marketValue: 0, count: 0 };
    cur.marketValue += mv;
    cur.count += 1;
    byTag.set(key, cur);
  }
  return finalizeSlices(byTag);
}

/**
 * `holdings.sector` を優先し、空なら `structure_tags` の 2 番目でキー化して集計（ダッシュボード「セクター」パネル用）。
 */
export function aggregateByHoldingSector(
  rows: Array<{ sector: string | null | undefined; structureTagsJson: string; marketValue: number }>,
): StructureTagSlice[] {
  const byTag = new Map<string, TagAgg>();
  for (const r of rows) {
    const mv = sanitizeMarketValueForAggregation(r.marketValue);
    const key = holdingSectorKey(r.sector ?? null, r.structureTagsJson);
    const cur = byTag.get(key) ?? { marketValue: 0, count: 0 };
    cur.marketValue += mv;
    cur.count += 1;
    byTag.set(key, cur);
  }
  return finalizeSlices(byTag);
}
