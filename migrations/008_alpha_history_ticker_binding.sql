-- Alpha を holding_id ではなく user_id + ticker で一意化。保有削除時は holding_id のみ NULL（履歴は残る）。
-- Apply: turso db shell <db> < migrations/008_alpha_history_ticker_binding.sql

PRAGMA foreign_keys = OFF;

CREATE TABLE alpha_history_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  ticker TEXT NOT NULL,
  holding_id TEXT,
  benchmark_ticker TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  close_price REAL,
  alpha_value REAL NOT NULL,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (holding_id) REFERENCES holdings(id) ON DELETE SET NULL,
  FOREIGN KEY (benchmark_ticker) REFERENCES benchmarks(ticker) ON DELETE RESTRICT,
  UNIQUE (user_id, ticker, benchmark_ticker, recorded_at)
);

-- 同一 user+ticker+benchmark+日 で複数 holding がいた場合は 1 行に集約（MAX(rowid) を採用）
INSERT INTO alpha_history_new (id, user_id, ticker, holding_id, benchmark_ticker, recorded_at, close_price, alpha_value)
SELECT
  a.id,
  h.user_id,
  h.ticker,
  a.holding_id,
  a.benchmark_ticker,
  a.recorded_at,
  a.close_price,
  a.alpha_value
FROM alpha_history a
INNER JOIN holdings h ON h.id = a.holding_id
WHERE a.rowid IN (
  SELECT MAX(a2.rowid)
  FROM alpha_history a2
  INNER JOIN holdings h2 ON h2.id = a2.holding_id
  GROUP BY h2.user_id, h2.ticker, a2.benchmark_ticker, a2.recorded_at
);

DROP TABLE alpha_history;

ALTER TABLE alpha_history_new RENAME TO alpha_history;

CREATE INDEX IF NOT EXISTS idx_alpha_history_user_id ON alpha_history(user_id);
CREATE INDEX IF NOT EXISTS idx_alpha_history_ticker ON alpha_history(ticker);
CREATE INDEX IF NOT EXISTS idx_alpha_history_user_ticker ON alpha_history(user_id, ticker);
CREATE INDEX IF NOT EXISTS idx_alpha_history_holding_id ON alpha_history(holding_id);
CREATE INDEX IF NOT EXISTS idx_alpha_history_recorded_at ON alpha_history(recorded_at);
CREATE INDEX IF NOT EXISTS idx_alpha_history_benchmark_at ON alpha_history(benchmark_ticker, recorded_at);

PRAGMA foreign_keys = ON;
