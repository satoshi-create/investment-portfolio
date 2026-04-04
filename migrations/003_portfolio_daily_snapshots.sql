-- Turso / SQLite: daily portfolio rollup for divergence vs VOO (patrol log).
-- Apply: turso db shell <db> < migrations/003_portfolio_daily_snapshots.sql

CREATE TABLE IF NOT EXISTS portfolio_daily_snapshots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  snapshot_date TEXT NOT NULL,
  recorded_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  fx_usd_jpy REAL NOT NULL,
  benchmark_ticker TEXT NOT NULL,
  benchmark_close REAL,
  total_market_value_jpy REAL NOT NULL,
  total_unrealized_pnl_jpy REAL,
  portfolio_avg_alpha REAL,
  portfolio_return_vs_prev_pct REAL,
  benchmark_return_vs_prev_pct REAL,
  alpha_vs_prev_pct REAL,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  UNIQUE (user_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_user_date
  ON portfolio_daily_snapshots(user_id, snapshot_date DESC);
