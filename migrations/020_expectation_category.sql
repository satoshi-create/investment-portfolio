-- Watanabe-style expectation quality on holdings and theme ecosystem members.
-- Apply: turso db shell <db> < migrations/020_expectation_category.sql
-- After this, apply migrations/049_lynch_expectation_category.sql to switch allowed values
-- from Watanabe 5 to Peter Lynch 6 (rebuilds CHECK constraints).

ALTER TABLE holdings ADD COLUMN expectation_category TEXT CHECK (
  expectation_category IS NULL
  OR expectation_category IN ('Growth', 'Recovery', 'Quality', 'Value', 'Heritage')
);

ALTER TABLE theme_ecosystem_members ADD COLUMN expectation_category TEXT CHECK (
  expectation_category IS NULL
  OR expectation_category IN ('Growth', 'Recovery', 'Quality', 'Value', 'Heritage')
);
