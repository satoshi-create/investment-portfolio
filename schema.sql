PRAGMA foreign_keys = ON;

-- profiles
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,                      -- uuid
  display_name TEXT NOT NULL,
  strategy_type TEXT                         -- "Core/Satellite 9:1"
);

-- benchmarks
CREATE TABLE IF NOT EXISTS benchmarks (
  ticker TEXT PRIMARY KEY,                   -- "VOO, FANG+"
  name   TEXT NOT NULL
);

-- holdings
CREATE TABLE IF NOT EXISTS holdings (
  id TEXT PRIMARY KEY,                       -- uuid
  user_id TEXT NOT NULL,
  ticker TEXT NOT NULL,                      -- "NVDA, NFLX, etc"
  name TEXT,
  quantity REAL NOT NULL DEFAULT 0,
  avg_acquisition_price REAL,                -- numeric
  structure_tags TEXT NOT NULL DEFAULT '[]', -- text[] → JSON文字列で保持
  category TEXT NOT NULL CHECK (category IN ('Core','Satellite')),
  provider_symbol TEXT,                     -- Yahoo Finance 等の取得用シンボル（任意）
  valuation_factor REAL NOT NULL DEFAULT 1, -- 指数等のスケール補正（評価額 = qty×価格×factor×為替）
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),

  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_holdings_user_id ON holdings(user_id);
CREATE INDEX IF NOT EXISTS idx_holdings_ticker  ON holdings(ticker);

-- alpha_history
CREATE TABLE IF NOT EXISTS alpha_history (
  id TEXT PRIMARY KEY,                       -- uuid
  holding_id TEXT NOT NULL,
  benchmark_ticker TEXT NOT NULL,
  recorded_at TEXT NOT NULL,                 -- date → ISO文字列(YYYY-MM-DD)で保持
  close_price REAL,
  alpha_value REAL NOT NULL,                 -- "Ticker % - Bench %"

  FOREIGN KEY (holding_id) REFERENCES holdings(id) ON DELETE CASCADE,
  FOREIGN KEY (benchmark_ticker) REFERENCES benchmarks(ticker) ON DELETE RESTRICT,

  UNIQUE (holding_id, benchmark_ticker, recorded_at)
);

CREATE INDEX IF NOT EXISTS idx_alpha_history_holding_id   ON alpha_history(holding_id);
CREATE INDEX IF NOT EXISTS idx_alpha_history_recorded_at  ON alpha_history(recorded_at);
CREATE INDEX IF NOT EXISTS idx_alpha_history_benchmark_at ON alpha_history(benchmark_ticker, recorded_at);

-- signals
CREATE TABLE IF NOT EXISTS signals (
  id TEXT PRIMARY KEY,                       -- uuid
  holding_id TEXT NOT NULL,
  signal_type TEXT NOT NULL CHECK (signal_type IN ('BUY','WARN')),
  alpha_at_signal REAL NOT NULL,
  is_resolved INTEGER NOT NULL DEFAULT 0,     -- boolean → 0/1
  detected_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  performance_after_30d REAL,                -- 検証用

  FOREIGN KEY (holding_id) REFERENCES holdings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_signals_holding_id ON signals(holding_id);
CREATE INDEX IF NOT EXISTS idx_signals_detected_at ON signals(detected_at);
CREATE INDEX IF NOT EXISTS idx_signals_unresolved ON signals(is_resolved, detected_at);
