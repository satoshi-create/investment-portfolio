-- Add holdings.account_type with CHECK constraint (特定 / NISA).
-- SQLite/libsql cannot add CHECK via ALTER COLUMN, so we rebuild the table.
-- Apply: turso db shell <db> < migrations/013_holdings_account_type.sql

PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS holdings_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  ticker TEXT NOT NULL,
  name TEXT,
  quantity REAL NOT NULL DEFAULT 0,
  avg_acquisition_price REAL,
  structure_tags TEXT DEFAULT '[]',
  sector TEXT,
  category TEXT NOT NULL CHECK (category IN ('Core','Satellite')),
  provider_symbol TEXT,
  valuation_factor REAL NOT NULL DEFAULT 1,
  account_type TEXT NOT NULL DEFAULT '特定' CHECK(account_type IN ('特定','NISA')),
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

INSERT INTO holdings_new (
  id, user_id, ticker, name, quantity, avg_acquisition_price, structure_tags, sector, category,
  provider_symbol, valuation_factor, account_type, created_at
)
SELECT
  id, user_id, ticker, name, quantity, avg_acquisition_price, structure_tags, sector, category,
  provider_symbol, valuation_factor,
  COALESCE(account_type, '特定') AS account_type,
  created_at
FROM holdings;

DROP TABLE holdings;
ALTER TABLE holdings_new RENAME TO holdings;

CREATE INDEX IF NOT EXISTS idx_holdings_user_id ON holdings(user_id);
CREATE INDEX IF NOT EXISTS idx_holdings_ticker  ON holdings(ticker);

PRAGMA foreign_keys = ON;

