-- ストーリー正本の集約: `ticker_story_hub` を埋めたうえで、
-- `holdings` / `theme_ecosystem_members` の重複列（memo, earnings_summary_note, lynch_*）を NULL にする。
-- 前提: `062_ticker_story_hub.sql` 適用済み（`ticker_story_hub` テーブルあり）。
-- 衝突解決: 各列について hub が空なら holdings を優先し、なお空ならテーマ行のうち最長テキストを採用。
-- ロールバック: 本マイグレーションは NULL 化のみのため、正本からの復元は手動または別スクリプトが必要。
-- Apply: npm run db:apply -- migrations/065_ticker_story_hub_canonical.sql
-- 本番適用前: Turso ダッシュボードまたは `turso db shell` で DB をバックアップしてください。

PRAGMA foreign_keys = ON;

-- 1) holdings にあって hub に無いキーを追加
INSERT OR IGNORE INTO ticker_story_hub (user_id, ticker, memo, earnings_summary_note, lynch_drivers_narrative, lynch_story_text, updated_at)
SELECT h.user_id,
       UPPER(TRIM(h.ticker)),
       NULL,
       NULL,
       NULL,
       NULL,
       datetime('now')
FROM holdings h
WHERE COALESCE(TRIM(h.ticker), '') != '';

-- 2) テーマメンバーにあって hub に無いキーを追加
INSERT OR IGNORE INTO ticker_story_hub (user_id, ticker, memo, earnings_summary_note, lynch_drivers_narrative, lynch_story_text, updated_at)
SELECT t.user_id,
       UPPER(TRIM(m.ticker)),
       NULL,
       NULL,
       NULL,
       NULL,
       datetime('now')
FROM theme_ecosystem_members m
INNER JOIN investment_themes t ON m.theme_id = t.id
WHERE COALESCE(TRIM(m.ticker), '') != '';

-- 3) 空の hub 列を holdings から補完（列ごと）
UPDATE ticker_story_hub AS hub
SET memo = (
  SELECT h.memo FROM holdings h
  WHERE h.user_id = hub.user_id AND UPPER(TRIM(h.ticker)) = hub.ticker
    AND h.memo IS NOT NULL AND LENGTH(TRIM(CAST(h.memo AS TEXT))) > 0
  LIMIT 1
)
WHERE hub.memo IS NULL OR LENGTH(TRIM(COALESCE(hub.memo, ''))) = 0;

UPDATE ticker_story_hub AS hub
SET earnings_summary_note = (
  SELECT h.earnings_summary_note FROM holdings h
  WHERE h.user_id = hub.user_id AND UPPER(TRIM(h.ticker)) = hub.ticker
    AND h.earnings_summary_note IS NOT NULL AND LENGTH(TRIM(CAST(h.earnings_summary_note AS TEXT))) > 0
  LIMIT 1
)
WHERE hub.earnings_summary_note IS NULL OR LENGTH(TRIM(COALESCE(hub.earnings_summary_note, ''))) = 0;

UPDATE ticker_story_hub AS hub
SET lynch_drivers_narrative = (
  SELECT h.lynch_drivers_narrative FROM holdings h
  WHERE h.user_id = hub.user_id AND UPPER(TRIM(h.ticker)) = hub.ticker
    AND h.lynch_drivers_narrative IS NOT NULL AND LENGTH(TRIM(CAST(h.lynch_drivers_narrative AS TEXT))) > 0
  LIMIT 1
)
WHERE hub.lynch_drivers_narrative IS NULL OR LENGTH(TRIM(COALESCE(hub.lynch_drivers_narrative, ''))) = 0;

UPDATE ticker_story_hub AS hub
SET lynch_story_text = (
  SELECT h.lynch_story_text FROM holdings h
  WHERE h.user_id = hub.user_id AND UPPER(TRIM(h.ticker)) = hub.ticker
    AND h.lynch_story_text IS NOT NULL AND LENGTH(TRIM(CAST(h.lynch_story_text AS TEXT))) > 0
  LIMIT 1
)
WHERE hub.lynch_story_text IS NULL OR LENGTH(TRIM(COALESCE(hub.lynch_story_text, ''))) = 0;

-- 4) なお空の列をテーマメンバーから補完（同一ティッカー複数行は LENGTH 最大を採用）
UPDATE ticker_story_hub AS hub
SET memo = (
  SELECT m.memo FROM theme_ecosystem_members m
  INNER JOIN investment_themes t ON m.theme_id = t.id
  WHERE t.user_id = hub.user_id AND UPPER(TRIM(m.ticker)) = hub.ticker
    AND m.memo IS NOT NULL AND LENGTH(TRIM(CAST(m.memo AS TEXT))) > 0
  ORDER BY LENGTH(CAST(m.memo AS TEXT)) DESC
  LIMIT 1
)
WHERE hub.memo IS NULL OR LENGTH(TRIM(COALESCE(hub.memo, ''))) = 0;

UPDATE ticker_story_hub AS hub
SET earnings_summary_note = (
  SELECT m.earnings_summary_note FROM theme_ecosystem_members m
  INNER JOIN investment_themes t ON m.theme_id = t.id
  WHERE t.user_id = hub.user_id AND UPPER(TRIM(m.ticker)) = hub.ticker
    AND m.earnings_summary_note IS NOT NULL AND LENGTH(TRIM(CAST(m.earnings_summary_note AS TEXT))) > 0
  ORDER BY LENGTH(CAST(m.earnings_summary_note AS TEXT)) DESC
  LIMIT 1
)
WHERE hub.earnings_summary_note IS NULL OR LENGTH(TRIM(COALESCE(hub.earnings_summary_note, ''))) = 0;

UPDATE ticker_story_hub AS hub
SET lynch_drivers_narrative = (
  SELECT m.lynch_drivers_narrative FROM theme_ecosystem_members m
  INNER JOIN investment_themes t ON m.theme_id = t.id
  WHERE t.user_id = hub.user_id AND UPPER(TRIM(m.ticker)) = hub.ticker
    AND m.lynch_drivers_narrative IS NOT NULL AND LENGTH(TRIM(CAST(m.lynch_drivers_narrative AS TEXT))) > 0
  ORDER BY LENGTH(CAST(m.lynch_drivers_narrative AS TEXT)) DESC
  LIMIT 1
)
WHERE hub.lynch_drivers_narrative IS NULL OR LENGTH(TRIM(COALESCE(hub.lynch_drivers_narrative, ''))) = 0;

UPDATE ticker_story_hub AS hub
SET lynch_story_text = (
  SELECT m.lynch_story_text FROM theme_ecosystem_members m
  INNER JOIN investment_themes t ON m.theme_id = t.id
  WHERE t.user_id = hub.user_id AND UPPER(TRIM(m.ticker)) = hub.ticker
    AND m.lynch_story_text IS NOT NULL AND LENGTH(TRIM(CAST(m.lynch_story_text AS TEXT))) > 0
  ORDER BY LENGTH(CAST(m.lynch_story_text AS TEXT)) DESC
  LIMIT 1
)
WHERE hub.lynch_story_text IS NULL OR LENGTH(TRIM(COALESCE(hub.lynch_story_text, ''))) = 0;

UPDATE ticker_story_hub SET updated_at = datetime('now');

-- 5) デノーマライズ列をクリア（表示は hub 優先。アプリは 065 以降正本のみに書き込む）
UPDATE theme_ecosystem_members
SET memo = NULL,
    earnings_summary_note = NULL,
    lynch_drivers_narrative = NULL,
    lynch_story_text = NULL;

UPDATE holdings
SET memo = NULL,
    earnings_summary_note = NULL,
    lynch_drivers_narrative = NULL,
    lynch_story_text = NULL;
