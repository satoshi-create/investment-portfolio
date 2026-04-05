PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,                      -- uuid
  display_name TEXT NOT NULL,
  strategy_type TEXT                         -- "Core/Satellite 9:1"
);
INSERT INTO profiles VALUES('user-0001','Satoshi','Core/Satellite 9:1');
INSERT INTO profiles VALUES('user-satoshi','Satoshi','Core/Satellite 9:1');
CREATE TABLE IF NOT EXISTS benchmarks (
  ticker TEXT PRIMARY KEY,                   -- "VOO, FANG+"
  name   TEXT NOT NULL
);
INSERT INTO benchmarks VALUES('VOO','Vanguard S&P 500 ETF');
INSERT INTO benchmarks VALUES('FANG+','FANG+ Index');
CREATE TABLE IF NOT EXISTS holdings (
  id TEXT PRIMARY KEY,                       -- uuid
  user_id TEXT NOT NULL,
  ticker TEXT NOT NULL,                      -- "NVDA, NFLX, etc"
  name TEXT,
  quantity REAL NOT NULL DEFAULT 0,
  avg_acquisition_price REAL,                -- numeric
  structure_tags TEXT NOT NULL DEFAULT '[]', -- text[] → JSON文字列で保持
  category TEXT NOT NULL CHECK (category IN ('Core','Satellite')),
  provider_symbol TEXT,
  valuation_factor REAL NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),

  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);
INSERT INTO holdings (id,user_id,ticker,name,quantity,avg_acquisition_price,structure_tags,category,provider_symbol,valuation_factor,created_at) VALUES('hold-nflx','user-satoshi','NFLX','Netflix Inc',2,600,'["FANG+"]','Satellite',NULL,1,'2026-04-02 13:04:23');
INSERT INTO holdings (id,user_id,ticker,name,quantity,avg_acquisition_price,structure_tags,category,provider_symbol,valuation_factor,created_at) VALUES('hold-nvda','user-satoshi','NVDA','NVIDIA Corp',1,800,'["AI Infrastructure"]','Satellite',NULL,1,'2026-04-02 13:04:23');
INSERT INTO holdings (id,user_id,ticker,name,quantity,avg_acquisition_price,structure_tags,category,provider_symbol,valuation_factor,created_at) VALUES('hold-cop','user-satoshi','COP','ConocoPhillips',1,110,'["老朽化インフラ"]','Satellite',NULL,1,'2026-04-02 13:04:23');
INSERT INTO holdings (id,user_id,ticker,name,quantity,avg_acquisition_price,structure_tags,category,provider_symbol,valuation_factor,created_at) VALUES('hold-fang','user-satoshi','06311181','iFreeNEXT FANG+',389,45000,'["FANG+","Core-Sat"]','Core',NULL,1,'2026-04-02 13:04:23');
INSERT INTO holdings (id,user_id,ticker,name,quantity,avg_acquisition_price,structure_tags,category,provider_symbol,valuation_factor,created_at) VALUES('hold-nio','user-satoshi','NIO','Nio Inc - ADR',1,15,'["非石油文明","EV"]','Satellite',NULL,1,'2026-04-02 13:04:23');
INSERT INTO holdings (id,user_id,ticker,name,quantity,avg_acquisition_price,structure_tags,category,provider_symbol,valuation_factor,created_at) VALUES('hold-enph','user-satoshi','ENPH','Enphase Energy Inc',1,120,'["非石油文明","再エネ"]','Satellite',NULL,1,'2026-04-02 13:04:23');
INSERT INTO holdings (id,user_id,ticker,name,quantity,avg_acquisition_price,structure_tags,category,provider_symbol,valuation_factor,created_at) VALUES('hold-wmt','user-satoshi','WMT','Walmart Inc',1,60,'["実体経済"]','Satellite',NULL,1,'2026-04-02 13:04:23');
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
CREATE INDEX idx_holdings_user_id ON holdings(user_id);
CREATE INDEX idx_holdings_ticker  ON holdings(ticker);
CREATE INDEX idx_alpha_history_holding_id   ON alpha_history(holding_id);
CREATE INDEX idx_alpha_history_recorded_at  ON alpha_history(recorded_at);
CREATE INDEX idx_alpha_history_benchmark_at ON alpha_history(benchmark_ticker, recorded_at);
CREATE INDEX idx_signals_holding_id ON signals(holding_id);
CREATE INDEX idx_signals_detected_at ON signals(detected_at);
CREATE INDEX idx_signals_unresolved ON signals(is_resolved, detected_at);
CREATE TABLE IF NOT EXISTS market_glance_snapshots (
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
COMMIT;
