-- Optional hardening: unique (theme_id, ticker) for theme_ecosystem_members
--
-- The canonical schema in migrations/011_theme_ecosystem_members.sql already declares:
--   UNIQUE (theme_id, ticker)
-- on CREATE TABLE, and schema_dump.sql matches that definition.
--
-- Use this file only if you have an older database created without that constraint
-- and need to enforce uniqueness without recreating the table.
-- If duplicate (theme_id, ticker) rows already exist, deduplicate before running.
--
-- SQLite: explicit unique index (idempotent name).
CREATE UNIQUE INDEX IF NOT EXISTS idx_theme_ecosystem_members_theme_ticker_unique
  ON theme_ecosystem_members(theme_id, ticker);
