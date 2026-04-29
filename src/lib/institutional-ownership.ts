/**
 * 機関投資家保有率（0–1 小数）のUI・フィルタ判定。
 * Yahoo パースは `src/lib/price-service.ts`（`EquityResearchSnapshot`）に集約。
 */

/** リンチ系「真空センサー」3区分 + 中間帯（0.3–0.6）。 */
export type InstitutionalOwnershipBand = "hidden" | "early" | "mid" | "crowded";

export function institutionalOwnershipBand(ownership: number | null): InstitutionalOwnershipBand {
  if (ownership == null || ownership === 0) return "hidden";
  if (ownership > 0.6) return "crowded";
  if (ownership < 0.3) return "early";
  return "mid";
}

/**
 * テーブル「不人気株（真空地帯）のみ表示」: null 含有、または 30% 未満。
 * （Early / Hidden に相当する帯。）
 */
export function stockMatchesVacuumUnpopularFilter(ownership: number | null): boolean {
  return ownership == null || ownership < 0.3;
}
