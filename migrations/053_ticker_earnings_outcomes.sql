-- Per-ticker earnings outcomes: surprise % vs consensus and post-event price reaction.
-- Populated manually, by a future script, or external ETL. Koyomi 2.0 reads this for quality labels.
-- Apply: npm run db:apply -- migrations/053_ticker_earnings_outcomes.sql

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ticker_earnings_outcomes (
  ticker TEXT NOT NULL,
  earnings_ymd TEXT NOT NULL,
  eps_surprise_pct REAL,
  revenue_surprise_pct REAL,
  price_impact_pct REAL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (ticker, earnings_ymd)
);

CREATE INDEX IF NOT EXISTS idx_ticker_earnings_outcomes_ymd
  ON ticker_earnings_outcomes(earnings_ymd);
