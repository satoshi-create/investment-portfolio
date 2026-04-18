-- Ticker-level efficiency metrics (shared across holdings + theme ecosystem).
-- Apply: turso db shell <db> < migrations/038_ticker_efficiency_metrics.sql

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ticker_efficiency_metrics (
  ticker TEXT PRIMARY KEY,
  -- percentage points (e.g. 12.3 means 12.3%)
  revenue_growth REAL,
  fcf_margin REAL,
  fcf_yield REAL,
  -- optional: cash amount for unlisted yield estimation (unit must match valuation unit)
  fcf REAL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ticker_efficiency_metrics_updated
  ON ticker_efficiency_metrics(updated_at);

