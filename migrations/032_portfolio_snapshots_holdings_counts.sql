-- Portfolio snapshot: holding line counts vs prior calendar snapshot (holding_id match on holding_daily_snapshots).
-- Apply: turso db shell <db> < migrations/032_portfolio_snapshots_holdings_counts.sql

PRAGMA foreign_keys = ON;

ALTER TABLE portfolio_daily_snapshots ADD COLUMN holdings_count INTEGER;
ALTER TABLE portfolio_daily_snapshots ADD COLUMN holdings_added_count INTEGER;
ALTER TABLE portfolio_daily_snapshots ADD COLUMN holdings_removed_count INTEGER;
ALTER TABLE portfolio_daily_snapshots ADD COLUMN holdings_continuing_count INTEGER;
