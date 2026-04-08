-- schema_dump (formatted)

CREATE TABLE "alpha_history" (
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

CREATE INDEX idx_alpha_history_user_id ON alpha_history(user_id);
CREATE INDEX idx_alpha_history_ticker ON alpha_history(ticker);
CREATE INDEX idx_alpha_history_user_ticker ON alpha_history(user_id, ticker);
CREATE INDEX idx_alpha_history_holding_id ON alpha_history(holding_id);
CREATE INDEX idx_alpha_history_recorded_at ON alpha_history(recorded_at);
CREATE INDEX idx_alpha_history_benchmark_at ON alpha_history(benchmark_ticker, recorded_at);

CREATE TABLE benchmarks (
  ticker TEXT PRIMARY KEY,                   -- "VOO, FANG+"
  name   TEXT NOT NULL
);

CREATE TABLE holding_daily_snapshots (
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

CREATE INDEX idx_holding_snapshots_user_date
  ON holding_daily_snapshots(user_id, snapshot_date DESC);

CREATE INDEX idx_holding_snapshots_holding
  ON holding_daily_snapshots(holding_id, snapshot_date DESC);

CREATE TABLE "holdings" (
  `id` text PRIMARY KEY,
  `user_id` text NOT NULL,
  `ticker` text NOT NULL,
  `name` text,
  `quantity` real DEFAULT 0 NOT NULL,
  `avg_acquisition_price` real,
  `structure_tags` text DEFAULT '[]',
  `category` text NOT NULL,
  `account_type` text NOT NULL DEFAULT '特定',
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `provider_symbol` text,
  `valuation_factor` real DEFAULT 1 NOT NULL,
  `sector` text,
  CONSTRAINT `fk_holdings_user_id_profiles_id_fk` FOREIGN KEY (`user_id`) REFERENCES `profiles`(`id`) ON DELETE CASCADE,
  CONSTRAINT "holdings_check_1" CHECK(category IN ('Core','Satellite')),
  CONSTRAINT "holdings_account_type_check" CHECK(account_type IN ('特定','NISA'))
);

CREATE INDEX `idx_holdings_ticker` ON `holdings` (`ticker`);
CREATE INDEX `idx_holdings_user_id` ON `holdings` (`user_id`);

CREATE TABLE investment_themes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  goal TEXT,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  UNIQUE (user_id, name)
);

CREATE INDEX idx_investment_themes_user
  ON investment_themes(user_id, name);

CREATE TABLE market_glance_snapshots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  snapshot_date TEXT NOT NULL,
  recorded_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  payload_json TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  UNIQUE (user_id, snapshot_date)
);

CREATE INDEX idx_market_glance_user_date
  ON market_glance_snapshots(user_id, snapshot_date DESC);

CREATE TABLE portfolio_daily_snapshots (
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
  market_indicators_json TEXT,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  UNIQUE (user_id, snapshot_date)
);

CREATE INDEX idx_portfolio_snapshots_user_date
  ON portfolio_daily_snapshots(user_id, snapshot_date DESC);

CREATE TABLE profiles (
  id TEXT PRIMARY KEY,                      -- uuid
  display_name TEXT NOT NULL,
  strategy_type TEXT                         -- "Core/Satellite 9:1"
);

CREATE TABLE signals (
  id TEXT PRIMARY KEY,                       -- uuid
  holding_id TEXT NOT NULL,
  signal_type TEXT NOT NULL CHECK (signal_type IN ('BUY','WARN')),
  alpha_at_signal REAL NOT NULL,
  is_resolved INTEGER NOT NULL DEFAULT 0,     -- boolean → 0/1
  detected_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  performance_after_30d REAL,                -- 検証用
  FOREIGN KEY (holding_id) REFERENCES holdings(id) ON DELETE CASCADE
);

CREATE INDEX idx_signals_holding_id ON signals(holding_id);
CREATE INDEX idx_signals_detected_at ON signals(detected_at);
CREATE INDEX idx_signals_unresolved ON signals(is_resolved, detected_at);

CREATE TABLE theme_ecosystem_members (
  id TEXT PRIMARY KEY,
  theme_id TEXT NOT NULL,
  ticker TEXT NOT NULL,
  is_unlisted INTEGER NOT NULL DEFAULT 0,
  proxy_ticker TEXT,
  estimated_ipo_date TEXT,
  estimated_valuation TEXT,
  observation_notes TEXT,
  company_name TEXT,
  field TEXT,
  role TEXT,
  is_major_player INTEGER NOT NULL DEFAULT 0,
  observation_started_at TEXT,
  FOREIGN KEY (theme_id) REFERENCES investment_themes(id) ON DELETE CASCADE,
  UNIQUE (theme_id, ticker)
);

CREATE INDEX idx_theme_ecosystem_theme
  ON theme_ecosystem_members(theme_id, field);

CREATE TABLE trade_history (
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

CREATE INDEX idx_trade_history_user_date
  ON trade_history(user_id, trade_date DESC);