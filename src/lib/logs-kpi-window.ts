import { DEFAULT_AGGREGATE_KPI_WINDOW_DAYS } from "@/src/lib/portfolio-aggregate-kpis";

/** ログ画面の「KPI 履歴（DB）」で切り替え可能な暦日窓（`kpiWindowDays` query / localStorage）。 */
export const LOGS_KPI_WINDOW_DAYS_OPTIONS = [7, 14, 21, 30, 45, 60, 90] as const;

export function normalizeLogsKpiWindowDays(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_AGGREGATE_KPI_WINDOW_DAYS;
  const t = Math.trunc(n);
  if ((LOGS_KPI_WINDOW_DAYS_OPTIONS as readonly number[]).includes(t)) return t;
  return DEFAULT_AGGREGATE_KPI_WINDOW_DAYS;
}
