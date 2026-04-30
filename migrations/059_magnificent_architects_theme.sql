-- Magnificent Architects（推論主権の覇者）: FANG+ 周辺の物理層・論理層観測
-- URL: /themes/magnificent-architects（ThemeStructuralPageClient mapThemeLabelForQuery）
-- Apply: turso db shell <db> < migrations/059_magnificent_architects_theme.sql
-- 適用後 `npm run fetch:fundamentals` で ticker_efficiency（R40 等）を同期可能。

PRAGMA foreign_keys = ON;

INSERT INTO investment_themes (id, user_id, name, description, goal, created_at)
SELECT
  'theme-seed-magnificent-architects',
  'user-satoshi',
  'Magnificent Architects（推論主権の覇者）',
  'FANG+ を核に、半導体（物理層）と AI/OS（論理層）の切磋琢磨をエコシステム・ウォッチで観測する。計算資源の供給独占から独自チップ設計まで、推論主権の分布を追う。',
  '構造投資 OS 上で「推論主権」とチップ設計の結びつきを継続観測し、テーマ内の Rule of 40・フローとあわせて局面を切り分ける。',
  datetime('now')
WHERE NOT EXISTS (
  SELECT 1 FROM investment_themes t WHERE t.id = 'theme-seed-magnificent-architects'
);

INSERT OR REPLACE INTO theme_ecosystem_members
  (id, theme_id, ticker, company_name, field, role, is_major_player, observation_notes)
VALUES
  ('m7-nvda', 'theme-seed-magnificent-architects', 'NVDA', 'NVIDIA', '物理層', '公儀の番人：計算資源の独占供給', 1, 'structural: GATEKEEPER, chip: Blackwell'),
  ('m7-avgo', 'theme-seed-magnificent-architects', 'AVGO', 'Broadcom', '物理設計', '現代の刀鍛冶：M7独自チップの共同設計者', 1, 'structural: SWORDSMITH, asic_partner: GOOGL, META'),
  ('m7-googl', 'theme-seed-magnificent-architects', 'GOOGL', 'Alphabet', '論理/物理', '推論の開祖：TPUによる完全垂直統合', 1, 'chip: TPU v6, sovereignty: HIGH'),
  ('m7-msft', 'theme-seed-magnificent-architects', 'MSFT', 'Microsoft', '論理/インフラ', '連合艦隊の提督：Azure+OpenAIの計算基盤', 1, 'chip: Maia, ecosystem: OPENAI'),
  ('m7-meta', 'theme-seed-magnificent-architects', 'META', 'Meta', '論理/OS', '情報の要塞：Llamaと独自チップの密結合', 1, 'chip: MTIA, strategy: OPEN_SOURCE_AI'),
  ('m7-amzn', 'theme-seed-magnificent-architects', 'AMZN', 'Amazon', '物理/論理', '双発エンジンの巨神：物流とAWSの再結合', 1, 'chip: Trainium, partner: ANTHROPIC'),
  ('m7-tsm', 'theme-seed-magnificent-architects', 'TSM', 'TSMC', '物理層', '現代の鋳銭所：全ての設計を具現化する独占力', 1, 'process: 2nm, logic: FOUNDRY_MONOPOLY'),
  ('m7-nflx', 'theme-seed-magnificent-architects', 'NFLX', 'Netflix', 'サービス', 'デジタル興行主：AIによる感性の完全始末', 0, 'metrics: FCF_MACHINE'),
  ('m7-pltr', 'theme-seed-magnificent-architects', 'PLTR', 'Palantir', 'OS層', '戦場のデバッガー：現実空間の論理化', 0, 'structural: WAR_OS'),
  ('m7-crwd', 'theme-seed-magnificent-architects', 'CRWD', 'CrowdStrike', '防衛層', '論理の火消し：知能化する脅威への防波堤', 0, 'structural: SECURITY_OS');
