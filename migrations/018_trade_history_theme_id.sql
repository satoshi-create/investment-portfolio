-- 取引と構造投資テーマ（investment_themes）の紐付け。テーマ別収益分析用。
-- Apply: turso db shell <db> < migrations/018_trade_history_theme_id.sql

PRAGMA foreign_keys = ON;

ALTER TABLE trade_history ADD COLUMN theme_id TEXT REFERENCES investment_themes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_trade_history_theme_id ON trade_history(theme_id);
