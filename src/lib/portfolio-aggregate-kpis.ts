/**
 * Rolling window portfolio KPIs stored at each snapshot (see `migrations/044_portfolio_aggregate_kpis.sql`).
 * Stat math mirrors `buildSnapshotStats` in `PortfolioSnapshotsTable` + `effectiveAlphaVsPrevPct`.
 */

import type { Client } from "@libsql/client";

import { roundAlphaMetric } from "@/src/lib/alpha-logic";
import { parseMarketGlancePayload } from "@/src/lib/market-indicators-json";
import { effectiveAlphaVsPrevPct } from "@/src/lib/portfolio-snapshot-alpha";
import type { AggregateKpiImportRow } from "@/src/lib/csv-aggregate-kpis";
import type { PortfolioAggregateKPI, PortfolioDailySnapshotRow } from "@/src/types/investment";

export const DEFAULT_AGGREGATE_KPI_WINDOW_DAYS = 30;

function numOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function intOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function isSqliteMissingColumn(e: unknown, column: string): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.toLowerCase().includes("no such column") && msg.toLowerCase().includes(column.toLowerCase());
}

function mapSnapshotRow(r: Record<string, unknown>): PortfolioDailySnapshotRow {
  const base: PortfolioDailySnapshotRow = {
    id: String(r.id),
    userId: String(r.user_id),
    snapshotDate: String(r.snapshot_date),
    recordedAt: String(r.recorded_at),
    fxUsdJpy: Number(r.fx_usd_jpy),
    benchmarkTicker: String(r.benchmark_ticker),
    benchmarkClose: numOrNull(r.benchmark_close),
    benchmarkChangePct: numOrNull(r.benchmark_change_pct),
    totalMarketValueJpy: Number(r.total_market_value_jpy),
    totalUnrealizedPnlJpy: numOrNull(r.total_unrealized_pnl_jpy),
    totalProfitJpy: numOrNull(r.total_profit),
    costBasisJpy: numOrNull(r.cost_basis),
    holdingsCount: intOrNull(r.holdings_count),
    holdingsAddedCount: intOrNull(r.holdings_added_count),
    holdingsRemovedCount: intOrNull(r.holdings_removed_count),
    holdingsContinuingCount: intOrNull(r.holdings_continuing_count),
    nonEtfListedEquityQuantityTotal: numOrNull(r.non_etf_listed_equity_quantity_total),
    portfolioAvgAlpha: numOrNull(r.portfolio_avg_alpha),
    portfolioReturnVsPrevPct: numOrNull(r.portfolio_return_vs_prev_pct),
    benchmarkReturnVsPrevPct: numOrNull(r.benchmark_return_vs_prev_pct),
    alphaVsPrevPct: numOrNull(r.alpha_vs_prev_pct),
  };
  const raw = r.market_indicators_json;
  if (typeof raw === "string" && raw.length > 0) {
    base.marketIndicatorsJson = raw;
    const mi = parseMarketGlancePayload(raw);
    if (mi !== undefined) base.marketIndicators = mi;
  }
  return base;
}

function compareSnapshotDate(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true });
}

function finiteNumbers<T>(items: T[], pick: (row: T) => number | null | undefined): number[] {
  const out: number[] = [];
  for (const row of items) {
    const v = pick(row);
    if (v != null && Number.isFinite(v)) out.push(v);
  }
  return out;
}

function average(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/** Inclusive calendar window: [asOf − (windowDays−1), asOf] in UTC YMD. */
export function periodStartYmdForWindow(asOfYmd: string, windowDays: number): string {
  const d = new Date(`${asOfYmd}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - (windowDays - 1));
  return d.toISOString().slice(0, 10);
}

/**
 * Same semantics as `buildSnapshotStats` in `PortfolioSnapshotsTable` (deltas: oldest→newest in set).
 */
export function computePortfolioAggregateStatsFromRows(
  rows: PortfolioDailySnapshotRow[],
): Omit<
  PortfolioAggregateKPI,
  "id" | "userId" | "asOfDate" | "windowDays" | "computedAt"
> | null {
  if (rows.length === 0) return null;
  const byDate = [...rows].sort((x, y) => compareSnapshotDate(x.snapshotDate, y.snapshotDate));
  const oldest = byDate[0]!;
  const newest = byDate[byDate.length - 1]!;

  let totalProfitChange: number | null = null;
  if (oldest.totalProfitJpy != null && newest.totalProfitJpy != null) {
    totalProfitChange = newest.totalProfitJpy - oldest.totalProfitJpy;
  }

  let valuationChange: number | null = null;
  if (Number.isFinite(oldest.totalMarketValueJpy) && Number.isFinite(newest.totalMarketValueJpy)) {
    valuationChange = newest.totalMarketValueJpy - oldest.totalMarketValueJpy;
  }

  const avgAlphaVsPrev = (() => {
    const av = average(finiteNumbers(rows, effectiveAlphaVsPrevPct));
    return av != null ? roundAlphaMetric(av) : null;
  })();

  return {
    snapshotCount: rows.length,
    periodStart: oldest.snapshotDate,
    periodEnd: newest.snapshotDate,
    totalProfitChange,
    valuationChange,
    avgPfDailyChangePct: average(finiteNumbers(rows, (r) => r.portfolioReturnVsPrevPct)),
    avgBmDailyChangePct: average(finiteNumbers(rows, (r) => r.benchmarkReturnVsPrevPct)),
    avgAlphaDeviationPct: avgAlphaVsPrev,
    avgVooDailyPct: average(finiteNumbers(rows, (r) => r.benchmarkChangePct)),
  };
}

export async function fetchSnapshotRowsInWindow(
  db: Client,
  userId: string,
  asOfDate: string,
  windowDays: number,
): Promise<PortfolioDailySnapshotRow[]> {
  const startYmd = periodStartYmdForWindow(asOfDate, windowDays);
  const fullSql = `SELECT id, user_id, snapshot_date, recorded_at, fx_usd_jpy, benchmark_ticker, benchmark_close,
                 benchmark_change_pct,
                 total_market_value_jpy, total_unrealized_pnl_jpy, total_profit, cost_basis,
                 holdings_count, holdings_added_count, holdings_removed_count, holdings_continuing_count,
                 non_etf_listed_equity_quantity_total,
                 portfolio_avg_alpha,
                 portfolio_return_vs_prev_pct, benchmark_return_vs_prev_pct, alpha_vs_prev_pct,
                 market_indicators_json
          FROM portfolio_daily_snapshots
          WHERE user_id = ?
            AND snapshot_date >= ?
            AND snapshot_date <= ?
          ORDER BY snapshot_date ASC`;
  const args = [userId, startYmd, asOfDate] as const;
  let rs;
  try {
    rs = await db.execute({ sql: fullSql, args: [...args] });
  } catch (e) {
    if (isSqliteMissingColumn(e, "market_indicators_json")) {
      rs = await db.execute({
        sql: `SELECT id, user_id, snapshot_date, recorded_at, fx_usd_jpy, benchmark_ticker, benchmark_close,
                 benchmark_change_pct,
                 total_market_value_jpy, total_unrealized_pnl_jpy, total_profit, cost_basis,
                 holdings_count, holdings_added_count, holdings_removed_count, holdings_continuing_count,
                 non_etf_listed_equity_quantity_total,
                 portfolio_avg_alpha,
                 portfolio_return_vs_prev_pct, benchmark_return_vs_prev_pct, alpha_vs_prev_pct
          FROM portfolio_daily_snapshots
          WHERE user_id = ?
            AND snapshot_date >= ?
            AND snapshot_date <= ?
          ORDER BY snapshot_date ASC`,
        args: [...args],
      });
    } else {
      throw e;
    }
  }
  return (rs.rows as Record<string, unknown>[]).map((row) => mapSnapshotRow(row));
}

/**
 * Recompute and upsert KPI for `asOfDate` (usually today’s `snapshot_date` right after INSERT).
 */
export async function updateAggregateKPIs(
  db: Client,
  userId: string,
  asOfDate: string,
  windowDays: number = DEFAULT_AGGREGATE_KPI_WINDOW_DAYS,
): Promise<void> {
  const rows = await fetchSnapshotRowsInWindow(db, userId, asOfDate, windowDays);
  const computedAt = new Date().toISOString();

  if (rows.length === 0) {
    await db.execute({
      sql: `DELETE FROM portfolio_aggregate_kpis WHERE user_id = ? AND as_of_date = ? AND window_days = ?`,
      args: [userId, asOfDate, windowDays],
    });
    return;
  }

  const stats = computePortfolioAggregateStatsFromRows(rows);
  if (stats == null) return;

  const id = crypto.randomUUID();
  await db.execute({
    sql: `INSERT INTO portfolio_aggregate_kpis (
            id, user_id, as_of_date, window_days, snapshot_count,
            period_start, period_end,
            total_profit_change, valuation_change,
            avg_pf_daily_change_pct, avg_bm_daily_change_pct,
            avg_alpha_deviation_pct, avg_voo_daily_pct, computed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id, as_of_date, window_days) DO UPDATE SET
            id = excluded.id,
            snapshot_count = excluded.snapshot_count,
            period_start = excluded.period_start,
            period_end = excluded.period_end,
            total_profit_change = excluded.total_profit_change,
            valuation_change = excluded.valuation_change,
            avg_pf_daily_change_pct = excluded.avg_pf_daily_change_pct,
            avg_bm_daily_change_pct = excluded.avg_bm_daily_change_pct,
            avg_alpha_deviation_pct = excluded.avg_alpha_deviation_pct,
            avg_voo_daily_pct = excluded.avg_voo_daily_pct,
            computed_at = excluded.computed_at`,
    args: [
      id,
      userId,
      asOfDate,
      windowDays,
      stats.snapshotCount,
      stats.periodStart,
      stats.periodEnd,
      stats.totalProfitChange,
      stats.valuationChange,
      stats.avgPfDailyChangePct,
      stats.avgBmDailyChangePct,
      stats.avgAlphaDeviationPct,
      stats.avgVooDailyPct,
      computedAt,
    ],
  });
}

function mapKpiRow(r: Record<string, unknown>): PortfolioAggregateKPI {
  return {
    id: String(r.id),
    userId: String(r.user_id),
    asOfDate: String(r.as_of_date),
    windowDays: intOrNull(r.window_days) ?? DEFAULT_AGGREGATE_KPI_WINDOW_DAYS,
    snapshotCount: intOrNull(r.snapshot_count) ?? 0,
    periodStart: String(r.period_start),
    periodEnd: String(r.period_end),
    totalProfitChange: numOrNull(r.total_profit_change),
    valuationChange: numOrNull(r.valuation_change),
    avgPfDailyChangePct: numOrNull(r.avg_pf_daily_change_pct),
    avgBmDailyChangePct: numOrNull(r.avg_bm_daily_change_pct),
    avgAlphaDeviationPct: numOrNull(r.avg_alpha_deviation_pct),
    avgVooDailyPct: numOrNull(r.avg_voo_daily_pct),
    computedAt: String(r.computed_at),
  };
}

/**
 * CSV 等からの手動取り込み。`user_id` は `defaultUserId` と一致（または空）のみ許可。
 * `id` が空なら新規 UUID。`ON CONFLICT (user_id, as_of_date, window_days)` で上書き。
 */
export async function upsertAggregateKpiImportRows(
  db: Client,
  defaultUserId: string,
  rows: AggregateKpiImportRow[],
): Promise<{ applied: number }> {
  let applied = 0;
  for (const r of rows) {
    const uid = (r.userId ?? "").trim() || defaultUserId;
    if (uid !== defaultUserId) {
      throw new Error(`user_id は空または ${defaultUserId} である必要があります（as_of_date=${r.asOfDate}）`);
    }
    const id = (r.id ?? "").trim() || crypto.randomUUID();
    await db.execute({
      sql: `INSERT INTO portfolio_aggregate_kpis (
              id, user_id, as_of_date, window_days, snapshot_count,
              period_start, period_end,
              total_profit_change, valuation_change,
              avg_pf_daily_change_pct, avg_bm_daily_change_pct,
              avg_alpha_deviation_pct, avg_voo_daily_pct, computed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, as_of_date, window_days) DO UPDATE SET
              id = excluded.id,
              snapshot_count = excluded.snapshot_count,
              period_start = excluded.period_start,
              period_end = excluded.period_end,
              total_profit_change = excluded.total_profit_change,
              valuation_change = excluded.valuation_change,
              avg_pf_daily_change_pct = excluded.avg_pf_daily_change_pct,
              avg_bm_daily_change_pct = excluded.avg_bm_daily_change_pct,
              avg_alpha_deviation_pct = excluded.avg_alpha_deviation_pct,
              avg_voo_daily_pct = excluded.avg_voo_daily_pct,
              computed_at = excluded.computed_at`,
      args: [
        id,
        defaultUserId,
        r.asOfDate,
        r.windowDays,
        r.snapshotCount,
        r.periodStart,
        r.periodEnd,
        r.totalProfitChange,
        r.valuationChange,
        r.avgPfDailyChangePct,
        r.avgBmDailyChangePct,
        r.avgAlphaDeviationPct,
        r.avgVooDailyPct,
        r.computedAt,
      ],
    });
    applied += 1;
  }
  return { applied };
}

export async function fetchPortfolioAggregateKpisForUser(
  db: Client,
  userId: string,
  limit = 90,
  windowDays: number = DEFAULT_AGGREGATE_KPI_WINDOW_DAYS,
): Promise<PortfolioAggregateKPI[]> {
  const cap = Math.min(500, Math.max(1, Math.floor(limit)));
  const rs = await db.execute({
    sql: `SELECT id, user_id, as_of_date, window_days, snapshot_count, period_start, period_end,
                 total_profit_change, valuation_change,
                 avg_pf_daily_change_pct, avg_bm_daily_change_pct,
                 avg_alpha_deviation_pct, avg_voo_daily_pct, computed_at
          FROM portfolio_aggregate_kpis
          WHERE user_id = ? AND window_days = ?
          ORDER BY as_of_date DESC
          LIMIT ?`,
    args: [userId, windowDays, cap],
  });
  return (rs.rows as Record<string, unknown>[]).map(mapKpiRow);
}

/**
 * One historical `as_of_date` (for backfill). Same as `updateAggregateKPIs`.
 */
export async function backfillAggregateKPIForAsOf(
  db: Client,
  userId: string,
  asOfDate: string,
  windowDays: number = DEFAULT_AGGREGATE_KPI_WINDOW_DAYS,
): Promise<void> {
  await updateAggregateKPIs(db, userId, asOfDate, windowDays);
}

export async function listDistinctSnapshotAsOfDates(db: Client, userId: string): Promise<string[]> {
  const rs = await db.execute({
    sql: `SELECT DISTINCT snapshot_date AS snapshot_date FROM portfolio_daily_snapshots WHERE user_id = ? ORDER BY snapshot_date ASC`,
    args: [userId],
  });
  return (rs.rows as Record<string, unknown>[]).map((r) => String(r.snapshot_date));
}
