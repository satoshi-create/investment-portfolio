-- ユーザー×ティッカー単位のストーリー（メモ・決算要約・リンチ文）を一意に保持。
-- theme_ecosystem_members / holdings と二重保存するが、読み取りは本テーブルを優先する。
-- Apply: npm run db:apply -- migrations/062_ticker_story_hub.sql

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ticker_story_hub (
  user_id TEXT NOT NULL,
  ticker TEXT NOT NULL,
  memo TEXT,
  earnings_summary_note TEXT,
  lynch_drivers_narrative TEXT,
  lynch_story_text TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, ticker)
);

CREATE INDEX IF NOT EXISTS idx_ticker_story_hub_user ON ticker_story_hub(user_id);

-- holdings から初期投入（同一 user のティッカーごとに最新 id は問わず代表値）
INSERT OR IGNORE INTO ticker_story_hub (user_id, ticker, memo, earnings_summary_note, lynch_drivers_narrative, lynch_story_text, updated_at)
SELECT user_id,
       UPPER(TRIM(ticker)),
       memo,
       earnings_summary_note,
       lynch_drivers_narrative,
       lynch_story_text,
       datetime('now')
FROM holdings
WHERE COALESCE(TRIM(ticker), '') != '';

-- テーマメンバーから不足キーを補完（同一ティッカーで hub が無いときのみ）
INSERT OR IGNORE INTO ticker_story_hub (user_id, ticker, memo, earnings_summary_note, lynch_drivers_narrative, lynch_story_text, updated_at)
SELECT t.user_id,
       UPPER(TRIM(m.ticker)),
       m.memo,
       m.earnings_summary_note,
       m.lynch_drivers_narrative,
       m.lynch_story_text,
       datetime('now')
FROM theme_ecosystem_members m
INNER JOIN investment_themes t ON m.theme_id = t.id
WHERE COALESCE(TRIM(m.ticker), '') != '';
