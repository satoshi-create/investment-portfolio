-- 構造投資テーマ: AIユニコーン（未上場/プレIPO + プライベートクレジットの源流）
-- Apply: turso db shell <db> < migrations/029_ai_unicorns_theme.sql
--
-- Prereq:
-- - migrations/010_investment_themes.sql
-- - migrations/011_theme_ecosystem_members.sql
-- - scripts/migrate-theme-ecosystem-unlisted.ts (or equivalent ALTERs)
-- - migrations/030_theme_ecosystem_unicorn_fields.sql (optional for credit/valuation fields)

PRAGMA foreign_keys = ON;

INSERT INTO investment_themes (id, user_id, name, description, goal, created_at)
SELECT
  'theme-seed-ai-unicorns',
  'user-satoshi',
  'AIユニコーン',
  '未上場のAI中核プレイヤーを「構造」として追跡するテーマ。価格が無い期間は proxy ticker の Alpha を「影」として観測し、資本の供給源（Private credit / Big Tech）と IPO 予定（Mining schedule）を同時に可視化する。',
  '地下水脈（Credit Stream）→ 熱量蓄積 → 地表への噴出（IPO）までを、同じダッシュボード上で10分パトロールできる状態にする。',
  datetime('now')
WHERE NOT EXISTS (
  SELECT 1 FROM investment_themes t
  WHERE t.id = 'theme-seed-ai-unicorns'
);

UPDATE investment_themes
SET
  name = 'AIユニコーン',
  description = '未上場のAI中核プレイヤーを「構造」として追跡するテーマ。価格が無い期間は proxy ticker の Alpha を「影」として観測し、資本の供給源（Private credit / Big Tech）と IPO 予定（Mining schedule）を同時に可視化する。',
  goal = '地下水脈（Credit Stream）→ 熱量蓄積 → 地表への噴出（IPO）までを、同じダッシュボード上で10分パトロールできる状態にする。'
WHERE id = 'theme-seed-ai-unicorns';

DELETE FROM theme_ecosystem_members WHERE theme_id = 'theme-seed-ai-unicorns';

-- Notes:
-- - ticker: dummy for unlisted ("N/A:...") to keep unique constraint stable.
-- - proxy_ticker: listed ticker used for alpha/price observation while unlisted.
-- - observation_notes: include "構造:" line for UnicornCard.
-- - private_credit_backing: "Name weight; Name weight" (UI renders thickness).
INSERT OR REPLACE INTO theme_ecosystem_members
  (id, theme_id, ticker, company_name, field, role, is_major_player, observation_started_at,
   is_unlisted, proxy_ticker, estimated_ipo_date, estimated_valuation, last_round_valuation, private_credit_backing, observation_notes)
VALUES
  ('eco-unicorn-anthropic', 'theme-seed-ai-unicorns', 'N/A:ANTHROPIC', 'Anthropic', '基盤モデル', '安全重視の知性', 1, '2026-01-01',
    1, 'AMZN', '2027.Q1', 'TBD', 380000000000, 'Amazon 60; Google 40; Apollo 20 (Infra)',
    '構造: Google/Amazonとの深化した提携。Claude Codeが開発市場を席巻。'),

  ('eco-unicorn-openai', 'theme-seed-ai-unicorns', 'N/A:OPENAI', 'OpenAI', '基盤モデル', '絶対的王者', 1, '2026-01-01',
    1, 'MSFT', '2027.H2', 'TBD', 730000000000, 'SoftBank 30; Nvidia 30; Amazon 50; Apollo-Blackstone Consortium 100(Debt)',
    '構造: AGI開発に向けた歴史上最大の資本投下。週次アクティブ1.6MのCodexが牽引。'),

  ('eco-unicorn-xai', 'theme-seed-ai-unicorns', 'N/A:XAI', 'xAI', '基盤モデル', '加速する特異点', 1, '2026-01-01',
    1, 'TSLA', '2026.12', 'TBD', 100000000000, 'Elon network 60; Apollo 25; Ares 15',
    '構造: GPUクラスタ「Colossus」の拡張をデットで加速。Tesla/Xとの垂直統合。'),

  ('eco-unicorn-databricks', 'theme-seed-ai-unicorns', 'N/A:DATABRICKS', 'Databricks', 'データ基盤', 'データの貯水池', 1, '2026-01-01',
    1, 'SNOW', '2026.Q4', 'TBD', 134000000000, 'Microsoft 40; Blackstone 30; Apollo 30; $2B Debt Capacity',
    '構造: 収益ランレート$5.4B到達。Lakebaseによるエージェント基盤の覇権。'),

  ('eco-unicorn-cerebras', 'theme-seed-ai-unicorns', 'N/A:CEREBRAS', 'Cerebras', 'AIハードウェア', '巨大回路の彫刻家', 0, '2026-01-01',
    1, 'NVDA', '2026.06', 'TBD', 23000000000, 'OpenAI Partnership 10B; Apollo 40',
    '構造: OpenAI向け10Bドルの計算機供給契約を背景にIPO直前。'),

  ('eco-unicorn-coreweave', 'theme-seed-ai-unicorns', 'N/A:COREWEAVE', 'CoreWeave', '計算資源', '計算資源のインフラ', 1, '2026-01-01',
    1, 'NVDA', '2026.H2', 'TBD', 50000000000, 'Blackstone 45; Apollo 35; Nvidia 20; $31B Capex Financing',
    '構造: GPU担保融資の旗手。2026年中に電力容量1.7GWを達成予定。'),

  ('eco-unicorn-canva', 'theme-seed-ai-unicorns', 'N/A:CANVA', 'Canva', 'アプリ層', '創造性の民主化', 1, '2026-01-01',
    1, 'ADBE', '2027.Q2', 'TBD', 32000000000, 'TPG 40; Blackstone 30; Sequoia 30',
    '構造: 非上場最大のデザインSaaS。AI編集機能のサブスク好調。'),

  ('eco-unicorn-cohere', 'theme-seed-ai-unicorns', 'N/A:COHERE', 'Cohere', '企業特化', '企業特化の言語エンジン', 0, '2026-01-01',
    1, 'MSFT', NULL, 'TBD', 7000000000, 'Oracle 40; Nvidia 20; Blackstone 40',
    '構造: エンタープライズ特化。Series D1でセキュリティ重視の地位を確立。'),

  ('eco-unicorn-anduril', 'theme-seed-ai-unicorns', 'N/A:ANDURIL', 'Anduril', '国防AI', '国防AIの実装層', 1, '2026-01-01',
    1, 'LMT', '2027.Q3', 'TBD', 60000000000, 'Series H Post-Money; Blackstone 30',
    '構造: 宇宙・ミサイル防衛契約の相次ぐ獲得。国防OSのデファクト。'),

  ('eco-unicorn-cognition', 'theme-seed-ai-unicorns', 'N/A:COGNITION', 'Cognition AI', 'AIエージェント管理', 'AIエージェントの管制塔', 0, '2026-01-01',
    1, 'NOW', NULL, 'TBD', 2000000000, 'Apollo 50; Blackstone 50',
    '構造: 自律型エンジニアDevinを起点とする、企業内エージェントの指揮系統。');

