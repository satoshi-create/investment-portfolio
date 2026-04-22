-- Per-holding snapshot: PEG & expected growth (Yahoo research at record time).
-- Apply: turso db shell <db> < migrations/048_holding_daily_snapshots_peg.sql

ALTER TABLE holding_daily_snapshots ADD COLUMN peg_ratio REAL;
ALTER TABLE holding_daily_snapshots ADD COLUMN expected_growth REAL;
