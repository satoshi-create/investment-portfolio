-- VOO 当日騰落 % を日次スナップショットに保持（履歴グラフ・PF 比較用）
-- Apply: turso db shell <db> < migrations/014_portfolio_daily_benchmark_change_pct.sql
-- Or: npx tsx scripts/migrate-portfolio-benchmark-change-pct.ts

ALTER TABLE portfolio_daily_snapshots ADD COLUMN benchmark_change_pct REAL;
