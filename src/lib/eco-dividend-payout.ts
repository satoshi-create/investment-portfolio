import type { ThemeEcosystemWatchItem } from "@/src/types/investment";

/**
 * 配当性向（%）= 1株当たり年間配当 ÷ TTM EPS × 100。
 * Yahoo 由来。分母は `trailingEps`（TTM）が正のときのみ。
 */
export function ecosystemDividendPayoutPercent(
  e: Pick<ThemeEcosystemWatchItem, "annualDividendRate" | "trailingEps">,
): number | null {
  const dps = e.annualDividendRate;
  const eps = e.trailingEps;
  if (dps == null || !Number.isFinite(dps) || dps <= 0) return null;
  if (eps == null || !Number.isFinite(eps) || eps <= 0) return null;
  return (dps / eps) * 100;
}

export function formatDividendPayoutPercent(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v >= 100 ? `${v.toFixed(0)}%` : `${v.toFixed(1)}%`;
}

export function dividendPayoutCellClassName(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "text-muted-foreground";
  if (v > 100) return "text-rose-300";
  if (v > 80) return "text-amber-300";
  return "text-foreground";
}
