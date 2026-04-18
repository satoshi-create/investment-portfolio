-- Bookmark / keep flag for ecosystem watchlist candidates (theme_ecosystem_members).
-- Apply: turso db shell <db> < migrations/036_theme_ecosystem_members_is_kept.sql

ALTER TABLE theme_ecosystem_members ADD COLUMN is_kept INTEGER NOT NULL DEFAULT 0;
