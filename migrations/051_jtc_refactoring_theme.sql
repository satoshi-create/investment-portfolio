-- 構造投資テーマ「JTCリファクタリング」: レガシーJTCの再編・圧力株主介入を観測
-- URL: /themes/jtc-refactoring
-- Apply: npx tsx scripts/apply-migration.ts migrations/051_jtc_refactoring_theme.sql
--
-- `observation_notes` の行規約（JtcRefactoringCockpitPanel 用）:
--   refactor_phase: Legacy | Patched | Compiling | Deployed
--   bottleneck_virtual: 0-100
--   tech_debt_score: 0-100（仮想指標・手でチューニング可）
--   activist: 自由文

PRAGMA foreign_keys = ON;

INSERT INTO investment_themes (id, user_id, name, description, goal, created_at)
SELECT
  'theme-seed-jtc-refactoring',
  'user-satoshi',
  'JTCリファクタリング',
  'ウォール街のアクティビストやPE（蛮族）の介入を踏まえ、家電分離・MBO・再上場・セクターローテーションを「レガシーコードのデバッグとマージ」として観測する。現金・バランス・物理ボトルネックの目詰まりを仮想メーターで可視化する。',
  '介入フェーズ（株取得→事業売却→再デプロイ）を見極め、日本の大企業「OS」が入れ替わる局面で構造αを採取する。',
  datetime('now')
WHERE NOT EXISTS (
  SELECT 1 FROM investment_themes t WHERE t.id = 'theme-seed-jtc-refactoring'
);

UPDATE investment_themes
SET
  name = 'JTCリファクタリング',
  description = 'ウォール街のアクティビストやPE（蛮族）の介入を踏まえ、家電分離・MBO・再上場・セクターローテーションを「レガシーコードのデバッグとマージ」として観測する。現金・バランス・物理ボトルネックの目詰まりを仮想メーターで可視化する。',
  goal = '介入フェーズ（株取得→事業売却→再デプロイ）を見極め、日本の大企業「OS」が入れ替わる局面で構造αを採取する。'
WHERE id = 'theme-seed-jtc-refactoring';

DELETE FROM theme_ecosystem_members WHERE theme_id = 'theme-seed-jtc-refactoring';

INSERT OR REPLACE INTO theme_ecosystem_members
  (id, theme_id, ticker, company_name, field, role, is_major_player, observation_started_at, observation_notes)
VALUES
  (
    'eco-jtc-6501',
    'theme-seed-jtc-refactoring',
    '6501',
    '日立製作所',
    '多角 / デカップリング',
    'コアノード: 家電分離（デグサン）等の再編。蛮族圧下での「分離＝成功モデル」',
    1,
    '2026-04-01',
    'refactor_phase: Deployed
bottleneck_virtual: 32
tech_debt_score: 45
activist: 家電子会社の独立・M&A を含む大規模再編。過去の株主価値指摘を事業再マッピングに接続
structural: デカップリング / OS分割'
  ),
  (
    'eco-jtc-7369',
    'theme-seed-jtc-refactoring',
    '7369',
    '京都フィナンシャルグループ',
    '金融 / ガバナンス',
    'コアノード: 機関指摘（議案賛成率の課題）＝「リファクタリング期待」の典型',
    1,
    '2026-04-01',
    'refactor_phase: Patched
bottleneck_virtual: 55
tech_debt_score: 78
activist: 圧力株主・改善要求の文脈でウォッチ。株主還元・統治の再コンパイルが焦点
structural: 低賛成率＝要パッチ'
  ),
  (
    'eco-jtc-2432',
    'theme-seed-jtc-refactoring',
    '2432',
    'DeNA',
    'インターネット / エンタメ',
    'コアノード: 上記と同型の「改善余地」指摘。モバイルゲーム＋B2Bで再定義中',
    1,
    '2026-04-01',
    'refactor_phase: Patched
bottleneck_virtual: 48
tech_debt_score: 72
activist: 大株主・提案とゲーム×メディアの再配置
structural: 割安＋圧力の中間帯'
  ),
  (
    'eco-jtc-6810',
    'theme-seed-jtc-refactoring',
    '6810',
    'マクセル',
    '材料・部品 / アナログ再定義',
    'コアノード: アナログ幹事業の再定義。レガシー基盤の新OS化の事例',
    1,
    '2026-04-01',
    'refactor_phase: Deployed
bottleneck_virtual: 41
tech_debt_score: 50
activist: 中長期の事業集中・製品棄損。セル・エネ等へのダイブスト
structural: レガシー回路の焼き直し'
  ),
  (
    'eco-jtc-1605',
    'theme-seed-jtc-refactoring',
    '1605',
    'INPEX',
    'エネルギー / E&P',
    'コアノード: 石油中核からエネルギー・ネットワーク（CCS/洋上/ガス）へのOS転換',
    1,
    '2026-04-01',
    'refactor_phase: Compiling
bottleneck_virtual: 68
tech_debt_score: 62
activist: 資本配分の見直し・事業ポートの再配置（石化・地政と連動）
structural: ナフサ目詰まり・地政＝高ボトルネック仮想'
  );
