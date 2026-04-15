-- Add metadata columns for Periodic Table dashboard.
-- Apply: turso db shell <db> < migrations/025_periodic_table_watchlist_meta.sql

ALTER TABLE periodic_table_watchlist ADD COLUMN name_ja TEXT;
ALTER TABLE periodic_table_watchlist ADD COLUMN uses_json TEXT NOT NULL DEFAULT '[]';

