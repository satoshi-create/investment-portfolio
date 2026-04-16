-- Add `alpha_day` to `signals` to prevent duplicate alerts across runs.
-- - `detected_at`: when the generator ran (ISO timestamp)
-- - `alpha_day`: YYYY-MM-DD of the alpha_history point that triggered the rule
--
-- Apply: turso db shell <db> < migrations/024_signals_alpha_day.sql

PRAGMA foreign_keys = ON;

ALTER TABLE signals ADD COLUMN alpha_day TEXT;

-- Backfill for existing rows: historically `detected_at` encoded the alpha day (or at least the day portion).
UPDATE signals
SET alpha_day = substr(detected_at, 1, 10)
WHERE alpha_day IS NULL AND detected_at IS NOT NULL AND length(detected_at) >= 10;

CREATE INDEX IF NOT EXISTS idx_signals_alpha_day ON signals(alpha_day);
