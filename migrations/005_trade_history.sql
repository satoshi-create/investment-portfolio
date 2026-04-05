PRAGMA foreign_keys = ON;

-- 完了済み売買（ダッシュボード「取引履歴」用）。金額は円建てで保持。
CREATE TABLE IF NOT EXISTS trade_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  trade_date TEXT NOT NULL,
  ticker TEXT NOT NULL,
  name TEXT NOT NULL,
  market TEXT NOT NULL CHECK (market IN ('JP', 'US')),
  account_name TEXT NOT NULL DEFAULT '特定',
  side TEXT NOT NULL CHECK (side IN ('BUY', 'SELL')),
  quantity REAL NOT NULL,
  cost_jpy REAL NOT NULL,
  proceeds_jpy REAL NOT NULL,
  fees_jpy REAL NOT NULL DEFAULT 0,
  realized_pnl_jpy REAL NOT NULL,
  provider_symbol TEXT,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_trade_history_user_date
  ON trade_history(user_id, trade_date DESC);
