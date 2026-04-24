import { roundAlphaMetric } from "@/src/lib/alpha-logic";
import type { PortfolioDailySnapshotRow } from "@/src/types/investment";

/**
 * 記録 `alpha_vs_prev_pct`、無い場合は `portfolio_return_vs_prev − benchmark_return_vs_prev`（`dashboard-data` のスナップ平均と同方針）。
 */
export function effectiveAlphaVsPrevPct(r: PortfolioDailySnapshotRow): number | null {
  if (r.alphaVsPrevPct != null && Number.isFinite(r.alphaVsPrevPct)) return r.alphaVsPrevPct;
  const pr = r.portfolioReturnVsPrevPct;
  const br = r.benchmarkReturnVsPrevPct;
  if (pr != null && br != null && Number.isFinite(pr) && Number.isFinite(br)) {
    return roundAlphaMetric(pr - br);
  }
  return null;
}
