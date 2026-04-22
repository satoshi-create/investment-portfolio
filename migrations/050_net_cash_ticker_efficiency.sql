-- Net cash (balance sheet: liquid assets − total debt) for ticker_efficiency_metrics.
-- Populated by scripts/fetch-fmp-metrics.ts (FMP annual balance sheet + quote shares).
-- Apply: npm run db:apply -- migrations/050_net_cash_ticker_efficiency.sql

PRAGMA foreign_keys = ON;

ALTER TABLE ticker_efficiency_metrics ADD COLUMN net_cash REAL;
