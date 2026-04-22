-- Replace Watanabe 5 expectation_category values with Peter Lynch 6 bucket keys.
-- SQLite cannot ALTER CHECK; rebuild holdings + theme_ecosystem_members.
-- Requires migrations through 044 (holdings short-term columns). Apply after 020.
-- Apply: turso db shell <db> < migrations/049_lynch_expectation_category.sql

PRAGMA foreign_keys = OFF;

BEGIN TRANSACTION;

CREATE TABLE holdings_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  ticker TEXT NOT NULL,
  name TEXT,
  quantity REAL NOT NULL DEFAULT 0,
  avg_acquisition_price REAL,
  structure_tags TEXT DEFAULT '[]',
  category TEXT NOT NULL,
  account_type TEXT NOT NULL DEFAULT '特定',
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  provider_symbol TEXT,
  valuation_factor REAL NOT NULL DEFAULT 1,
  sector TEXT,
  expectation_category TEXT CHECK (
    expectation_category IS NULL
    OR expectation_category IN (
      'SlowGrower',
      'Stalwart',
      'FastGrower',
      'AssetPlay',
      'Cyclical',
      'Turnaround'
    )
  ),
  earnings_summary_note TEXT,
  listing_date TEXT,
  market_cap REAL,
  listing_price REAL,
  next_earnings_date TEXT,
  memo TEXT,
  is_bookmarked INTEGER NOT NULL DEFAULT 0,
  instrument_meta_synced_at TEXT,
  stop_loss_pct REAL,
  target_profit_pct REAL,
  trade_deadline TEXT,
  exit_rule_enabled INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT fk_holdings_user_id_profiles_id_fk FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT holdings_check_1 CHECK (category IN ('Core', 'Satellite')),
  CONSTRAINT holdings_account_type_check CHECK (account_type IN ('特定', 'NISA'))
);

INSERT INTO holdings_new (
  id, user_id, ticker, name, quantity, avg_acquisition_price, structure_tags, category, account_type,
  created_at, provider_symbol, valuation_factor, sector, expectation_category, earnings_summary_note,
  listing_date, market_cap, listing_price, next_earnings_date, memo, is_bookmarked, instrument_meta_synced_at,
  stop_loss_pct, target_profit_pct, trade_deadline, exit_rule_enabled
)
SELECT
  id, user_id, ticker, name, quantity, avg_acquisition_price, structure_tags, category, account_type,
  created_at, provider_symbol, valuation_factor, sector,
  CASE expectation_category
    WHEN 'SlowGrower' THEN 'SlowGrower'
    WHEN 'Stalwart' THEN 'Stalwart'
    WHEN 'FastGrower' THEN 'FastGrower'
    WHEN 'AssetPlay' THEN 'AssetPlay'
    WHEN 'Cyclical' THEN 'Cyclical'
    WHEN 'Turnaround' THEN 'Turnaround'
    WHEN 'Growth' THEN 'FastGrower'
    WHEN 'Recovery' THEN 'Turnaround'
    WHEN 'Quality' THEN 'Stalwart'
    WHEN 'Value' THEN 'AssetPlay'
    WHEN 'Heritage' THEN 'SlowGrower'
    ELSE NULL
  END,
  earnings_summary_note,
  listing_date, market_cap, listing_price, next_earnings_date, memo, is_bookmarked, instrument_meta_synced_at,
  stop_loss_pct, target_profit_pct, trade_deadline, exit_rule_enabled
FROM holdings;

DROP TABLE holdings;
ALTER TABLE holdings_new RENAME TO holdings;

CREATE INDEX IF NOT EXISTS idx_holdings_user_id ON holdings(user_id);
CREATE INDEX IF NOT EXISTS idx_holdings_ticker ON holdings(ticker);

CREATE TABLE theme_ecosystem_members_new (
  id TEXT PRIMARY KEY,
  theme_id TEXT NOT NULL,
  ticker TEXT NOT NULL,
  company_name TEXT,
  field TEXT,
  role TEXT,
  is_major_player INTEGER NOT NULL DEFAULT 0,
  observation_started_at TEXT,
  is_unlisted INTEGER NOT NULL DEFAULT 0,
  proxy_ticker TEXT,
  estimated_ipo_date TEXT,
  estimated_valuation TEXT,
  observation_notes TEXT,
  adoption_stage TEXT,
  adoption_stage_rationale TEXT,
  expectation_category TEXT CHECK (
    expectation_category IS NULL
    OR expectation_category IN (
      'SlowGrower',
      'Stalwart',
      'FastGrower',
      'AssetPlay',
      'Cyclical',
      'Turnaround'
    )
  ),
  holder_tags TEXT NOT NULL DEFAULT '[]',
  dividend_months TEXT NOT NULL DEFAULT '[]',
  defensive_strength TEXT,
  last_round_valuation REAL,
  private_credit_backing TEXT,
  is_kept INTEGER NOT NULL DEFAULT 0,
  revenue_growth REAL,
  fcf_margin REAL,
  fcf REAL,
  fcf_yield REAL,
  listing_date TEXT,
  market_cap REAL,
  listing_price REAL,
  next_earnings_date TEXT,
  memo TEXT,
  is_bookmarked INTEGER NOT NULL DEFAULT 0,
  instrument_meta_synced_at TEXT,
  FOREIGN KEY (theme_id) REFERENCES investment_themes(id) ON DELETE CASCADE,
  UNIQUE (theme_id, ticker)
);

INSERT INTO theme_ecosystem_members_new (
  id, theme_id, ticker, company_name, field, role, is_major_player, observation_started_at,
  is_unlisted, proxy_ticker, estimated_ipo_date, estimated_valuation, observation_notes,
  adoption_stage, adoption_stage_rationale, expectation_category,
  holder_tags, dividend_months, defensive_strength,
  last_round_valuation, private_credit_backing, is_kept,
  revenue_growth, fcf_margin, fcf, fcf_yield,
  listing_date, market_cap, listing_price, next_earnings_date, memo, is_bookmarked, instrument_meta_synced_at
)
SELECT
  id, theme_id, ticker, company_name, field, role, is_major_player, observation_started_at,
  is_unlisted, proxy_ticker, estimated_ipo_date, estimated_valuation, observation_notes,
  adoption_stage, adoption_stage_rationale,
  CASE expectation_category
    WHEN 'SlowGrower' THEN 'SlowGrower'
    WHEN 'Stalwart' THEN 'Stalwart'
    WHEN 'FastGrower' THEN 'FastGrower'
    WHEN 'AssetPlay' THEN 'AssetPlay'
    WHEN 'Cyclical' THEN 'Cyclical'
    WHEN 'Turnaround' THEN 'Turnaround'
    WHEN 'Growth' THEN 'FastGrower'
    WHEN 'Recovery' THEN 'Turnaround'
    WHEN 'Quality' THEN 'Stalwart'
    WHEN 'Value' THEN 'AssetPlay'
    WHEN 'Heritage' THEN 'SlowGrower'
    ELSE NULL
  END,
  holder_tags, dividend_months, defensive_strength,
  last_round_valuation, private_credit_backing, is_kept,
  revenue_growth, fcf_margin, fcf, fcf_yield,
  listing_date, market_cap, listing_price, next_earnings_date, memo, is_bookmarked, instrument_meta_synced_at
FROM theme_ecosystem_members;

DROP TABLE theme_ecosystem_members;
ALTER TABLE theme_ecosystem_members_new RENAME TO theme_ecosystem_members;

CREATE INDEX IF NOT EXISTS idx_theme_ecosystem_theme
  ON theme_ecosystem_members(theme_id, field);

CREATE UNIQUE INDEX IF NOT EXISTS idx_theme_ecosystem_members_theme_ticker_unique
  ON theme_ecosystem_members(theme_id, ticker);

COMMIT;

PRAGMA foreign_keys = ON;
