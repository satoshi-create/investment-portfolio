-- Apply: turso db shell <db> < migrations/024_periodic_table_watchlist.sql

CREATE TABLE IF NOT EXISTS periodic_table_watchlist (
  symbol TEXT PRIMARY KEY,        -- e.g. 'Li'
  atomic_number INTEGER NOT NULL, -- e.g. 3
  x INTEGER NOT NULL,             -- 1..18
  y INTEGER NOT NULL,             -- 1..7
  ticker TEXT,                    -- e.g. 'LIT'
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_periodic_table_watchlist_ticker
  ON periodic_table_watchlist(ticker);