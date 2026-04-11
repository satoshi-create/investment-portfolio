import type { Client } from "@libsql/client";

import {
  quoteCurrencyForDashboardWeights,
  roundAlphaMetric,
  SIGNAL_BENCHMARK_TICKER,
} from "@/src/lib/alpha-logic";
import { USD_JPY_RATE_FALLBACK } from "@/src/lib/fx-constants";
import { holdingSectorDisplay } from "@/src/lib/structure-tags";
import { getDashboardData } from "@/src/lib/dashboard-data";
import type {
  HoldingDailySnapshotRow,
  MarketIndicator,
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

function isSqliteMissingColumn(e: unknown, column: string): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  const lower = msg.toLowerCase();
  return lower.includes("no such column") && lower.includes(column.toLowerCase());
}

/** Parse `market_glance_snapshots.payload_json` → validated indicators (empty array OK). */
function parseMarketGlancePayload(raw: unknown): MarketIndicator[] | undefined {
  if (raw == null) return undefined;
  if (typeof raw !== "string" || raw.length === 0) return undefined;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return undefined;
    const out: MarketIndicator[] = [];
    for (const item of parsed) {
      if (item == null || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const label = typeof o.label === "string" ? o.label : "";
      const value = typeof o.value === "number" ? o.value : Number(o.value);
      const changePct = typeof o.changePct === "number" ? o.changePct : Number(o.changePct);
      if (!label) continue;
      if (!Number.isFinite(value) || !Number.isFinite(changePct)) continue;
      out.push({ label, value, changePct });
    }
    return out;
  } catch {
    return undefined;
  }
}

/** 取得単価×数量×換算係数を円建てコストに（ダッシュの評価額換算と整合）。 */
function holdingCostBasisJpy(st: Stock, fxUsdJpy: number): number {
  const ap = st.avgAcquisitionPrice;
  if (ap == null || !Number.isFinite(ap) || ap <= 0) return 0;
  if (!Number.isFinite(st.quantity) || st.quantity <= 0) return 0;
  const f = st.valuationFactor > 0 ? st.valuationFactor : 1;
  const base = st.quantity * ap * f;
  const ccy = quoteCurrencyForDashboardWeights(st.ticker);
  if (ccy === "JPY") return base;
  if (!Number.isFinite(fxUsdJpy) || fxUsdJpy <= 0) return 0;
  return base * fxUsdJpy;
}

function mapPortfolioRow(row: Record<string, unknown>, marketPayload: unknown): PortfolioDailySnapshotRow {
  const base: PortfolioDailySnapshotRow = {
    id: String(row.id),
    userId: String(row.user_id),
    snapshotDate: String(row.snapshot_date),
    recordedAt: String(row.recorded_at),
    fxUsdJpy: Number(row.fx_usd_jpy),
    benchmarkTicker: String(row.benchmark_ticker),
    benchmarkClose: numOrNull(row.benchmark_close),
    benchmarkChangePct: numOrNull(row.benchmark_change_pct),
    totalMarketValueJpy: Number(row.total_market_value_jpy),
    totalUnrealizedPnlJpy: numOrNull(row.total_unrealized_pnl_jpy),
    totalProfitJpy: numOrNull(row.total_profit),
    costBasisJpy: numOrNull(row.cost_basis),
    portfolioAvgAlpha: numOrNull(row.portfolio_avg_alpha),
    portfolioReturnVsPrevPct: numOrNull(row.portfolio_return_vs_prev_pct),
    benchmarkReturnVsPrevPct: numOrNull(row.benchmark_return_vs_prev_pct),
    alphaVsPrevPct: numOrNull(row.alpha_vs_prev_pct),
  };
  const mi = parseMarketGlancePayload(marketPayload);
  if (mi !== undefined) base.marketIndicators = mi;
  return base;
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
      sql: `SELECT p.id, p.user_id, p.snapshot_date, p.recorded_at, p.fx_usd_jpy, p.benchmark_ticker, p.benchmark_close,
                   p.benchmark_change_pct,
                   p.total_market_value_jpy, p.total_unrealized_pnl_jpy, p.total_profit, p.cost_basis, p.portfolio_avg_alpha,
                   p.portfolio_return_vs_prev_pct, p.benchmark_return_vs_prev_pct, p.alpha_vs_prev_pct,
                   m.payload_json AS market_glance_payload_json
            FROM portfolio_daily_snapshots p
            LEFT JOIN market_glance_snapshots m
              ON m.user_id = p.user_id AND m.snapshot_date = p.snapshot_date
            WHERE p.user_id = ?
            ORDER BY p.snapshot_date DESC
            LIMIT ?`,
      args: [userId, cap],
    });
    return rs.rows.map((row) => mapPortfolioRow(row as Record<string, unknown>, row.market_glance_payload_json));
  } catch (e) {
    if (isSqliteMissingColumn(e, "total_profit") || isSqliteMissingColumn(e, "cost_basis")) {
      try {
        const rs = await db.execute({
          sql: `SELECT p.id, p.user_id, p.snapshot_date, p.recorded_at, p.fx_usd_jpy, p.benchmark_ticker, p.benchmark_close,
                       p.benchmark_change_pct,
                       p.total_market_value_jpy, p.total_unrealized_pnl_jpy, p.portfolio_avg_alpha,
                       p.portfolio_return_vs_prev_pct, p.benchmark_return_vs_prev_pct, p.alpha_vs_prev_pct,
                       m.payload_json AS market_glance_payload_json
                FROM portfolio_daily_snapshots p
                LEFT JOIN market_glance_snapshots m
                  ON m.user_id = p.user_id AND m.snapshot_date = p.snapshot_date
                WHERE p.user_id = ?
                ORDER BY p.snapshot_date DESC
                LIMIT ?`,
          args: [userId, cap],
        });
        return rs.rows.map((row) => mapPortfolioRow(row as Record<string, unknown>, row.market_glance_payload_json));
      } catch (e2) {
        const m2 = e2 instanceof Error ? e2.message : String(e2);
        const m2Lower = m2.toLowerCase();
        if (m2Lower.includes("no such table") && m2Lower.includes("market_glance_snapshots")) {
          const rs = await db.execute({
            sql: `SELECT id, user_id, snapshot_date, recorded_at, fx_usd_jpy, benchmark_ticker, benchmark_close,
                         benchmark_change_pct,
                         total_market_value_jpy, total_unrealized_pnl_jpy, portfolio_avg_alpha,
                         portfolio_return_vs_prev_pct, benchmark_return_vs_prev_pct, alpha_vs_prev_pct
                  FROM portfolio_daily_snapshots
                  WHERE user_id = ?
                  ORDER BY snapshot_date DESC
                  LIMIT ?`,
            args: [userId, cap],
          });
          return rs.rows.map((row) => mapPortfolioRow(row as Record<string, unknown>, undefined));
        }
        throw e2;
      }
    }
    const msg = e instanceof Error ? e.message : String(e);
    const msgLower = msg.toLowerCase();
    if (msgLower.includes("no such table") && msgLower.includes("market_glance_snapshots")) {
      try {
        const rs = await db.execute({
          sql: `SELECT id, user_id, snapshot_date, recorded_at, fx_usd_jpy, benchmark_ticker, benchmark_close,
                       benchmark_change_pct,
                       total_market_value_jpy, total_unrealized_pnl_jpy, total_profit, cost_basis, portfolio_avg_alpha,
                       portfolio_return_vs_prev_pct, benchmark_return_vs_prev_pct, alpha_vs_prev_pct
                FROM portfolio_daily_snapshots
                WHERE user_id = ?
                ORDER BY snapshot_date DESC
                LIMIT ?`,
          args: [userId, cap],
        });
        return rs.rows.map((row) => mapPortfolioRow(row as Record<string, unknown>, undefined));
      } catch (e2) {
        if (isSqliteMissingColumn(e2, "total_profit") || isSqliteMissingColumn(e2, "cost_basis")) {
          const rs = await db.execute({
            sql: `SELECT id, user_id, snapshot_date, recorded_at, fx_usd_jpy, benchmark_ticker, benchmark_close,
                         benchmark_change_pct,
                         total_market_value_jpy, total_unrealized_pnl_jpy, portfolio_avg_alpha,
                         portfolio_return_vs_prev_pct, benchmark_return_vs_prev_pct, alpha_vs_prev_pct
                  FROM portfolio_daily_snapshots
                  WHERE user_id = ?
                  ORDER BY snapshot_date DESC
                  LIMIT ?`,
            args: [userId, cap],
          });
          return rs.rows.map((row) => mapPortfolioRow(row as Record<string, unknown>, undefined));
        }
        const m2 = e2 instanceof Error ? e2.message : String(e2);
        if (m2.includes("no such table") || m2.toLowerCase().includes("portfolio_daily_snapshots")) {
          return [];
        }
        throw e2;
      }
    }
    if (msg.includes("no such table") || msgLower.includes("portfolio_daily_snapshots")) {
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

async function upsertHoldingSnapshotsFromStocks(
  db: Client,
  userId: string,
  snapshotDate: string,
  recordedAt: string,
  stocks: Stock[],
): Promise<void> {
  for (const st of stocks) {
    const rowId = crypto.randomUUID();
    await db.execute({
      sql: `INSERT INTO holding_snapshots (
              id, user_id, snapshot_date, recorded_at, ticker, quantity,
              avg_acquisition_price, current_price, alpha_deviation_z, drawdown_pct
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, ticker, snapshot_date) DO UPDATE SET
              id = excluded.id,
              recorded_at = excluded.recorded_at,
              quantity = excluded.quantity,
              avg_acquisition_price = excluded.avg_acquisition_price,
              current_price = excluded.current_price,
              alpha_deviation_z = excluded.alpha_deviation_z,
              drawdown_pct = excluded.drawdown_pct`,
      args: [
        rowId,
        userId,
        snapshotDate,
        recordedAt,
        st.ticker,
        st.quantity,
        st.avgAcquisitionPrice,
        st.currentPrice,
        st.alphaDeviationZ,
        st.drawdownFromHigh90dPct,
      ],
    });
  }
}

async function upsertHoldingDailySnapshotsFromStocks(
  db: Client,
  userId: string,
  snapshotDate: string,
  recordedAt: string,
  benchmarkClose: number | null,
  fxUsdJpyApplied: number,
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
        fxUsdJpyApplied,
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
  const benchmarkChangeAtRecord =
    dash.summary.benchmarkChangePct != null && Number.isFinite(dash.summary.benchmarkChangePct)
      ? roundAlphaMetric(dash.summary.benchmarkChangePct)
      : null;
  const fxUsdJpyApplied =
    dash.summary.fxUsdJpy != null && Number.isFinite(dash.summary.fxUsdJpy) && dash.summary.fxUsdJpy > 0
      ? dash.summary.fxUsdJpy
      : USD_JPY_RATE_FALLBACK;
  const totalMv = dash.totalMarketValue;
  const totalPnlJpy = dash.stocks.reduce((s, st) => s + (Number.isFinite(st.unrealizedPnlJpy) ? st.unrealizedPnlJpy : 0), 0);
  const totalCostBasisJpy = dash.stocks.reduce((s, st) => s + holdingCostBasisJpy(st, fxUsdJpyApplied), 0);
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
  const payloadJson = JSON.stringify(dash.summary.marketIndicators ?? []);

  const tx = await db.transaction("write");
  try {
    await tx.execute({
      sql: `INSERT INTO portfolio_daily_snapshots (
              id, user_id, snapshot_date, recorded_at, fx_usd_jpy, benchmark_ticker, benchmark_close,
              benchmark_change_pct,
              total_market_value_jpy, total_unrealized_pnl_jpy, total_profit, cost_basis, portfolio_avg_alpha,
              portfolio_return_vs_prev_pct, benchmark_return_vs_prev_pct, alpha_vs_prev_pct
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, snapshot_date) DO UPDATE SET
              id = excluded.id,
              recorded_at = excluded.recorded_at,
              fx_usd_jpy = excluded.fx_usd_jpy,
              benchmark_close = excluded.benchmark_close,
              benchmark_change_pct = excluded.benchmark_change_pct,
              total_market_value_jpy = excluded.total_market_value_jpy,
              total_unrealized_pnl_jpy = excluded.total_unrealized_pnl_jpy,
              total_profit = excluded.total_profit,
              cost_basis = excluded.cost_basis,
              portfolio_avg_alpha = excluded.portfolio_avg_alpha,
              portfolio_return_vs_prev_pct = excluded.portfolio_return_vs_prev_pct,
              benchmark_return_vs_prev_pct = excluded.benchmark_return_vs_prev_pct,
              alpha_vs_prev_pct = excluded.alpha_vs_prev_pct`,
      args: [
        id,
        userId,
        snapshotDate,
        recordedAt,
        fxUsdJpyApplied,
        SIGNAL_BENCHMARK_TICKER,
        benchmarkClose,
        benchmarkChangeAtRecord,
        totalMv,
        totalPnlJpy,
        totalPnlJpy,
        totalCostBasisJpy,
        avgAlpha,
        portfolioReturnVsPrev,
        benchmarkReturnVsPrev,
        alphaVsPrev,
      ],
    });

    const mgId = crypto.randomUUID();
    await tx.execute({
      sql: `INSERT INTO market_glance_snapshots (id, user_id, snapshot_date, recorded_at, payload_json)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(user_id, snapshot_date) DO UPDATE SET
              id = excluded.id,
              recorded_at = excluded.recorded_at,
              payload_json = excluded.payload_json`,
      args: [mgId, userId, snapshotDate, recordedAt, payloadJson],
    });

    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  } finally {
    tx.close();
  }

  try {
    await upsertHoldingDailySnapshotsFromStocks(
      db,
      userId,
      snapshotDate,
      recordedAt,
      benchmarkClose,
      fxUsdJpyApplied,
      dash.stocks,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const msgLower = msg.toLowerCase();
    // UNIQUE / FK 等のエラーメッセージにもテーブル名が出るため、「テーブル不存在」のみ握りつぶす
    const holdingTableMissing =
      msgLower.includes("no such table") && msgLower.includes("holding_daily_snapshots");
    if (holdingTableMissing) {
      /* migrations/004 未適用時は portfolio 行のみ成功とする */
    } else {
      throw e;
    }
  }

  try {
    await upsertHoldingSnapshotsFromStocks(db, userId, snapshotDate, recordedAt, dash.stocks);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const msgLower = msg.toLowerCase();
    const metricTableMissing =
      msgLower.includes("no such table") && msgLower.includes("holding_snapshots");
    if (!metricTableMissing) throw e;
  }

  return {
    snapshotDate,
    totalMarketValueJpy: totalMv,
    replacedExistingRow,
  };
}
