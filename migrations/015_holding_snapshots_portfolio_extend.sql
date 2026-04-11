-- holding_snapshots: 日次スナップショット時の銘柄別メトリクス（軽量クエリ用）
-- portfolio_daily_snapshots: total_profit / cost_basis は getDashboardData の summary と同一意味
-- Apply: turso db shell <db> < migrations/015_holding_snapshots_portfolio_extend.sql

PRAGMA foreign_keys = ON;

ALTER TABLE portfolio_daily_snapshots ADD COLUMN total_profit REAL;
ALTER TABLE portfolio_daily_snapshots ADD COLUMN cost_basis REAL;

CREATE TABLE IF NOT EXISTS holding_snapshots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  snapshot_date TEXT NOT NULL,
  recorded_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  ticker TEXT NOT NULL,
  quantity REAL NOT NULL,
  avg_acquisition_price REAL,
  current_price REAL,
  alpha_deviation_z REAL,
  drawdown_pct REAL,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  UNIQUE (user_id, ticker, snapshot_date)
);

-- 名前は holding_daily_snapshots の idx_holding_snapshots_* と重複しないこと
CREATE INDEX IF NOT EXISTS idx_holding_snapshots_metric_user_date
  ON holding_snapshots(user_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_holding_snapshots_metric_user_ticker
  ON holding_snapshots(user_id, ticker);
