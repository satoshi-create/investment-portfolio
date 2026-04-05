-- Ecosystem / watchlist tickers per structural theme (Notion migration).
-- Apply: turso db shell <db> < migrations/011_theme_ecosystem_members.sql

CREATE TABLE IF NOT EXISTS theme_ecosystem_members (
  id TEXT PRIMARY KEY,
  theme_id TEXT NOT NULL,
  ticker TEXT NOT NULL,
  company_name TEXT,
  field TEXT,
  role TEXT,
  is_major_player INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (theme_id) REFERENCES investment_themes(id) ON DELETE CASCADE,
  UNIQUE (theme_id, ticker)
);

CREATE INDEX IF NOT EXISTS idx_theme_ecosystem_theme
  ON theme_ecosystem_members(theme_id, field);
