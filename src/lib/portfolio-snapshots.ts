import type { Client } from "@libsql/client";

import { roundAlphaMetric, SIGNAL_BENCHMARK_TICKER } from "@/src/lib/alpha-logic";
import { reconcileAlphaHistoryForUser, type ReconcileAlphaHistoryResult } from "@/src/lib/alpha-history-reconcile";
import { USD_JPY_RATE_FALLBACK } from "@/src/lib/fx-constants";
import { holdingSectorDisplay } from "@/src/lib/structure-tags";
import { isLikelyEtfOrFundHolding } from "@/src/lib/strata-holding-detect";
import { getDashboardData } from "@/src/lib/dashboard-data";
import { parseMarketGlancePayload } from "@/src/lib/market-indicators-json";
import { DEFAULT_AGGREGATE_KPI_WINDOW_DAYS, updateAggregateKPIs } from "@/src/lib/portfolio-aggregate-kpis";

export { parseMarketGlancePayload };
import { lastCompletedNyseSessionCalendarYmd } from "@/src/lib/us-market-session";
import type { HoldingDailySnapshotRow, PortfolioDailySnapshotRow, Stock, TickerInstrumentKind } from "@/src/types/investment";

export type RecordPortfolioSnapshotResult = {
  snapshotDate: string;
  totalMarketValueJpy: number;
  replacedExistingRow: boolean;
  /** `reconcileAlphaHistoryForUser` result (snapshot aborts if all attempts fail). */
  alphaHistoryReconcile: ReconcileAlphaHistoryResult;
  /** US 株保有の最新 α 観測日が、直近完了 NY セッションより古いとき。 */
  staleAlphaDataWarning?: string | null;
};

const SNAPSHOT_LIST_LIMIT = 90;
const SNAPSHOT_RECONCILE_ATTEMPTS = 3;
const SNAPSHOT_RECONCILE_RETRY_MS = 1500;

function sleepMs(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

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
  const lower = msg.toLowerCase();
  return lower.includes("no such column") && lower.includes(column.toLowerCase());
}

/** US / JP 上場株のみ。ETF・投信型は `isLikelyEtfOrFundHolding` で除外（JP 投信コード保有は種別外）。 */
function sumNonEtfListedEquityQuantity(stocks: Stock[]): number {
  let sum = 0;
  for (const st of stocks) {
    if (st.instrumentKind !== "US_EQUITY" && st.instrumentKind !== "JP_LISTED_EQUITY") continue;
    if (isLikelyEtfOrFundHolding(st.ticker, st.name)) continue;
    if (Number.isFinite(st.quantity) && st.quantity > 0) sum += st.quantity;
  }
  return sum;
}

function mapPortfolioRow(row: Record<string, unknown>, marketJoinPayload: unknown): PortfolioDailySnapshotRow {
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
    holdingsCount: intOrNull(row.holdings_count),
    holdingsAddedCount: intOrNull(row.holdings_added_count),
    holdingsRemovedCount: intOrNull(row.holdings_removed_count),
    holdingsContinuingCount: intOrNull(row.holdings_continuing_count),
    nonEtfListedEquityQuantityTotal: numOrNull(row.non_etf_listed_equity_quantity_total),
    portfolioAvgAlpha: numOrNull(row.portfolio_avg_alpha),
    portfolioReturnVsPrevPct: numOrNull(row.portfolio_return_vs_prev_pct),
    benchmarkReturnVsPrevPct: numOrNull(row.benchmark_return_vs_prev_pct),
    alphaVsPrevPct: numOrNull(row.alpha_vs_prev_pct),
  };
  const stored = row.market_indicators_json;
  if (typeof stored === "string" && stored.length > 0) {
    base.marketIndicatorsJson = stored;
  }
  const payload = typeof stored === "string" && stored.length > 0 ? stored : marketJoinPayload;
  const mi = parseMarketGlancePayload(payload);
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
                   p.total_market_value_jpy, p.total_unrealized_pnl_jpy, p.total_profit, p.cost_basis,
                   p.holdings_count, p.holdings_added_count, p.holdings_removed_count, p.holdings_continuing_count,
                   p.non_etf_listed_equity_quantity_total,
                   p.portfolio_avg_alpha,
                   p.portfolio_return_vs_prev_pct, p.benchmark_return_vs_prev_pct, p.alpha_vs_prev_pct,
                   p.market_indicators_json,
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
    if (isSqliteMissingColumn(e, "market_indicators_json")) {
      const rs = await db.execute({
        sql: `SELECT p.id, p.user_id, p.snapshot_date, p.recorded_at, p.fx_usd_jpy, p.benchmark_ticker, p.benchmark_close,
                     p.benchmark_change_pct,
                     p.total_market_value_jpy, p.total_unrealized_pnl_jpy, p.total_profit, p.cost_basis,
                     p.holdings_count, p.holdings_added_count, p.holdings_removed_count, p.holdings_continuing_count,
                     p.non_etf_listed_equity_quantity_total,
                     p.portfolio_avg_alpha,
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
    }
    if (isSqliteMissingColumn(e, "non_etf_listed_equity_quantity_total")) {
      try {
        const rs = await db.execute({
          sql: `SELECT p.id, p.user_id, p.snapshot_date, p.recorded_at, p.fx_usd_jpy, p.benchmark_ticker, p.benchmark_close,
                       p.benchmark_change_pct,
                       p.total_market_value_jpy, p.total_unrealized_pnl_jpy, p.total_profit, p.cost_basis,
                       p.holdings_count, p.holdings_added_count, p.holdings_removed_count, p.holdings_continuing_count,
                       p.portfolio_avg_alpha,
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
        if (isSqliteMissingColumn(e2, "total_profit") || isSqliteMissingColumn(e2, "cost_basis")) {
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
        }
        const m2n = e2 instanceof Error ? e2.message : String(e2);
        const m2nLower = m2n.toLowerCase();
        if (m2nLower.includes("no such table") && m2nLower.includes("market_glance_snapshots")) {
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
        }
        throw e2;
      }
    }
    if (isSqliteMissingColumn(e, "holdings_count")) {
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
      } catch (e2) {
        if (isSqliteMissingColumn(e2, "total_profit") || isSqliteMissingColumn(e2, "cost_basis")) {
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
        }
        const m2 = e2 instanceof Error ? e2.message : String(e2);
        const m2Lower = m2.toLowerCase();
        if (m2Lower.includes("no such table") && m2Lower.includes("market_glance_snapshots")) {
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
        }
        throw e2;
      }
    }
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
                       total_market_value_jpy, total_unrealized_pnl_jpy, total_profit, cost_basis,
                       holdings_count, holdings_added_count, holdings_removed_count, holdings_continuing_count,
                       non_etf_listed_equity_quantity_total,
                       portfolio_avg_alpha,
                       portfolio_return_vs_prev_pct, benchmark_return_vs_prev_pct, alpha_vs_prev_pct
                FROM portfolio_daily_snapshots
                WHERE user_id = ?
                ORDER BY snapshot_date DESC
                LIMIT ?`,
          args: [userId, cap],
        });
        return rs.rows.map((row) => mapPortfolioRow(row as Record<string, unknown>, undefined));
      } catch (e2) {
        if (isSqliteMissingColumn(e2, "non_etf_listed_equity_quantity_total")) {
          const rs = await db.execute({
            sql: `SELECT id, user_id, snapshot_date, recorded_at, fx_usd_jpy, benchmark_ticker, benchmark_close,
                         benchmark_change_pct,
                         total_market_value_jpy, total_unrealized_pnl_jpy, total_profit, cost_basis,
                         holdings_count, holdings_added_count, holdings_removed_count, holdings_continuing_count,
                         portfolio_avg_alpha,
                         portfolio_return_vs_prev_pct, benchmark_return_vs_prev_pct, alpha_vs_prev_pct
                  FROM portfolio_daily_snapshots
                  WHERE user_id = ?
                  ORDER BY snapshot_date DESC
                  LIMIT ?`,
            args: [userId, cap],
          });
          return rs.rows.map((row) => mapPortfolioRow(row as Record<string, unknown>, undefined));
        }
        if (isSqliteMissingColumn(e2, "holdings_count")) {
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
          } catch (e3) {
            if (isSqliteMissingColumn(e3, "total_profit") || isSqliteMissingColumn(e3, "cost_basis")) {
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
            throw e3;
          }
        }
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

async function fetchHoldingIdsForUserSnapshotDate(
  db: Client,
  userId: string,
  snapshotDate: string,
): Promise<Set<string> | null> {
  try {
    const rs = await db.execute({
      sql: `SELECT holding_id FROM holding_daily_snapshots WHERE user_id = ? AND snapshot_date = ?`,
      args: [userId, snapshotDate],
    });
    const set = new Set<string>();
    for (const row of rs.rows) {
      const r = row as Record<string, unknown>;
      const hid = r.holding_id;
      if (hid != null && String(hid).length > 0) set.add(String(hid));
    }
    return set;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const lower = msg.toLowerCase();
    if (lower.includes("no such table") && lower.includes("holding_daily_snapshots")) return null;
    throw e;
  }
}

type HoldingsCountSnapshotFields = {
  holdingsCount: number;
  holdingsAddedCount: number | null;
  holdingsRemovedCount: number | null;
  holdingsContinuingCount: number | null;
};

/** Compares current `holding_id`s to the prior calendar `holding_daily_snapshots` day (if any). */
function computeHoldingsCountSnapshotFields(
  currentHoldingIds: readonly string[],
  prevHoldingIds: Set<string> | null,
): HoldingsCountSnapshotFields {
  const holdingsCount = currentHoldingIds.length;
  if (prevHoldingIds === null) {
    return {
      holdingsCount,
      holdingsAddedCount: null,
      holdingsRemovedCount: null,
      holdingsContinuingCount: null,
    };
  }
  if (prevHoldingIds.size === 0) {
    if (currentHoldingIds.length === 0) {
      return { holdingsCount, holdingsAddedCount: 0, holdingsRemovedCount: 0, holdingsContinuingCount: 0 };
    }
    return {
      holdingsCount,
      holdingsAddedCount: null,
      holdingsRemovedCount: null,
      holdingsContinuingCount: null,
    };
  }
  const curr = new Set(currentHoldingIds);
  let continuing = 0;
  for (const id of curr) {
    if (prevHoldingIds.has(id)) continuing += 1;
  }
  let added = 0;
  for (const id of curr) {
    if (!prevHoldingIds.has(id)) added += 1;
  }
  let removed = 0;
  for (const id of prevHoldingIds) {
    if (!curr.has(id)) removed += 1;
  }
  return { holdingsCount, holdingsAddedCount: added, holdingsRemovedCount: removed, holdingsContinuingCount: continuing };
}

function parseInstrumentKind(raw: string): TickerInstrumentKind {
  const s = raw.trim();
  if (s === "JP_INVESTMENT_TRUST") return "JP_INVESTMENT_TRUST";
  if (s === "JP_LISTED_EQUITY") return "JP_LISTED_EQUITY";
  return "US_EQUITY";
}

/**
 * ユーザーの `holding_daily_snapshots` をすべて返す（ログ画面・CSV 用）。
 * `snapshotDate` は行のうち最新のカレンダー日（`ORDER BY snapshot_date DESC` の先頭行と一致）。
 */
export async function fetchHoldingDailySnapshotsLatestForUser(
  db: Client,
  userId: string,
): Promise<{ snapshotDate: string | null; rows: HoldingDailySnapshotRow[] }> {
  try {
    const rs = await db.execute({
      sql: `SELECT id, user_id, holding_id, snapshot_date, recorded_at, ticker, name, instrument_kind,
                   category, secondary_tag, quantity, valuation_factor, avg_acquisition_price, close_price,
                   market_value_jpy, unrealized_pnl_jpy, unrealized_pnl_pct, day_change_pct,
                   benchmark_ticker, benchmark_close, fx_usd_jpy, peg_ratio, expected_growth
            FROM holding_daily_snapshots
            WHERE user_id = ?
            ORDER BY snapshot_date DESC, ticker ASC`,
      args: [userId],
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
      pegRatio: numOrNull(row.peg_ratio),
      expectedGrowth: numOrNull(row.expected_growth),
    }));
    const snapshotDate = rows.length > 0 ? rows[0]!.snapshotDate : null;
    return { snapshotDate, rows };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const msgLower = msg.toLowerCase();
    if (msg.includes("no such table") || msgLower.includes("holding_daily_snapshots")) {
      return { snapshotDate: null, rows: [] };
    }
    if (msgLower.includes("no such column") && msgLower.includes("peg_ratio")) {
      const rs = await db.execute({
        sql: `SELECT id, user_id, holding_id, snapshot_date, recorded_at, ticker, name, instrument_kind,
                   category, secondary_tag, quantity, valuation_factor, avg_acquisition_price, close_price,
                   market_value_jpy, unrealized_pnl_jpy, unrealized_pnl_pct, day_change_pct,
                   benchmark_ticker, benchmark_close, fx_usd_jpy
            FROM holding_daily_snapshots
            WHERE user_id = ?
            ORDER BY snapshot_date DESC, ticker ASC`,
        args: [userId],
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
        pegRatio: null,
        expectedGrowth: null,
      }));
      const snapshotDate = rows.length > 0 ? rows[0]!.snapshotDate : null;
      return { snapshotDate, rows };
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
              benchmark_ticker, benchmark_close, fx_usd_jpy, peg_ratio, expected_growth
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
              fx_usd_jpy = excluded.fx_usd_jpy,
              peg_ratio = excluded.peg_ratio,
              expected_growth = excluded.expected_growth`,
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
        st.pegRatio,
        st.expectedGrowth,
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
  // `portfolio_avg_alpha` is derived from `alpha_history`’s latest daily alpha per holding.
  let alphaHistoryReconcile: ReconcileAlphaHistoryResult | undefined;
  let lastReconcileError: unknown;
  for (let attempt = 0; attempt < SNAPSHOT_RECONCILE_ATTEMPTS; attempt++) {
    try {
      alphaHistoryReconcile = await reconcileAlphaHistoryForUser(userId, db);
      lastReconcileError = undefined;
      break;
    } catch (e) {
      lastReconcileError = e;
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(
        `[snapshot] alpha_history reconcile failed (attempt ${attempt + 1}/${SNAPSHOT_RECONCILE_ATTEMPTS}): ${msg}`,
      );
      if (attempt < SNAPSHOT_RECONCILE_ATTEMPTS - 1) await sleepMs(SNAPSHOT_RECONCILE_RETRY_MS);
    }
  }
  if (alphaHistoryReconcile === undefined) {
    const msg = lastReconcileError instanceof Error ? lastReconcileError.message : String(lastReconcileError);
    throw new Error(`alpha_history reconcile failed after ${SNAPSHOT_RECONCILE_ATTEMPTS} attempts: ${msg}`);
  }

  const dash = await getDashboardData(db, userId);
  const expectedNySessionYmd = lastCompletedNyseSessionCalendarYmd(new Date());
  let staleAlphaDataWarning: string | null = null;
  const usAlphaStaleVsNy = dash.stocks.some((s) => {
    if (s.instrumentKind !== "US_EQUITY") return false;
    if (s.alphaHistory.length === 0) return false;
    const y = s.latestAlphaObservationYmd;
    return y != null && y.length === 10 && y < expectedNySessionYmd;
  });
  if (usAlphaStaleVsNy) {
    staleAlphaDataWarning = `Stale Data Warning: US holding(s) latest α observation is before last completed NY session (${expectedNySessionYmd})`;
    console.warn(`[snapshot] ${staleAlphaDataWarning}`);
  }
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
  /** ダッシュ `summary` と同一（含み+確定 / 評価額−含みの合計コスト） */
  const snapshotTotalProfitJpy = dash.summary.totalProfitJpy;
  const snapshotCostBasisJpy = dash.summary.totalCostBasisJpy;
  const avgAlpha = dash.summary.portfolioAverageAlpha;

  const prevRs = await db.execute({
    sql: `SELECT snapshot_date AS prev_snapshot_date, total_market_value_jpy, benchmark_close
          FROM portfolio_daily_snapshots
          WHERE user_id = ? AND snapshot_date < ?
          ORDER BY snapshot_date DESC
          LIMIT 1`,
    args: [userId, snapshotDate],
  });

  let prevSnapshotDate: string | null = null;
  let portfolioReturnVsPrev: number | null = null;
  let benchmarkReturnVsPrev: number | null = null;
  let alphaVsPrev: number | null = null;

  if (prevRs.rows.length > 0) {
    const prow = prevRs.rows[0] as Record<string, unknown>;
    if (prow.prev_snapshot_date != null && String(prow.prev_snapshot_date).length > 0) {
      prevSnapshotDate = String(prow.prev_snapshot_date);
    }
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

  let prevHoldingIds: Set<string> | null = null;
  if (prevSnapshotDate != null) {
    prevHoldingIds = await fetchHoldingIdsForUserSnapshotDate(db, userId, prevSnapshotDate);
  }
  const holdingCountFields = computeHoldingsCountSnapshotFields(
    dash.stocks.map((s) => s.id),
    prevHoldingIds,
  );
  const nonEtfListedEquityQuantityTotal = sumNonEtfListedEquityQuantity(dash.stocks);

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
              total_market_value_jpy, total_unrealized_pnl_jpy, total_profit, cost_basis,
              holdings_count, holdings_added_count, holdings_removed_count, holdings_continuing_count,
              non_etf_listed_equity_quantity_total,
              portfolio_avg_alpha,
              portfolio_return_vs_prev_pct, benchmark_return_vs_prev_pct, alpha_vs_prev_pct,
              market_indicators_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
              holdings_count = excluded.holdings_count,
              holdings_added_count = excluded.holdings_added_count,
              holdings_removed_count = excluded.holdings_removed_count,
              holdings_continuing_count = excluded.holdings_continuing_count,
              non_etf_listed_equity_quantity_total = excluded.non_etf_listed_equity_quantity_total,
              portfolio_avg_alpha = excluded.portfolio_avg_alpha,
              portfolio_return_vs_prev_pct = excluded.portfolio_return_vs_prev_pct,
              benchmark_return_vs_prev_pct = excluded.benchmark_return_vs_prev_pct,
              alpha_vs_prev_pct = excluded.alpha_vs_prev_pct,
              market_indicators_json = excluded.market_indicators_json`,
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
        snapshotTotalProfitJpy,
        snapshotCostBasisJpy,
        holdingCountFields.holdingsCount,
        holdingCountFields.holdingsAddedCount,
        holdingCountFields.holdingsRemovedCount,
        holdingCountFields.holdingsContinuingCount,
        nonEtfListedEquityQuantityTotal,
        avgAlpha,
        portfolioReturnVsPrev,
        benchmarkReturnVsPrev,
        alphaVsPrev,
        payloadJson,
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

  try {
    await updateAggregateKPIs(db, userId, snapshotDate, DEFAULT_AGGREGATE_KPI_WINDOW_DAYS);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const lower = msg.toLowerCase();
    if (lower.includes("no such table") && lower.includes("portfolio_aggregate_kpis")) {
      console.warn("[snapshot] portfolio_aggregate_kpis: table missing (apply migration 044); KPI skipped");
    } else {
      console.warn(`[snapshot] updateAggregateKPIs: ${msg}`);
    }
  }

  return {
    snapshotDate,
    totalMarketValueJpy: totalMv,
    replacedExistingRow,
    alphaHistoryReconcile,
    staleAlphaDataWarning,
  };
}
