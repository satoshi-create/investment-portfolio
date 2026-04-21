-- Instrument metadata shared by holdings + theme_ecosystem_members (listing date, market cap, IPO price, bookmarks).
-- Apply: turso db shell <db> < migrations/042_investment_instrument_meta.sql

ALTER TABLE holdings ADD COLUMN listing_date TEXT;
ALTER TABLE holdings ADD COLUMN market_cap REAL;
ALTER TABLE holdings ADD COLUMN listing_price REAL;
ALTER TABLE holdings ADD COLUMN next_earnings_date TEXT;
ALTER TABLE holdings ADD COLUMN memo TEXT;
ALTER TABLE holdings ADD COLUMN is_bookmarked INTEGER NOT NULL DEFAULT 0;
ALTER TABLE holdings ADD COLUMN instrument_meta_synced_at TEXT;

ALTER TABLE theme_ecosystem_members ADD COLUMN listing_date TEXT;
ALTER TABLE theme_ecosystem_members ADD COLUMN market_cap REAL;
ALTER TABLE theme_ecosystem_members ADD COLUMN listing_price REAL;
ALTER TABLE theme_ecosystem_members ADD COLUMN next_earnings_date TEXT;
ALTER TABLE theme_ecosystem_members ADD COLUMN memo TEXT;
ALTER TABLE theme_ecosystem_members ADD COLUMN is_bookmarked INTEGER NOT NULL DEFAULT 0;
ALTER TABLE theme_ecosystem_members ADD COLUMN instrument_meta_synced_at TEXT;
