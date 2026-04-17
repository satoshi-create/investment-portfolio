-- 保有銘柄ごとの決算要約メモ（ユーザー入力・任意）
-- Apply: turso db shell <db> < migrations/026_holdings_earnings_summary_note.sql

PRAGMA foreign_keys = ON;

ALTER TABLE holdings ADD COLUMN earnings_summary_note TEXT;
