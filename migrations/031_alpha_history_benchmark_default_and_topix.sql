-- Alpha history benchmark clarification:
-- - Ensure `benchmarks` has TOPIX ETF (1306.T) for JP alpha comparisons.
-- - Add DEFAULT 'VOO' on `alpha_history.benchmark_ticker` for legacy inserts.
--
-- Apply: turso db shell <db> < migrations/031_alpha_history_benchmark_default_and_topix.sql

PRAGMA foreign_keys = OFF;

-- Benchmarks referenced by FK from alpha_history / snapshots.
INSERT OR IGNORE INTO benchmarks (ticker, name) VALUES ('VOO', 'Vanguard S&P 500 ETF');
INSERT OR IGNORE INTO benchmarks (ticker, name) VALUES ('1306.T', 'TOPIX ETF (iShares/Listed)');

CREATE TABLE alpha_history_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  ticker TEXT NOT NULL,
  holding_id TEXT,
  benchmark_ticker TEXT NOT NULL DEFAULT 'VOO',
  recorded_at TEXT NOT NULL,
  close_price REAL,
  alpha_value REAL NOT NULL,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (holding_id) REFERENCES holdings(id) ON DELETE SET NULL,
  FOREIGN KEY (benchmark_ticker) REFERENCES benchmarks(ticker) ON DELETE RESTRICT,
  UNIQUE (user_id, ticker, benchmark_ticker, recorded_at)
);

INSERT INTO alpha_history_new (id, user_id, ticker, holding_id, benchmark_ticker, recorded_at, close_price, alpha_value)
SELECT
  id,
  user_id,
  ticker,
  holding_id,
  COALESCE(NULLIF(benchmark_ticker, ''), 'VOO') AS benchmark_ticker,
  recorded_at,
  close_price,
  alpha_value
FROM alpha_history;

DROP TABLE alpha_history;
ALTER TABLE alpha_history_new RENAME TO alpha_history;

CREATE INDEX IF NOT EXISTS idx_alpha_history_user_id ON alpha_history(user_id);
CREATE INDEX IF NOT EXISTS idx_alpha_history_ticker ON alpha_history(ticker);
CREATE INDEX IF NOT EXISTS idx_alpha_history_user_ticker ON alpha_history(user_id, ticker);
CREATE INDEX IF NOT EXISTS idx_alpha_history_holding_id ON alpha_history(holding_id);
CREATE INDEX IF NOT EXISTS idx_alpha_history_recorded_at ON alpha_history(recorded_at);
CREATE INDEX IF NOT EXISTS idx_alpha_history_benchmark_at ON alpha_history(benchmark_ticker, recorded_at);

PRAGMA foreign_keys = ON;

