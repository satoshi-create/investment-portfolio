-- Extend theme_ecosystem_members for unlisted unicorn tracking (AIユニコーン).
-- Apply: turso db shell <db> < migrations/030_theme_ecosystem_unicorn_fields.sql

PRAGMA foreign_keys = ON;

ALTER TABLE theme_ecosystem_members ADD COLUMN last_round_valuation REAL;
ALTER TABLE theme_ecosystem_members ADD COLUMN private_credit_backing TEXT;

