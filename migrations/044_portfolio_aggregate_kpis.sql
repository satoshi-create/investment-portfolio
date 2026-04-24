-- Rolling window KPIs at each snapshot (30d default). "Line" history for cockpit charts.
-- Apply: tsx scripts/apply-migration.ts migrations/044_portfolio_aggregate_kpis.sql

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS portfolio_aggregate_kpis (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  as_of_date TEXT NOT NULL,
  window_days INTEGER NOT NULL DEFAULT 30,
  snapshot_count INTEGER NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  total_profit_change REAL,
  valuation_change REAL,
  avg_pf_daily_change_pct REAL,
  avg_bm_daily_change_pct REAL,
  avg_alpha_deviation_pct REAL,
  avg_voo_daily_pct REAL,
  computed_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  UNIQUE (user_id, as_of_date, window_days)
);

CREATE INDEX IF NOT EXISTS idx_portfolio_aggregate_kpis_user_asof
  ON portfolio_aggregate_kpis(user_id, as_of_date DESC);
