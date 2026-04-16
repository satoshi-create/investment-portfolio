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

/** `structure_tags` の先頭 = 構造投資テーマ（未設定は fallback）。 */
export function themeFromStructureTags(structureTagsJson: string, fallback = "—"): string {
  const tags = parseStructureTags(structureTagsJson);
  return tags[0] ?? fallback;
}

/** テーマ詳細の選択名と保有 `structure_tags[0]` が同じテーマか（リネーム時の旧名を許容） */
export function portfolioThemeTagMatchesThemePage(
  portfolioThemeTag: string,
  pageTheme: string,
): boolean {
  const p = portfolioThemeTag.trim();
  const t = pageTheme.trim();
  if (p === t) return true;
  if (t === "半導体サプライチェーン" && p === "半導体製造装置") return true;
  return false;
}

/** `structure_tags` の 2 番目 = セクター（タグ上の値。未設定は fallback）。 */
export function sectorFromStructureTags(structureTagsJson: string, fallback = "Other"): string {
  const tags = parseStructureTags(structureTagsJson);
  return tags[1] ?? fallback;
}

const OTHER_THEME = "その他";

/** Theme / Sector 入力から `structure_tags` JSON を生成（[0]=テーマ、[1]=セクター）。 */
export function structureTagsJsonFromThemeSector(theme: string, sector: string): string {
  const t = theme.trim();
  const s = sector.trim();
  if (!t && !s) return "[]";
  if (t && s) return JSON.stringify([t, s]);
  if (t) return JSON.stringify([t]);
  return JSON.stringify([OTHER_THEME, s]);
}

/** DB `holdings.sector` があればそれを、無ければ `structure_tags` の 2 番目（なければ fallback）。 */
export function holdingSectorKey(
  sectorColumn: string | null | undefined,
  structureTagsJson: string,
  fallback = "Other",
): string {
  const col = sectorColumn != null ? String(sectorColumn).trim() : "";
  if (col.length > 0) return col;
  return sectorFromStructureTags(structureTagsJson, fallback);
}

/** スナップショット等: `sector` 列とタグ由来セクター文字列の表示用マージ。 */
export function holdingSectorDisplay(
  sectorColumn: string | null | undefined,
  sectorFromTags: string,
): string {
  const col = sectorColumn != null ? String(sectorColumn).trim() : "";
  if (col.length > 0) return col;
  return sectorFromTags;
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
 * 構造投資テーマ（`structure_tags` 先頭）ごとに評価額・銘柄数を合算。
 * テーマ無しは「その他」に寄せる。
 */
export function aggregateByTheme(
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
 * `structure_tags` の 2 番目（セクター）ごとに評価額・銘柄数を合算。
 * 未設定は `sectorFromStructureTags` と同じく "Other"。
 */
export function aggregateBySector(
  rows: Array<{ structureTagsJson: string; marketValue: number }>,
): StructureTagSlice[] {
  const byTag = new Map<string, TagAgg>();
  for (const r of rows) {
    const mv = sanitizeMarketValueForAggregation(r.marketValue);
    const key = sectorFromStructureTags(r.structureTagsJson);
    const cur = byTag.get(key) ?? { marketValue: 0, count: 0 };
    cur.marketValue += mv;
    cur.count += 1;
    byTag.set(key, cur);
  }
  return finalizeSlices(byTag);
}

/**
 * `holdings.sector` を優先し、空なら `structure_tags` の 2 番目でキー化して集計（セクターバランス用）。
 * `StructureTagSlice.weightPercent` は **時価評価額（marketValue）ベース**（銘柄数ではない）。
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
