import type { Client } from "@libsql/client";

import { roundAlphaMetric, SIGNAL_BENCHMARK_TICKER, USD_JPY_RATE } from "@/src/lib/alpha-logic";
import { holdingSectorDisplay } from "@/src/lib/structure-tags";
import { getDashboardData } from "@/src/lib/dashboard-data";
import type {
  HoldingDailySnapshotRow,
  PortfolioDailySnapshotRow,
  Stock,
  TickerInstrumentKind,
} from "@/src/types/investment";

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

function parseInstrumentKind(raw: string): TickerInstrumentKind {
  return raw === "JP_INVESTMENT_TRUST" ? "JP_INVESTMENT_TRUST" : "US_EQUITY";
}

/** Latest `snapshot_date` rows for user (one patrol “slice”). */
export async function fetchHoldingDailySnapshotsLatestForUser(
  db: Client,
  userId: string,
): Promise<{ snapshotDate: string | null; rows: HoldingDailySnapshotRow[] }> {
  try {
    const maxRs = await db.execute({
      sql: `SELECT MAX(snapshot_date) AS d FROM holding_daily_snapshots WHERE user_id = ?`,
      args: [userId],
    });
    const d = maxRs.rows[0]?.d;
    if (d == null || String(d).length === 0) {
      return { snapshotDate: null, rows: [] };
    }
    const snapshotDate = String(d);
    const rs = await db.execute({
      sql: `SELECT id, user_id, holding_id, snapshot_date, recorded_at, ticker, name, instrument_kind,
                   category, secondary_tag, quantity, valuation_factor, avg_acquisition_price, close_price,
                   market_value_jpy, unrealized_pnl_jpy, unrealized_pnl_pct, day_change_pct,
                   benchmark_ticker, benchmark_close, fx_usd_jpy
            FROM holding_daily_snapshots
            WHERE user_id = ? AND snapshot_date = ?
            ORDER BY ticker ASC`,
      args: [userId, snapshotDate],
    });
    const rows: HoldingDailySnapshotRow[] = rs.rows.map((row) => ({
      id: String(row.id),
      userId: String(row.user_id),
      holdingId: String(row.holding_id),
      snapshotDate: String(row.snapshot_date),
      recordedAt: String(row.recorded_at),
      ticker: String(row.ticker),
      name: row.name != null ? String(row.name) : "",
      instrumentKind: parseInstrumentKind(String(row.instrument_kind)),
      category: String(row.category) === "Core" ? "Core" : "Satellite",
      secondaryTag: row.secondary_tag != null ? String(row.secondary_tag) : "",
      quantity: Number(row.quantity),
      valuationFactor: Number(row.valuation_factor),
      avgAcquisitionPrice: numOrNull(row.avg_acquisition_price),
      closePrice: numOrNull(row.close_price),
      marketValueJpy: Number(row.market_value_jpy),
      unrealizedPnlJpy: numOrNull(row.unrealized_pnl_jpy),
      unrealizedPnlPct: numOrNull(row.unrealized_pnl_pct),
      dayChangePct: numOrNull(row.day_change_pct),
      benchmarkTicker: String(row.benchmark_ticker),
      benchmarkClose: numOrNull(row.benchmark_close),
      fxUsdJpy: Number(row.fx_usd_jpy),
    }));
    return { snapshotDate, rows };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("no such table") || msg.toLowerCase().includes("holding_daily_snapshots")) {
      return { snapshotDate: null, rows: [] };
    }
    throw e;
  }
}

async function upsertHoldingDailySnapshotsFromStocks(
  db: Client,
  userId: string,
  snapshotDate: string,
  recordedAt: string,
  benchmarkClose: number | null,
  stocks: Stock[],
): Promise<void> {
  for (const st of stocks) {
    const rowId = crypto.randomUUID();
    const secondaryForSnapshot = holdingSectorDisplay(st.sector, st.secondaryTag);
    await db.execute({
      sql: `INSERT INTO holding_daily_snapshots (
              id, user_id, holding_id, snapshot_date, recorded_at, ticker, name, instrument_kind,
              category, secondary_tag, quantity, valuation_factor, avg_acquisition_price, close_price,
              market_value_jpy, unrealized_pnl_jpy, unrealized_pnl_pct, day_change_pct,
              benchmark_ticker, benchmark_close, fx_usd_jpy
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(holding_id, snapshot_date) DO UPDATE SET
              id = excluded.id,
              recorded_at = excluded.recorded_at,
              ticker = excluded.ticker,
              name = excluded.name,
              instrument_kind = excluded.instrument_kind,
              category = excluded.category,
              secondary_tag = excluded.secondary_tag,
              quantity = excluded.quantity,
              valuation_factor = excluded.valuation_factor,
              avg_acquisition_price = excluded.avg_acquisition_price,
              close_price = excluded.close_price,
              market_value_jpy = excluded.market_value_jpy,
              unrealized_pnl_jpy = excluded.unrealized_pnl_jpy,
              unrealized_pnl_pct = excluded.unrealized_pnl_pct,
              day_change_pct = excluded.day_change_pct,
              benchmark_ticker = excluded.benchmark_ticker,
              benchmark_close = excluded.benchmark_close,
              fx_usd_jpy = excluded.fx_usd_jpy`,
      args: [
        rowId,
        userId,
        st.id,
        snapshotDate,
        recordedAt,
        st.ticker,
        st.name || "",
        st.instrumentKind,
        st.category,
        secondaryForSnapshot,
        st.quantity,
        st.valuationFactor,
        st.avgAcquisitionPrice,
        st.currentPrice,
        st.marketValue,
        st.unrealizedPnlJpy,
        st.unrealizedPnlPercent,
        st.dayChangePercent,
        SIGNAL_BENCHMARK_TICKER,
        benchmarkClose,
        USD_JPY_RATE,
      ],
    });
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

  try {
    await upsertHoldingDailySnapshotsFromStocks(
      db,
      userId,
      snapshotDate,
      recordedAt,
      benchmarkClose,
      dash.stocks,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("no such table") || msg.toLowerCase().includes("holding_daily_snapshots")) {
      /* マイグレーション未適用時はポートフォリオ行のみ成功とする */
    } else {
      throw e;
    }
  }

  return {
    snapshotDate,
    totalMarketValueJpy: totalMv,
    replacedExistingRow,
  };
}
