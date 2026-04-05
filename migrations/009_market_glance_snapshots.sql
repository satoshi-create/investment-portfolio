-- Market Glance (macro indicators) at Record snapshot time, per user per UTC day.
-- Apply: turso db shell <db> < migrations/009_market_glance_snapshots.sql

CREATE TABLE IF NOT EXISTS market_glance_snapshots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  snapshot_date TEXT NOT NULL,
  recorded_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  payload_json TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  UNIQUE (user_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_market_glance_user_date
  ON market_glance_snapshots(user_id, snapshot_date DESC);
