-- 取引の理由・反省メモ（任意）
-- Apply: turso db shell <db> < migrations/016_trade_history_reason.sql

PRAGMA foreign_keys = ON;

ALTER TABLE trade_history ADD COLUMN reason TEXT;