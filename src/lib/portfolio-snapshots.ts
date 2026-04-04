import type { Client } from "@libsql/client";

import { roundAlphaMetric, SIGNAL_BENCHMARK_TICKER, USD_JPY_RATE } from "@/src/lib/alpha-logic";
import { getDashboardData } from "@/src/lib/dashboard-data";
import type { PortfolioDailySnapshotRow } from "@/src/types/investment";

export type RecordPortfolioSnapshotResult = {
  snapshotDate: string;
  totalMarketValueJpy: number;
  replacedExistingRow: boolean;
};

const SNAPSHOT_LIST_LIMIT = 90;

function numOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Recent patrol rows for dashboard (newest first). Returns [] if table missing. */
export async function fetchPortfolioDailySnapshotsForUser(
  db: Client,
  userId: string,
  limit = SNAPSHOT_LIST_LIMIT,
): Promise<PortfolioDailySnapshotRow[]> {
  const cap = Math.min(365, Math.max(1, Math.floor(limit)));
  try {
    const rs = await db.execute({
      sql: `SELECT id, user_id, snapshot_date, recorded_at, fx_usd_jpy, benchmark_ticker, benchmark_close,
                   total_market_value_jpy, total_unrealized_pnl_jpy, portfolio_avg_alpha,
                   portfolio_return_vs_prev_pct, benchmark_return_vs_prev_pct, alpha_vs_prev_pct
            FROM portfolio_daily_snapshots
            WHERE user_id = ?
            ORDER BY snapshot_date DESC
            LIMIT ?`,
      args: [userId, cap],
    });
    return rs.rows.map((row) => ({
      id: String(row.id),
      userId: String(row.user_id),
      snapshotDate: String(row.snapshot_date),
      recordedAt: String(row.recorded_at),
      fxUsdJpy: Number(row.fx_usd_jpy),
      benchmarkTicker: String(row.benchmark_ticker),
      benchmarkClose: numOrNull(row.benchmark_close),
      totalMarketValueJpy: Number(row.total_market_value_jpy),
      totalUnrealizedPnlJpy: numOrNull(row.total_unrealized_pnl_jpy),
      portfolioAvgAlpha: numOrNull(row.portfolio_avg_alpha),
      portfolioReturnVsPrevPct: numOrNull(row.portfolio_return_vs_prev_pct),
      benchmarkReturnVsPrevPct: numOrNull(row.benchmark_return_vs_prev_pct),
      alphaVsPrevPct: numOrNull(row.alpha_vs_prev_pct),
    }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("no such table") || msg.toLowerCase().includes("portfolio_daily_snapshots")) {
      return [];
    }
    throw e;
  }
}

/**
 * Persist one row per user per calendar day (UTC date). Same-day re-run overwrites the row.
 * Compares to the latest prior `snapshot_date` for 1-day portfolio vs benchmark return spread.
 */
export async function recordPortfolioDailySnapshot(
  db: Client,
  userId: string,
): Promise<RecordPortfolioSnapshotResult> {
  const dash = await getDashboardData(db, userId);
  const snapshotDate = new Date().toISOString().slice(0, 10);
  const recordedAt = new Date().toISOString();
  const benchmarkClose =
    dash.summary.benchmarkLatestPrice > 0 ? dash.summary.benchmarkLatestPrice : null;
  const totalMv = dash.totalMarketValue;
  const totalPnlJpy = dash.stocks.reduce((s, st) => s + (Number.isFinite(st.unrealizedPnlJpy) ? st.unrealizedPnlJpy : 0), 0);
  const avgAlpha = dash.summary.portfolioAverageAlpha;

  const prevRs = await db.execute({
    sql: `SELECT total_market_value_jpy, benchmark_close
          FROM portfolio_daily_snapshots
          WHERE user_id = ? AND snapshot_date < ?
          ORDER BY snapshot_date DESC
          LIMIT 1`,
    args: [userId, snapshotDate],
  });

  let portfolioReturnVsPrev: number | null = null;
  let benchmarkReturnVsPrev: number | null = null;
  let alphaVsPrev: number | null = null;

  if (prevRs.rows.length > 0) {
    const prow = prevRs.rows[0]!;
    const prevMv = Number(prow.total_market_value_jpy);
    const prevBench =
      prow.benchmark_close != null && Number.isFinite(Number(prow.benchmark_close))
        ? Number(prow.benchmark_close)
        : null;

    if (prevMv > 0 && Number.isFinite(totalMv)) {
      portfolioReturnVsPrev = roundAlphaMetric(((totalMv - prevMv) / prevMv) * 100);
    }
    if (prevBench != null && prevBench > 0 && benchmarkClose != null && benchmarkClose > 0) {
      benchmarkReturnVsPrev = roundAlphaMetric(((benchmarkClose - prevBench) / prevBench) * 100);
    }
    if (
      portfolioReturnVsPrev != null &&
      benchmarkReturnVsPrev != null &&
      Number.isFinite(portfolioReturnVsPrev) &&
      Number.isFinite(benchmarkReturnVsPrev)
    ) {
      alphaVsPrev = roundAlphaMetric(portfolioReturnVsPrev - benchmarkReturnVsPrev);
    }
  }

  const existing = await db.execute({
    sql: `SELECT 1 FROM portfolio_daily_snapshots WHERE user_id = ? AND snapshot_date = ? LIMIT 1`,
    args: [userId, snapshotDate],
  });
  const replacedExistingRow = existing.rows.length > 0;

  const id = crypto.randomUUID();
  await db.execute({
    sql: `INSERT INTO portfolio_daily_snapshots (
            id, user_id, snapshot_date, recorded_at, fx_usd_jpy, benchmark_ticker, benchmark_close,
            total_market_value_jpy, total_unrealized_pnl_jpy, portfolio_avg_alpha,
            portfolio_return_vs_prev_pct, benchmark_return_vs_prev_pct, alpha_vs_prev_pct
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id, snapshot_date) DO UPDATE SET
            id = excluded.id,
            recorded_at = excluded.recorded_at,
            fx_usd_jpy = excluded.fx_usd_jpy,
            benchmark_close = excluded.benchmark_close,
            total_market_value_jpy = excluded.total_market_value_jpy,
            total_unrealized_pnl_jpy = excluded.total_unrealized_pnl_jpy,
            portfolio_avg_alpha = excluded.portfolio_avg_alpha,
            portfolio_return_vs_prev_pct = excluded.portfolio_return_vs_prev_pct,
            benchmark_return_vs_prev_pct = excluded.benchmark_return_vs_prev_pct,
            alpha_vs_prev_pct = excluded.alpha_vs_prev_pct`,
    args: [
      id,
      userId,
      snapshotDate,
      recordedAt,
      USD_JPY_RATE,
      SIGNAL_BENCHMARK_TICKER,
      benchmarkClose,
      totalMv,
      totalPnlJpy,
      avgAlpha,
      portfolioReturnVsPrev,
      benchmarkReturnVsPrev,
      alphaVsPrev,
    ],
  });

  return {
    snapshotDate,
    totalMarketValueJpy: totalMv,
    replacedExistingRow,
  };
}
