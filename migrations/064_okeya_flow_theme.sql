-- 風が吹けば桶屋が儲かる（テンバーガー候補研究）
-- URL: /themes/okeya-flow（ThemeStructuralPageClient mapThemeLabelForQuery）
-- Apply: npm run db:apply -- migrations/064_okeya_flow_theme.sql

PRAGMA foreign_keys = ON;

INSERT INTO investment_themes (id, user_id, name, description, goal, created_at)
SELECT
  'theme-seed-okeya-flow',
  'user-satoshi',
  '風が吹けば桶屋が儲かる（テンバーガー候補研究）',
  '外部環境の「風」と収益への着地「桶屋」を因果テキストでつなぎ、テンバーガー候補をエコシステム・ウォッチで観測する。',
  '一覧性と因果の説明を優先し、銘柄ごとのフローを構造投資 OS 上で継続更新する。',
  datetime('now')
WHERE NOT EXISTS (
  SELECT 1 FROM investment_themes t WHERE t.id = 'theme-seed-okeya-flow'
);

INSERT OR REPLACE INTO theme_ecosystem_members
  (id, theme_id, ticker, company_name, field, role, is_major_player, observation_notes)
VALUES
  ('okeya-7532', 'theme-seed-okeya-flow', '7532.T', 'ペッパーフードサービス（PPIH）', 'テンバーガー候補', '民の台所・OSインフレ／値上げ耐性でディスカウントに人流', 1, 'okeya-flow:v1'),
  ('okeya-8185', 'theme-seed-okeya-flow', '8185.T', 'チヨダウーテ', 'テンバーガー候補', '物理UXの刷新・タイパ需要の高まり', 0, 'okeya-flow:v1'),
  ('okeya-3134', 'theme-seed-okeya-flow', '3134.T', 'ハミー（Hamee）', 'テンバーガー候補', '子宝・家族／SNS・AI時代の法規環境の変化', 0, 'okeya-flow:v1'),
  ('okeya-3692', 'theme-seed-okeya-flow', '3692.T', 'FFRIセキュリティ', 'テンバーガー候補', '迎撃型エンジン／サイバー攻撃の常態化', 0, 'okeya-flow:v1'),
  ('okeya-278a', 'theme-seed-okeya-flow', '278A.T', 'テラドローン', 'テンバーガー候補', '天空インフラの老朽化・点検コスト増／人手不足', 0, 'okeya-flow:v1'),
  ('okeya-3402', 'theme-seed-okeya-flow', '3402.T', '東レ', 'テンバーガー候補', '素材革新／マラソン軽量化など耐久スポーツの潮流', 1, 'okeya-flow:v1'),
  ('okeya-6273', 'theme-seed-okeya-flow', '6273.T', 'SMC', 'テンバーガー候補', '省エネ・機器小型化／電気代補助・設備投資インセンティブ', 1, 'okeya-flow:v1'),
  ('okeya-9010', 'theme-seed-okeya-flow', '9010.T', '富士急行', 'テンバーガー候補', '近場レジャー／地政学リスクで遠距離旅行が抑制されやすい局面', 0, 'okeya-flow:v1');
