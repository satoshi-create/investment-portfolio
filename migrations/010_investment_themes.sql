-- Structural investment themes (Notion migration). First element of holdings.structure_tags should match name.
-- Apply: turso db shell <db> < migrations/010_investment_themes.sql

CREATE TABLE IF NOT EXISTS investment_themes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  goal TEXT,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_investment_themes_user
  ON investment_themes(user_id, name);
