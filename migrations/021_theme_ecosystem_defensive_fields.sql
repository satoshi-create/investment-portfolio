-- Extend theme_ecosystem_members for Defensive Stocks theme.
-- Note: SQLite has no array types; store arrays as JSON TEXT.

PRAGMA foreign_keys = ON;

ALTER TABLE theme_ecosystem_members ADD COLUMN holder_tags TEXT NOT NULL DEFAULT '[]';
ALTER TABLE theme_ecosystem_members ADD COLUMN dividend_months TEXT NOT NULL DEFAULT '[]';
ALTER TABLE theme_ecosystem_members ADD COLUMN defensive_strength TEXT;

