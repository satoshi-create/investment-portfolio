PRAGMA foreign_keys = ON;

ALTER TABLE trade_history ADD COLUMN fee REAL NOT NULL DEFAULT 0;
ALTER TABLE trade_history ADD COLUMN fee_currency TEXT NOT NULL DEFAULT 'JPY';

