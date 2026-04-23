-- theme_ecosystem_members: 決算要約メモ列の追加（holdings.earnings_summary_note と別）
-- category 列はアプリ現行版では未使用（将来 DROP 可）。既に適用済みの DB では残っていても動作に影響しません。
-- Apply: npm run db:apply -- migrations/052_theme_ecosystem_category_earnings_summary.sql

ALTER TABLE theme_ecosystem_members ADD COLUMN category TEXT;
ALTER TABLE theme_ecosystem_members ADD COLUMN earnings_summary_note TEXT;
