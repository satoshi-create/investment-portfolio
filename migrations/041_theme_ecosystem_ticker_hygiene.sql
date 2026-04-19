-- Clean ecosystem tickers for Yahoo fundamentals fetch (placeholders, names-only, investment trusts).
-- Apply: npm run db:apply -- migrations/041_theme_ecosystem_ticker_hygiene.sql

PRAGMA foreign_keys = ON;

-- 1) 未上場・名称のみ・プレースホルダは Yahoo スキャンから外す
UPDATE theme_ecosystem_members
SET is_unlisted = 1
WHERE COALESCE(is_unlisted, 0) = 0
  AND (
    UPPER(TRIM(ticker)) LIKE 'N/A:%'
    OR UPPER(TRIM(ticker)) IN ('JERA', 'KIOXIA', 'RENOVA', 'TOSHIBA-EDS')
    OR (
      LENGTH(TRIM(REPLACE(UPPER(ticker), '.T', ''))) = 8
      AND TRIM(REPLACE(UPPER(ticker), '.T', '')) GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
    )
  );

-- 2) 取引所サフィックスの代表的な補正（コードのみで保存されていた行）
UPDATE theme_ecosystem_members
SET ticker = 'S32.AX'
WHERE TRIM(ticker) = 'S32';

UPDATE theme_ecosystem_members
SET ticker = 'REP.MC'
WHERE TRIM(ticker) = 'REP';

-- 3) 無効行の削除（プレースホルダのみ）
DELETE FROM theme_ecosystem_members
WHERE TRIM(ticker) IN ('-', 'N/A')
   OR TRIM(ticker) = '';
