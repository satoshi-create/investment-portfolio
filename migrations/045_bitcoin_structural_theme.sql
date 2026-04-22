-- 構造投資テーマ「ビットコイン」: UI は ThemeStructuralPageClient の isBitcoinTheme で専用レンズ表示。
-- URL: /themes/bitcoin または /themes/ビットコイン（エンコード）
-- Apply: turso db shell <db> < migrations/045_bitcoin_structural_theme.sql

PRAGMA foreign_keys = ON;

INSERT INTO investment_themes (id, user_id, name, description, goal, created_at)
SELECT
  'theme-seed-bitcoin-structural',
  'user-satoshi',
  'ビットコイン',
  '発行上限と半減期という「プログラムされた供給」と、現物 ETF による機関需要の二層で BTC を観測する。価格だけでなく取引所残高・保有構造・採算（ハッシュレート）など、レイヤー別のデータをこのテーマに集約する。',
  'ボラティリティに惑わされず、需要のレジーム（ETF フロー）と流動性（取引所・長短保有）の変化を手掛かりに、構造的な押し目とリスクを切り分ける。',
  datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM investment_themes t WHERE t.id = 'theme-seed-bitcoin-structural');

INSERT OR REPLACE INTO theme_ecosystem_members
  (id, theme_id, ticker, company_name, field, role, is_major_player, observation_started_at)
VALUES
  (
    'eco-btc-ibit',
    'theme-seed-bitcoin-structural',
    'IBIT',
    'iShares Bitcoin Trust ETF',
    '現物ETF / 機関需要プロキシ',
    'レイヤー: 需要構造 — 米国現物 ETF の代表。フローとナビ乖離を追う手掛かり。',
    1,
    '2024-01-01'
  );
