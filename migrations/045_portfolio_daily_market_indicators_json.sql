-- 日次スナップショット行に Market glance（数値配列）を同梱。CSV/分析用に join 不要で参照可能。
-- Apply: tsx scripts/apply-migration.ts migrations/045_portfolio_daily_market_indicators_json.sql

PRAGMA foreign_keys = ON;

ALTER TABLE portfolio_daily_snapshots ADD COLUMN market_indicators_json TEXT;

-- 既存行: 同日の market_glance_snapshots から補完（存在する場合のみ）
UPDATE portfolio_daily_snapshots
SET market_indicators_json = (
  SELECT m.payload_json
  FROM market_glance_snapshots m
  WHERE m.user_id = portfolio_daily_snapshots.user_id
    AND m.snapshot_date = portfolio_daily_snapshots.snapshot_date
)
WHERE market_indicators_json IS NULL
  AND EXISTS (
    SELECT 1
    FROM market_glance_snapshots m2
    WHERE m2.user_id = portfolio_daily_snapshots.user_id
      AND m2.snapshot_date = portfolio_daily_snapshots.snapshot_date
  );
