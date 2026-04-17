-- SaaSアポカリプス: 2026/2-3 の過剰売りSaaS観測テーマ
-- Apply: turso db shell <db> < migrations/028_saas_apocalypse_theme.sql

PRAGMA foreign_keys = ON;

INSERT INTO investment_themes (id, user_id, name, description, goal, created_at)
SELECT
  'theme-seed-saas-apocalypse',
  'user-satoshi',
  'SaaSアポカリプス',
  '2026年2月〜3月の「過剰に売られたSaaS」を、落率（地表の剥離）と統計的乖離（σ＝地脈）の二軸で観測する。クラウド・業務OS・CRM・クリエイティブの基盤銘柄を、パニックと構造変化を切り分けて採掘優先度を可視化する。',
  '暴落（構造崩壊）と押し目（構造維持の剥離）を判別し、次のサイクルで回収できる「エネルギー充填」の局面を逃さない。',
  datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM investment_themes t WHERE t.id = 'theme-seed-saas-apocalypse');

INSERT OR REPLACE INTO theme_ecosystem_members
  (id, theme_id, ticker, company_name, field, role, is_major_player, observation_started_at)
VALUES
  (
    'eco-saas-snow',
    'theme-seed-saas-apocalypse',
    'SNOW',
    'Snowflake Inc.',
    'Enterprise SaaS / Data Cloud',
    '役割: データ雲の集積所 / 構造: AI時代の非構造化データ基盤',
    1,
    '2026-02-01'
  ),
  (
    'eco-saas-now',
    'theme-seed-saas-apocalypse',
    'NOW',
    'ServiceNow, Inc.',
    'Enterprise SaaS / Workflow',
    '役割: 業務OSの神経系 / 構造: ワークフロー自動化のデファクト',
    1,
    '2026-02-01'
  ),
  (
    'eco-saas-msft',
    'theme-seed-saas-apocalypse',
    'MSFT',
    'Microsoft Corp.',
    '生産性/プラットフォーム',
    '大名（全域支配）',
    1,
    '2026-04-17'
  ),
  (
    'eco-saas-crm',
    'theme-seed-saas-apocalypse',
    'CRM',
    'Salesforce, Inc.',
    'Enterprise SaaS / CRM',
    '役割: 顧客接点の石垣 / 構造: エンタープライズSaaSの重力中心',
    1,
    '2026-02-01'
  ),
  (
    'eco-saas-adbe',
    'theme-seed-saas-apocalypse',
    'ADBE',
    'Adobe Inc.',
    'Creative Cloud / SaaS',
    '役割: 創造性の独占 / 構造: 生成AIによるクリエイティブの再定義',
    1,
    '2026-02-01'
  ),
  (
    'eco-saas-ddog',
    'theme-seed-saas-apocalypse',
    'DDOG',
    'Datadog, Inc.',
    'オブザーバビリティ',
    '目付（監視役）',
    0,
    '2026-04-17'
  ),
  (
    'eco-saas-crwd',
    'theme-seed-saas-apocalypse',
    'CRWD',
    'CrowdStrike Holdings',
    'サイバーセキュリティ',
    '用心棒（外敵防衛）',
    1,
    '2026-04-17'
  ),
  (
    'eco-saas-pltr',
    'theme-seed-saas-apocalypse',
    'PLTR',
    'Palantir Technologies',
    'AIデータ解析',
    '軍師（知略・分析）',
    1,
    '2026-04-17'
  ),
  (
    'eco-saas-shop',
    'theme-seed-saas-apocalypse',
    'SHOP',
    'Shopify Inc.',
    'Eコマース基盤',
    '宿場町（商い基盤）',
    1,
    '2026-04-17'
  ),
  (
    'eco-saas-team',
    'theme-seed-saas-apocalypse',
    'TEAM',
    'Atlassian Corp.',
    '開発コラボレーション',
    '瓦版（情報共有）',
    0,
    '2026-04-17'
  ),
  (
    'eco-saas-trello',
    'theme-seed-saas-apocalypse',
    'N/A:TRELLO',
    'Atlassian (Trello)',
    'プロジェクト管理',
    '回覧板（進捗共有）',
    1,
    '2026-04-17'
  ),
  (
    'eco-saas-sq',
    'theme-seed-saas-apocalypse',
    'SQ',
    'Block, Inc.',
    '金融決済エコシステム',
    '両替商（決済・流通）',
    1,
    '2026-04-17'
  ),
  (
    'eco-saas-figma',
    'theme-seed-saas-apocalypse',
    'N/A:FIGMA',
    'Adobe (Figma)',
    'デザインコラボレーション',
    '設計図（意匠・構築）',
    1,
    '2026-04-17'
  ),
  (
    'eco-saas-wday',
    'theme-seed-saas-apocalypse',
    'WDAY',
    'Workday, Inc.',
    'Enterprise SaaS / HCM+Finance',
    '役割: 組織の年輪管理 / 構造: 人事・財務データの統合基盤',
    1,
    '2026-02-01'
  );

