-- モビリティ・リファクタリング OS: Chasm / Moat / 垂直統合スコア（theme_ecosystem_members）
-- テーマシード: BYD, TSLA, 7203, NIO
-- Apply: npx tsx scripts/apply-migration.ts migrations/055_mobility_refactoring_theme.sql

PRAGMA foreign_keys = ON;

ALTER TABLE theme_ecosystem_members ADD COLUMN chasm TEXT;
ALTER TABLE theme_ecosystem_members ADD COLUMN moat TEXT;
ALTER TABLE theme_ecosystem_members ADD COLUMN vi_score INTEGER;

INSERT INTO investment_themes (id, user_id, name, description, goal, created_at)
SELECT
  'theme-seed-mobility-refactoring',
  'user-satoshi',
  'モビリティ・リファクタリング',
  '移動のOSを書き換える局面で、パラダイムシフトの「深淵（キャズム）」と参入障壁の「堀」、および垂直統合（VI）を観測する。',
  '地政学・規制・データの複利の下で、モビリティ・スタックの再編から構造αを採取する。',
  datetime('now')
WHERE NOT EXISTS (
  SELECT 1 FROM investment_themes t WHERE t.id = 'theme-seed-mobility-refactoring'
);

UPDATE investment_themes
SET
  name = 'モビリティ・リファクタリング',
  description = '移動のOSを書き換える局面で、パラダイムシフトの「深淵（キャズム）」と参入障壁の「堀」、および垂直統合（VI）を観測する。',
  goal = '地政学・規制・データの複利の下で、モビリティ・スタックの再編から構造αを採取する。'
WHERE id = 'theme-seed-mobility-refactoring';

DELETE FROM theme_ecosystem_members WHERE theme_id = 'theme-seed-mobility-refactoring';

INSERT OR REPLACE INTO theme_ecosystem_members
  (id, theme_id, ticker, company_name, field, role, is_major_player, observation_started_at, chasm, moat, vi_score)
VALUES
  (
    'eco-mobility-byd',
    'theme-seed-mobility-refactoring',
    'BYD',
    'BYD Company Limited',
    'EV / 垂直統合',
    '万能の鍛冶屋',
    1,
    '2026-04-01',
    '地政学的ファイアウォール（100%超関税）の回避',
    '部品98%内製による圧倒的コスト始末',
    98
  ),
  (
    'eco-mobility-tsla',
    'theme-seed-mobility-refactoring',
    'TSLA',
    'Tesla Inc.',
    'ソフトウェア定義',
    '知能の仕掛け人',
    1,
    '2026-04-01',
    '物理世界の法規・規制への論理コードの着地',
    '数十億マイルの走行データによる学習の複利',
    85
  ),
  (
    'eco-mobility-7203',
    'theme-seed-mobility-refactoring',
    '7203',
    'トヨタ自動車',
    'レガシーOEM / 全固体',
    '公儀の御用商人',
    1,
    '2026-04-01',
    '組織DNAのソフトウェア・デファインドへの再コンパイル',
    'Lindy Effect（長年の信頼）と全固体電池への布石',
    60
  ),
  (
    'eco-mobility-nio',
    'theme-seed-mobility-refactoring',
    'NIO',
    'NIO Inc.',
    'BaaS / エネルギー',
    'エネルギー還流師',
    0,
    '2026-04-01',
    '物理インフラ構築に伴う巨額のキャッシュバーン',
    'BaaSプロトコルによる待機レイテンシの排除',
    70
  );
