-- Extend ticker efficiency metrics for FMP automation (Rule of 40、年換算FCF、動的FCF Yield用).
-- Apply: npm run db:apply -- migrations/039_ticker_efficiency_fmp_columns.sql

PRAGMA foreign_keys = ON;

ALTER TABLE ticker_efficiency_metrics ADD COLUMN annual_fcf REAL;
ALTER TABLE ticker_efficiency_metrics ADD COLUMN rule_of_40 REAL;
ALTER TABLE ticker_efficiency_metrics ADD COLUMN shares_outstanding REAL;
ALTER TABLE ticker_efficiency_metrics ADD COLUMN last_updated_at TEXT;
ALTER TABLE ticker_efficiency_metrics ADD COLUMN source TEXT;
