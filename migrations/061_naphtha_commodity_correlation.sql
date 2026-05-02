-- Naphtha proxy commodity_prices + ecosystem correlation columns (江戸循環ネットワーク相関エンジン)
-- Apply: tsx scripts/apply-migration.ts migrations/061_naphtha_commodity_correlation.sql

CREATE TABLE IF NOT EXISTS commodity_prices (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  price REAL NOT NULL,
  timestamp TEXT NOT NULL,
  source_url TEXT,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_commodity_prices_symbol_ts
  ON commodity_prices(symbol, timestamp DESC);

ALTER TABLE theme_ecosystem_members ADD COLUMN naphtha_correlation_score REAL;
ALTER TABLE theme_ecosystem_members ADD COLUMN transition_threshold INTEGER NOT NULL DEFAULT 0;
