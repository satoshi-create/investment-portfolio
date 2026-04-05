-- Per-holding daily rows (same moment as portfolio_daily_snapshots / Record snapshot).
-- Apply: turso db shell <db> < migrations/004_holding_daily_snapshots.sql

CREATE TABLE IF NOT EXISTS holding_daily_snapshots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  holding_id TEXT NOT NULL,
  snapshot_date TEXT NOT NULL,
  recorded_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  ticker TEXT NOT NULL,
  name TEXT,
  instrument_kind TEXT NOT NULL,
  category TEXT NOT NULL,
  secondary_tag TEXT NOT NULL DEFAULT '',
  quantity REAL NOT NULL,
  valuation_factor REAL NOT NULL DEFAULT 1,
  avg_acquisition_price REAL,
  close_price REAL,
  market_value_jpy REAL NOT NULL,
  unrealized_pnl_jpy REAL,
  unrealized_pnl_pct REAL,
  day_change_pct REAL,
  benchmark_ticker TEXT NOT NULL,
  benchmark_close REAL,
  fx_usd_jpy REAL NOT NULL,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (holding_id) REFERENCES holdings(id) ON DELETE CASCADE,
  UNIQUE (holding_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_holding_snapshots_user_date
  ON holding_daily_snapshots(user_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_holding_snapshots_holding
  ON holding_daily_snapshots(holding_id, snapshot_date DESC);
