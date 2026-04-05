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

-- portfolio_daily_snapshots (patrol / 乖離検証ログ)
CREATE TABLE IF NOT EXISTS portfolio_daily_snapshots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  snapshot_date TEXT NOT NULL,
  recorded_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  fx_usd_jpy REAL NOT NULL,
  benchmark_ticker TEXT NOT NULL,
  benchmark_close REAL,
  total_market_value_jpy REAL NOT NULL,
  total_unrealized_pnl_jpy REAL,
  portfolio_avg_alpha REAL,
  portfolio_return_vs_prev_pct REAL,
  benchmark_return_vs_prev_pct REAL,
  alpha_vs_prev_pct REAL,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  UNIQUE (user_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_user_date
  ON portfolio_daily_snapshots(user_id, snapshot_date DESC);

-- holding_daily_snapshots (銘柄×日 / Record snapshot と同時に upsert)
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

-- trade_history（完了済み売買・取引履歴）
CREATE TABLE IF NOT EXISTS trade_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  trade_date TEXT NOT NULL,
  ticker TEXT NOT NULL,
  name TEXT NOT NULL,
  market TEXT NOT NULL CHECK (market IN ('JP', 'US')),
  account_name TEXT NOT NULL DEFAULT '特定',
  side TEXT NOT NULL CHECK (side IN ('BUY', 'SELL')),
  quantity REAL NOT NULL,
  cost_jpy REAL NOT NULL,
  proceeds_jpy REAL NOT NULL,
  fees_jpy REAL NOT NULL DEFAULT 0,
  realized_pnl_jpy REAL NOT NULL,
  provider_symbol TEXT,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_trade_history_user_date
  ON trade_history(user_id, trade_date DESC);
