-- Persist compounding ignition snapshot (backfilled close-only; API recomputes with Live hybrid).
-- Apply: npm run db:apply -- migrations/060_theme_ecosystem_compounding_ignited.sql

PRAGMA foreign_keys = ON;

ALTER TABLE theme_ecosystem_members
ADD COLUMN is_compounding_ignited INTEGER NOT NULL DEFAULT 0;
