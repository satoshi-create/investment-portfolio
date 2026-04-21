-- Upgrade from 042 v1 (`founded_date`) to `listing_date` + instrument sync watermark.
-- Fresh installs: use migrations/042_investment_instrument_meta.sql (listing_date) only; skip this file.
-- Apply when upgrading an existing DB that had `founded_date`:
--   turso db shell <db> < migrations/043_listing_date_and_meta_sync.sql

ALTER TABLE holdings RENAME COLUMN founded_date TO listing_date;
ALTER TABLE theme_ecosystem_members RENAME COLUMN founded_date TO listing_date;

ALTER TABLE holdings ADD COLUMN instrument_meta_synced_at TEXT;
ALTER TABLE theme_ecosystem_members ADD COLUMN instrument_meta_synced_at TEXT;
