PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,                      -- uuid
  display_name TEXT NOT NULL,
  strategy_type TEXT                         -- "Core/Satellite 9:1"
);
INSERT INTO profiles VALUES('user-satoshi','Satoshi','Core/Satellite 9:1');
CREATE TABLE IF NOT EXISTS benchmarks (
  ticker TEXT PRIMARY KEY,                   -- "VOO, FANG+"
  name   TEXT NOT NULL
);
INSERT INTO benchmarks VALUES('VOO','Vanguard S&P 500 ETF');
INSERT INTO benchmarks VALUES('FANG+','FANG+ Index');
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
INSERT INTO signals VALUES('b59d2fea-a083-49fc-83c9-efa55fb93595','hold-cop','BUY',1.55,0,'2026-04-02T12:00:00.000Z',NULL);
INSERT INTO signals VALUES('96f8189a-308a-4fec-86d6-b23e81884fac','hold-nflx','BUY',3.14,0,'2026-04-02T12:00:00.000Z',NULL);
INSERT INTO signals VALUES('289fdf87-1581-4f32-b4c7-550e61235992','hold-nvda','BUY',0.82,0,'2026-04-02T12:00:00.000Z',NULL);
INSERT INTO signals VALUES('67a0fe90-ce98-4aa0-badc-f6c0e773bf5b','hold-wmt','BUY',0.73,0,'2026-04-02T12:00:00.000Z',NULL);
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
INSERT INTO portfolio_daily_snapshots VALUES('c1cc93de-b5d9-4710-9850-42a06d1c47a4','user-satoshi','2026-04-04','2026-04-04T23:50:47.789Z',150,'VOO',602.989990234375,100836.00153923036,1233.001539230348,-0.19,NULL,NULL,NULL);
INSERT INTO portfolio_daily_snapshots VALUES('abb38d1a-238b-49c4-9ce5-1f3e29fcea8c','user-satoshi','2026-04-05','2026-04-05T06:06:16.399Z',150,'VOO',602.989990234375,100836.00153923036,1233.001539230348,-0.19,0,0,0);
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
INSERT INTO holding_daily_snapshots VALUES('9daddcb5-52ca-4fb4-9466-3890345ac2a0','user-satoshi','hold-fang','2026-04-05','2026-04-05T06:06:16.399Z','06311181','ｉＦｒｅｅＮＥＸＴ ＦＡＮＧ＋','JP_INVESTMENT_TRUST','Satellite','ソフトウェア',389,1,77121,NULL,0,0,0,NULL,'VOO',602.989990234375,150);
INSERT INTO holding_daily_snapshots VALUES('8304ea2e-a20b-45e5-9586-d67f797864c6','user-satoshi','hold-cop','2026-04-05','2026-04-05T06:06:16.399Z','COP','ConocoPhillips','US_EQUITY','Satellite','エネルギー',1,1,125,130.52000427246094,19578.00064086914,828.0006408691406,4.42,1.67,'VOO',602.989990234375,150);
INSERT INTO holding_daily_snapshots VALUES('451d24a0-4931-454c-9dfb-e94e1da6ad18','user-satoshi','hold-enph','2026-04-05','2026-04-05T06:06:16.399Z','ENPH','Enphase Energy Inc','US_EQUITY','Satellite','エネルギー',1,1,38.27,34.91999816894531,5237.999725341797,-502.5002746582036,-8.75,-8.78,'VOO',602.989990234375,150);
INSERT INTO holding_daily_snapshots VALUES('850c3aa1-5140-4df2-a0d8-280bb4953e4f','user-satoshi','hold-nflx','2026-04-05','2026-04-05T06:06:16.399Z','NFLX','Netflix Inc','US_EQUITY','Satellite','ソフトウェア',2,1,96.21,98.66000366210938,29598.001098632813,735.0010986328143,2.55,3.25,'VOO',602.989990234375,150);
INSERT INTO holding_daily_snapshots VALUES('8f95f793-28ec-4466-93bb-f3f140c7144c','user-satoshi','hold-nio','2026-04-05','2026-04-05T06:06:16.399Z','NIO','Nio Inc - ADR','US_EQUITY','Satellite','ソフトウェア',1,1,5.47,6.300000190734863,945.0000286102296,124.50002861022952,15.17,1.61,'VOO',602.989990234375,150);
INSERT INTO holding_daily_snapshots VALUES('7efedf33-9b58-4d1c-8235-1b3ab2071aee','user-satoshi','hold-nvda','2026-04-05','2026-04-05T06:06:16.399Z','NVDA','NVIDIA Corp','US_EQUITY','Satellite','ソフトウェア',1,1,178,177.38999938964844,26608.499908447266,-91.50009155273438,-0.34,0.93,'VOO',602.989990234375,150);
INSERT INTO holding_daily_snapshots VALUES('d2a32c62-f329-44d6-bc39-e58ad42a9a9b','user-satoshi','hold-wmt','2026-04-05','2026-04-05T06:06:16.399Z','WMT','Walmart Inc','US_EQUITY','Satellite','小売',1,1,124.86,125.79000091552734,18868.5001373291,139.50013732910165,0.74,0.84,'VOO',602.989990234375,150);
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
INSERT INTO trade_history VALUES('trade-20260122-fcx','user-satoshi','2026-01-22','FCX','Freeport-McMoRan Inc','US','特定','SELL',1,9469,9262,45,-252,NULL);
INSERT INTO trade_history VALUES('trade-20260126-9501','user-satoshi','2026-01-26','9501','東京電力','JP','特定','SELL',3,2148,2055,52,-145,NULL);
INSERT INTO trade_history VALUES('trade-20260127-apld','user-satoshi','2026-01-27','APLD','Applied Digital Corp','US','特定','SELL',1,5377,5920,27,516,NULL);
INSERT INTO trade_history VALUES('trade-20260127-iren','user-satoshi','2026-01-27','IREN','IREN Ltd','US','特定','SELL',1,8642,8620,41,-63,NULL);
INSERT INTO trade_history VALUES('trade-20260127-uec','user-satoshi','2026-01-27','UEC','Uranium Energy Corp.','US','特定','SELL',1,3094,2959,13,-148,NULL);
INSERT INTO trade_history VALUES('trade-20260128-3436','user-satoshi','2026-01-28','3436','Sumco','JP','特定','SELL',2,3340,2960,52,-432,NULL);
INSERT INTO trade_history VALUES('trade-20260225-apld','user-satoshi','2026-02-25','APLD','Applied Digital Corp','US','特定','SELL',2,12514,9509,46,-3051,NULL);
INSERT INTO trade_history VALUES('trade-20260225-btdr','user-satoshi','2026-02-25','BTDR','Bitdeer Technologies Group','US','特定','SELL',3,6300,3901,18,-2417,NULL);
INSERT INTO trade_history VALUES('trade-20260225-iren','user-satoshi','2026-02-25','IREN','IREN Ltd','US','特定','SELL',2,17652,14027,69,-3694,NULL);
INSERT INTO trade_history VALUES('trade-20260305-btdr','user-satoshi','2026-03-05','BTDR','Bitdeer Technologies Group','US','NISA','SELL',1,1367,1226,0,-141,NULL);
INSERT INTO trade_history VALUES('trade-20260305-xyz','user-satoshi','2026-03-05','XYZ','Block Inc','US','NISA','SELL',1,10002,9818,0,-184,NULL);
INSERT INTO trade_history VALUES('trade-20260324-1942','user-satoshi','2026-03-24','1942','関電工','JP','NISA','SELL',2,13070,11934,0,-1136,NULL);
INSERT INTO trade_history VALUES('trade-20260324-5703','user-satoshi','2026-03-24','5703','日軽金ＨＤ','JP','NISA','SELL',1,2760,2619,52,-193,NULL);
INSERT INTO trade_history VALUES('trade-20260323-orcl','user-satoshi','2026-03-23','ORCL','Oracle Corp','US','NISA','SELL',1,26254,24316,0,-1938,NULL);
INSERT INTO trade_history VALUES('ffd01319-e4d7-47a9-92b2-9b23e63ed35a','user-satoshi','2026-04-05','NVDA','NVDA','US','NISA','BUY',1,23850,0,0,0,NULL);
INSERT INTO trade_history VALUES('51cf63be-ac6a-4325-a1f0-2180a01da915','user-satoshi','2026-04-05','COP','COP','US','NISA','BUY',1,23850,0,0,0,NULL);
INSERT INTO trade_history VALUES('7d48c207-839f-4d4a-9652-82060bb36f7c','user-satoshi','2026-04-05','COP','COP','US','NISA','SELL',1,21300,23850,0,2550,NULL);
CREATE TABLE IF NOT EXISTS "holdings" (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`ticker` text NOT NULL,
	`name` text,
	`quantity` real DEFAULT 0 NOT NULL,
	`avg_acquisition_price` real,
	`structure_tags` text DEFAULT '[]',
	`category` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`provider_symbol` text,
	`valuation_factor` real DEFAULT 1 NOT NULL,
	`sector` text,
	CONSTRAINT `fk_holdings_user_id_profiles_id_fk` FOREIGN KEY (`user_id`) REFERENCES `profiles`(`id`) ON DELETE CASCADE,
	CONSTRAINT "holdings_check_1" CHECK(category IN ('Core','Satellite'))
);
INSERT INTO holdings VALUES('hold-nflx','user-satoshi','NFLX','Netflix Inc',2,96.21,NULL,'Satellite','2026-04-05 04:30:19',NULL,1,'ソフトウェア');
INSERT INTO holdings VALUES('hold-nvda','user-satoshi','NVDA','NVIDIA Corp',1,178,'["AIデータセンター"]','Satellite','2026-04-05 04:30:19',NULL,1,'ソフトウェア');
INSERT INTO holdings VALUES('hold-cop','user-satoshi','COP','ConocoPhillips',1,125,'["非石油文明"]','Satellite','2026-04-05 04:30:19',NULL,1,'エネルギー');
INSERT INTO holdings VALUES('hold-fang','user-satoshi','06311181','ｉＦｒｅｅＮＥＸＴ ＦＡＮＧ＋',389,77121,NULL,'Satellite','2026-04-05 04:30:19',NULL,1,'ソフトウェア');
INSERT INTO holdings VALUES('hold-nio','user-satoshi','NIO','Nio Inc - ADR',1,5.47,'["非石油文明"]','Satellite','2026-04-05 04:30:19',NULL,1,'ソフトウェア');
INSERT INTO holdings VALUES('hold-enph','user-satoshi','ENPH','Enphase Energy Inc',1,38.27,'["非石油文明"]','Satellite','2026-04-05 04:30:19',NULL,1,'エネルギー');
INSERT INTO holdings VALUES('hold-wmt','user-satoshi','WMT','Walmart Inc',1,124.86,NULL,'Satellite','2026-04-05 04:30:19',NULL,1,'小売');
CREATE TABLE IF NOT EXISTS "alpha_history" (
  id TEXT PRIMARY KEY,
  holding_id TEXT NOT NULL,
  benchmark_ticker TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  close_price REAL,
  alpha_value REAL NOT NULL,
  FOREIGN KEY (holding_id) REFERENCES holdings(id) ON DELETE RESTRICT,
  FOREIGN KEY (benchmark_ticker) REFERENCES benchmarks(ticker) ON DELETE RESTRICT,
  UNIQUE (holding_id, benchmark_ticker, recorded_at)
);
INSERT INTO alpha_history VALUES('ed106ed7-08a5-4393-bf51-ac064ef5be1c','hold-cop','VOO','2026-02-23',109.87999725341795,0.42);
INSERT INTO alpha_history VALUES('fd1cf788-f993-4b7f-899a-4b1c0e15fdd5','hold-cop','VOO','2026-02-25',110.01000213623048,-1.37);
INSERT INTO alpha_history VALUES('f85b40bd-c2dd-4cbe-897d-67b40f714f5a','hold-cop','VOO','2026-03-09',117.02999877929688,-0.9);
INSERT INTO alpha_history VALUES('f9bb0fbd-5c4c-4445-adef-dc1dc58b1c6f','hold-cop','VOO','2026-03-17',122.87000274658205,1);
INSERT INTO alpha_history VALUES('f55b2cf3-bece-40f0-827f-6e5a9705dc5c','hold-cop','VOO','2026-03-26',133.25,5.12);
INSERT INTO alpha_history VALUES('dfe33999-60c0-4eeb-851d-d396e85385c3','hold-cop','VOO','2026-03-27',133.8000030517578,2.42);
INSERT INTO alpha_history VALUES('f72a0039-20a6-434c-a523-ced13ce41102','hold-cop','VOO','2026-04-01',128.3800048828125,-3.54);
INSERT INTO alpha_history VALUES('e89df35b-dd9f-4b03-b423-99133e857413','hold-enph','VOO','2026-02-25',48.4900016784668,-3.35);
INSERT INTO alpha_history VALUES('f976130b-127a-4148-88e6-73eb8396132a','hold-enph','VOO','2026-03-11',43.34000015258789,-0.46);
INSERT INTO alpha_history VALUES('e2be44f3-dc30-45de-acc5-e889566431e7','hold-enph','VOO','2026-04-02',34.91999816894531,-8.89);
INSERT INTO alpha_history VALUES('fb9bde31-20ae-44b7-847b-9beaef20bdb3','hold-nflx','VOO','2026-03-10',96.94000244140624,-1.23);
INSERT INTO alpha_history VALUES('ed6fb07b-ae95-4f3d-823d-49eb2b33970d','hold-nflx','VOO','2026-03-12',94.30999755859376,0.92);
INSERT INTO alpha_history VALUES('e85e0160-f7dd-485f-9572-4dd499e9e554','hold-nflx','VOO','2026-03-16',95.1999969482422,-1.12);
INSERT INTO alpha_history VALUES('f5c33a10-cd8e-4f6a-9da7-ac5cfa57daad','hold-nflx','VOO','2026-03-17',94.36000061035156,-1.16);
INSERT INTO alpha_history VALUES('f741c291-915c-47f8-8259-f287aae858f4','hold-nflx','VOO','2026-04-01',95.5500030517578,-1.42);
INSERT INTO alpha_history VALUES('ed5e3e8c-d597-42c2-a3a3-c6b564835e67','hold-nio','VOO','2026-02-24',5.300000190734863,-0.54);
INSERT INTO alpha_history VALUES('e325c952-3ca2-4645-9570-f476c40f0342','hold-nio','VOO','2026-03-24',5.730000019073486,-1.21);
INSERT INTO alpha_history VALUES('f161d5c2-a2ab-4252-af20-a5644c9b9a00','hold-nio','VOO','2026-04-01',6.199999809265137,2.02);
INSERT INTO alpha_history VALUES('ec2956b8-fb2a-4229-9585-16f5a9d519e7','hold-nvda','VOO','2026-03-02',182.47999572753903,2.95);
INSERT INTO alpha_history VALUES('f1000171-ee39-4d2e-be9c-4da133db4db8','hold-nvda','VOO','2026-03-25',178.67999267578125,1.44);
INSERT INTO alpha_history VALUES('e7cb6656-3568-4d88-870a-6324ff7eb9df','hold-wmt','VOO','2026-03-03',127.91000366210938,1.52);
INSERT INTO alpha_history VALUES('dfcb0cae-4e81-406b-b5e8-ee53690b6072','hold-wmt','VOO','2026-03-12',125.33000183105467,3.02);
CREATE INDEX idx_signals_holding_id ON signals(holding_id);
CREATE INDEX idx_signals_detected_at ON signals(detected_at);
CREATE INDEX idx_signals_unresolved ON signals(is_resolved, detected_at);
CREATE INDEX idx_portfolio_snapshots_user_date
  ON portfolio_daily_snapshots(user_id, snapshot_date DESC);
CREATE INDEX idx_holding_snapshots_user_date
  ON holding_daily_snapshots(user_id, snapshot_date DESC);
CREATE INDEX idx_holding_snapshots_holding
  ON holding_daily_snapshots(holding_id, snapshot_date DESC);
CREATE INDEX idx_trade_history_user_date
  ON trade_history(user_id, trade_date DESC);
CREATE INDEX `idx_holdings_ticker` ON `holdings` (`ticker`);
CREATE INDEX `idx_holdings_user_id` ON `holdings` (`user_id`);
CREATE INDEX idx_alpha_history_holding_id ON alpha_history(holding_id);
CREATE INDEX idx_alpha_history_recorded_at ON alpha_history(recorded_at);
CREATE INDEX idx_alpha_history_benchmark_at ON alpha_history(benchmark_ticker, recorded_at);
COMMIT;
