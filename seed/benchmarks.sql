-- Idempotent seed: ensure Alpha / FK baseline rows exist for `benchmarks`.
-- Run after schema.sql (or any time) against Turso / local libSQL.
-- VOO is required for `alpha_history.benchmark_ticker` FK and signal rules.

INSERT OR IGNORE INTO benchmarks (ticker, name) VALUES
  ('VOO', 'Vanguard S&P 500 ETF');
