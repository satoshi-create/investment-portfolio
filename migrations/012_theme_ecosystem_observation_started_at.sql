-- エコシステム銘柄の「投入日」＝ Alpha 観測開始の論理日（YYYY-MM-DD または ISO 日付文字列）
-- 既存 DB: 012 のみ適用。新規は schema.sql に含まれる。
-- Apply: turso db shell <db> < migrations/012_theme_ecosystem_observation_started_at.sql

PRAGMA foreign_keys = ON;

ALTER TABLE theme_ecosystem_members ADD COLUMN observation_started_at TEXT;
