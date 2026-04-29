-- 機関投資家保有比率（Yahoo defaultKeyStatistics.heldPercentInstitutions、0.15 = 15%）
-- Apply: npx tsx scripts/apply-migration.ts migrations/057_institutional_ownership.sql

PRAGMA foreign_keys = ON;

ALTER TABLE holdings ADD COLUMN institutional_ownership REAL;
ALTER TABLE theme_ecosystem_members ADD COLUMN institutional_ownership REAL;
