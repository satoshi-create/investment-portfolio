/** PEG 列の表示（リンチ式バンドの色分け）。 */

export function fmtPegRatio(peg: number | null): string {
  if (peg == null || !Number.isFinite(peg)) return "N/A";
  return peg >= 10 ? peg.toFixed(1) : peg.toFixed(2);
}

/** `expectedGrowth` 小数（0.15 = 15%）をパーセント表示。未取得は N/A */
export function fmtExpectedGrowthPercent(decimal: number | null): string {
  if (decimal == null || !Number.isFinite(decimal) || decimal <= 0) return "N/A";
  const pct = decimal * 100;
  return `${pct >= 10 ? pct.toFixed(1) : pct.toFixed(2)}%`;
}

/** PEG < 1 掘り出し物 / 1–2 適正 / ≥2 割高 */
export function pegRatioTextClass(peg: number | null): string {
  if (peg == null || !Number.isFinite(peg)) return "text-muted-foreground";
  if (peg < 1) return "text-sky-400 font-bold";
  if (peg < 2) return "text-foreground";
  return "text-rose-400 font-bold";
}

export function fmtTotalReturnYieldRatio(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "N/A";
  return v >= 10 ? v.toFixed(1) : v.toFixed(2);
}

/** TRR > 2: 小判色（割安・高還元・高成長の目安帯） */
export function totalReturnYieldRatioTextClass(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "text-muted-foreground";
  if (v > 2) return "text-amber-400 font-semibold bg-amber-500/15 rounded px-0.5";
  return "text-foreground";
}

/** PEG < 1 の「お宝」アイコン表示用（有限かつ正の PEG） */
export function pegLynchTreasureEligible(peg: number | null): boolean {
  return peg != null && Number.isFinite(peg) && peg > 0 && peg < 1;
}

/** PEG ≤ 0.5 のテンバガー候補バッジ（PEG が算出されている行のみ） */
export function pegLynchTenbaggerEligible(peg: number | null): boolean {
  return peg != null && Number.isFinite(peg) && peg > 0 && peg <= 0.5;
}
