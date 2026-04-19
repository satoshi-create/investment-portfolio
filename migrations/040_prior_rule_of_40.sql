-- Optional prior-period Rule of 40 for ACCUMULATE / trend detection (judgment engine).
-- Apply: npm run db:apply -- migrations/040_prior_rule_of_40.sql

PRAGMA foreign_keys = ON;

ALTER TABLE ticker_efficiency_metrics ADD COLUMN prior_rule_of_40 REAL;
