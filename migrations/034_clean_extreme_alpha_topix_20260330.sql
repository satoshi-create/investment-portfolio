-- Optional one-off: remove corrupted daily alpha rows (e.g. Yahoo glitch → 89% vs TOPIX).
-- Review counts before applying in production.
-- Apply: turso db shell <db> < migrations/034_clean_extreme_alpha_topix_20260330.sql

DELETE FROM alpha_history
WHERE substr(recorded_at, 1, 10) = '2026-03-30'
  AND benchmark_ticker = '1306.T'
  AND alpha_value > 20;
