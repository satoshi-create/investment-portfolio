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
    1, 'AMZN', '2026.10', 'TBD', 60000000000, 'Amazon 60; Google 40',
    '構造: Google/Amazonの巨額資本による安全性重視のLLM\n観測: proxy=AMZN で「影のAlpha」を追う'),

  ('eco-unicorn-openai', 'theme-seed-ai-unicorns', 'N/A:OPENAI', 'OpenAI', '基盤モデル', '絶対的王者', 1, '2026-01-01',
    1, 'MSFT', NULL, 'TBD', 80000000000, 'Microsoft 70; Apollo 15; Blackstone 15',
    '構造: 業界のOSを狙うAGI開発の先駆者\nProxy: MSFT（相関の地表）'),

  ('eco-unicorn-xai', 'theme-seed-ai-unicorns', 'N/A:XAI', 'xAI', '基盤モデル', '加速する特異点', 1, '2026-01-01',
    1, 'TSLA', '2026.06', 'TBD', 50000000000, 'Elon network 60; Apollo 20; Ares 20',
    '構造: イーロン・マスクによる宇宙・防衛・AGIの垂直統合\nProxy: TSLA（物語β）'),

  ('eco-unicorn-databricks', 'theme-seed-ai-unicorns', 'N/A:DATABRICKS', 'Databricks', 'データ基盤', 'データの貯水池', 1, '2026-01-01',
    1, 'SNOW', NULL, 'TBD', 45000000000, 'Microsoft 50; Blackstone 30; Apollo 20',
    '構造: エンタープライズAIの基盤となるレイクハウス\nProxy: SNOW（同領域の地表）'),

  ('eco-unicorn-cerebras', 'theme-seed-ai-unicorns', 'N/A:CEREBRAS', 'Cerebras', 'AIハードウェア', '巨大回路の彫刻家', 0, '2026-01-01',
    1, 'NVDA', NULL, 'TBD', 4000000000, 'Apollo 40; Blackstone 30; KKR 30',
    '構造: NVIDIA対抗のAI特有巨大チップ\nProxy: NVDA（GPU市場の地表）'),

  ('eco-unicorn-coreweave', 'theme-seed-ai-unicorns', 'N/A:COREWEAVE', 'CoreWeave', '計算資源', '計算資源のインフラ', 1, '2026-01-01',
    1, 'NVDA', NULL, 'TBD', 19000000000, 'Blackstone 45; Apollo 35; Nvidia 20',
    '構造: GPU特化型クラウドの供給源\nProxy: NVDA（需要源泉）'),

  ('eco-unicorn-canva', 'theme-seed-ai-unicorns', 'N/A:CANVA', 'Canva', 'アプリ層', '創造性の民主化', 1, '2026-01-01',
    1, 'ADBE', NULL, 'TBD', 26000000000, 'TPG 40; Blackstone 30; Sequoia 30',
    '構造: デザインSaaSの覇者、Adobeへの挑戦状\nProxy: ADBE（既存覇権の地表）'),

  ('eco-unicorn-cohere', 'theme-seed-ai-unicorns', 'N/A:COHERE', 'Cohere', '企業特化', '企業特化の言語エンジン', 0, '2026-01-01',
    1, 'MSFT', NULL, 'TBD', 5500000000, 'Oracle 40; Nvidia 20; Blackstone 40',
    '構造: エンタープライズ特化LLM（データ境界内で動く実務エンジン）\nProxy: MSFT'),

  ('eco-unicorn-anduril', 'theme-seed-ai-unicorns', 'N/A:ANDURIL', 'Anduril', '国防AI', '国防AIの実装層', 1, '2026-01-01',
    1, 'LMT', NULL, 'TBD', 20000000000, 'Palantir network 40; Blackstone 30; Apollo 30',
    '構造: 防衛×自律の「現場OS」\nProxy: LMT（国防予算β）'),

  ('eco-unicorn-entire', 'theme-seed-ai-unicorns', 'N/A:ENTIRE', 'Entire', 'AIエージェント管理', 'AIエージェントの管制塔', 0, '2026-01-01',
    1, 'NOW', NULL, 'TBD', 1500000000, 'Apollo 50; Blackstone 50',
    '構造: エージェント群の「権限・監査・実行」レイヤー\nProxy: NOW（業務OSの地表）');

