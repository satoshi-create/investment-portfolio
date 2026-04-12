-- Watanabe-style expectation quality on holdings and theme ecosystem members.
-- Apply: turso db shell <db> < migrations/020_expectation_category.sql

ALTER TABLE holdings ADD COLUMN expectation_category TEXT CHECK (
  expectation_category IS NULL
  OR expectation_category IN ('Growth', 'Recovery', 'Quality', 'Value', 'Heritage')
);

ALTER TABLE theme_ecosystem_members ADD COLUMN expectation_category TEXT CHECK (
  expectation_category IS NULL
  OR expectation_category IN ('Growth', 'Recovery', 'Quality', 'Value', 'Heritage')
);
