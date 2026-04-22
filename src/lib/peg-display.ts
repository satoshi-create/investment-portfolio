/** PEG 列の表示（リンチ式バンドの色分け）。 */

export function fmtPegRatio(peg: number | null): string {
  if (peg == null || !Number.isFinite(peg)) return "N/A";
  return peg >= 10 ? peg.toFixed(1) : peg.toFixed(2);
}

/** PEG < 1 掘り出し物 / 1–2 適正 / ≥2 割高 */
export function pegRatioTextClass(peg: number | null): string {
  if (peg == null || !Number.isFinite(peg)) return "text-muted-foreground";
  if (peg < 1) return "text-sky-400 font-bold";
  if (peg < 2) return "text-foreground";
  return "text-rose-400 font-bold";
}
