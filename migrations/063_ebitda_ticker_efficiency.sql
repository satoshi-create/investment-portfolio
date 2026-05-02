-- EBITDA（現地通貨・年次ベース推奨）を ticker_efficiency_metrics に追加。
-- Apply: npm run db:apply -- migrations/063_ebitda_ticker_efficiency.sql

ALTER TABLE ticker_efficiency_metrics ADD COLUMN ebitda REAL;
