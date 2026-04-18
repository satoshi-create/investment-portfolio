-- Sum of share quantities for US + JP listed equities excluding ETF/fund-like names (see isLikelyEtfOrFundHolding).
-- Apply: turso db shell <db> < migrations/033_portfolio_snapshots_non_etf_listed_equity_quantity.sql

PRAGMA foreign_keys = ON;

ALTER TABLE portfolio_daily_snapshots ADD COLUMN non_etf_listed_equity_quantity_total REAL;
