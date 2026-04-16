-- 構造投資テーマ: 半導体サプライチェーン（src/lib/semiconducter-data_new.csv 由来・49銘柄）
-- Apply: turso db shell <db> < migrations/023_semiconductor_equipment_theme.sql

PRAGMA foreign_keys = ON;

INSERT INTO investment_themes (id, user_id, name, description, goal, created_at)
SELECT
  'theme-seed-semiconductor-equipment',
  'user-satoshi',
  '半導体サプライチェーン',
  '材料・装置・設計（ファブレス）・IDM・後工程まで、半導体バリューチェーン全体を一枚の地図で観測する。CSV の各プレイヤーをエコシステムに載せ、VOO 対 Alpha と決算・地政イベントで分解する。',
  'SOX/NDX とファウンドリ設備投資・メモリ価格を併読し、テーマ加重累積 Alpha と銘柄別 Z・落率で「全体β」と「チェーン内相対」を切り分ける。',
  datetime('now')
WHERE NOT EXISTS (
  SELECT 1 FROM investment_themes t
  WHERE t.id = 'theme-seed-semiconductor-equipment'
);

UPDATE investment_themes
SET
  name = '半導体サプライチェーン',
  description = '材料・装置・設計（ファブレス）・IDM・後工程まで、半導体バリューチェーン全体を一枚の地図で観測する。CSV の各プレイヤーをエコシステムに載せ、VOO 対 Alpha と決算・地政イベントで分解する。',
  goal = 'SOX/NDX とファウンドリ設備投資・メモリ価格を併読し、テーマ加重累積 Alpha と銘柄別 Z・落率で「全体β」と「チェーン内相対」を切り分ける。'
WHERE id = 'theme-seed-semiconductor-equipment';

DELETE FROM theme_ecosystem_members WHERE theme_id = 'theme-seed-semiconductor-equipment';

INSERT OR REPLACE INTO theme_ecosystem_members
  (id, theme_id, ticker, company_name, field, role, is_major_player, observation_started_at, is_unlisted, proxy_ticker, observation_notes)
VALUES
  ('eco-sc-4401', 'theme-seed-semiconductor-equipment', '4401', 'ADEKA', '材料', '石英ガラス・マスク材料', 0, '2026-01-01', 0, NULL, 'CSV 欠損ティッカーを補完'),
  ('eco-sc-5201', 'theme-seed-semiconductor-equipment', '5201', 'AGC', '材料', '半導体材料（薬液・ケミカル）', 0, '2026-01-01', 0, NULL, 'CSV 欠損ティッカーを補完'),
  ('eco-sc-AMD', 'theme-seed-semiconductor-equipment', 'AMD', 'AMD', '前工程（設計）', 'CPU/GPU（ファブレス）', 1, '2026-01-01', 0, NULL, 'CSV 欠損ティッカーを補完'),
  ('eco-sc-AMKR', 'theme-seed-semiconductor-equipment', 'AMKR', 'Amkor', '後工程', 'OSAT（後工程ファウンドリー）', 0, '2026-01-01', 0, NULL, 'CSV 欠損ティッカーを補完'),
  ('eco-sc-AAPL', 'theme-seed-semiconductor-equipment', 'AAPL', 'Apple（設計）', '前工程（設計）', 'SoC設計（Mシリーズ）', 1, '2026-01-01', 0, NULL, 'CSV 欠損ティッカーを補完'),
  ('eco-sc-AMAT', 'theme-seed-semiconductor-equipment', 'AMAT', 'Applied Materials', '前工程', '成膜・エッチング装置', 1, '2026-01-01', 0, NULL, 'CSV 欠損ティッカーを補完'),
  ('eco-sc-AVGO', 'theme-seed-semiconductor-equipment', 'AVGO', 'Broadcom', '前工程（設計）', '通信・ストレージSoC（ファブレス）', 1, '2026-01-01', 0, NULL, 'CSV 欠損ティッカーを補完'),
  ('eco-sc-COHU', 'theme-seed-semiconductor-equipment', 'COHU', 'Cohu', '後工程寄り', 'テストハンドラー・検査装置', 0, '2026-01-01', 0, NULL, 'CSV 欠損ティッカーを補完'),
  ('eco-sc-6146', 'theme-seed-semiconductor-equipment', '6146', 'DISCO', '後工程', 'ダイシング・研磨装置', 1, '2026-01-01', 0, NULL, 'CSV 欠損ティッカーを補完'),
  ('eco-sc-GOOGL', 'theme-seed-semiconductor-equipment', 'GOOGL', 'Google（TPU）', '前工程（設計）', 'TPU・AIアクセラレータ', 1, '2026-01-01', 0, NULL, 'CSV 欠損ティッカーを補完'),
  ('eco-sc-7741', 'theme-seed-semiconductor-equipment', '7741', 'HOYA', '材料', 'フォトマスク基板・前工程材料', 0, '2026-01-01', 0, NULL, 'CSV 欠損ティッカーを補完'),
  ('eco-sc-IBM', 'theme-seed-semiconductor-equipment', 'IBM', 'IBM（International Business Machines）', '研究開発（プロセス源流）', '先端半導体プロセス研究（2nm/GAAFET）', 0, '2026-01-01', 0, NULL, 'CSV 欠損ティッカーを補完'),
  ('eco-sc-INTC', 'theme-seed-semiconductor-equipment', 'INTC', 'Intel', 'IDM（設計〜前工程〜後工程）', 'CPU/GPU/AI向け半導体（IDM）', 1, '2026-01-01', 0, NULL, 'CSV 欠損ティッカーを補完'),
  ('eco-sc-4185', 'theme-seed-semiconductor-equipment', '4185', 'JSR', '材料', 'CMPスラリー・感光材（レジスト）', 0, '2026-01-01', 0, NULL, 'CSV 欠損ティッカーを補完'),
  ('eco-sc-6316', 'theme-seed-semiconductor-equipment', '6316', 'JテックC', '前工程', '薄膜成膜装置', 0, '2026-01-01', 0, NULL, 'CSV 欠損ティッカーを補完'),
  ('eco-sc-KLAC', 'theme-seed-semiconductor-equipment', 'KLAC', 'KLA', '前工程', '検査・計測装置', 1, '2026-01-01', 0, NULL, 'CSV 欠損ティッカーを補完'),
  ('eco-sc-6525', 'theme-seed-semiconductor-equipment', '6525', 'KOKUSAI ELECTRIC', '前工程', '成膜装置（CVD/ALD）', 0, '2026-01-01', 0, NULL, 'CSV 欠損ティッカーを補完'),
  ('eco-sc-KLIC', 'theme-seed-semiconductor-equipment', 'KLIC', 'Kulicke & Soffa', '後工程', 'ワイヤーボンダー', 0, '2026-01-01', 0, NULL, 'CSV 欠損ティッカーを補完'),
  ('eco-sc-LRCX', 'theme-seed-semiconductor-equipment', 'LRCX', 'Lam Research', '前工程', 'エッチング装置', 1, '2026-01-01', 0, NULL, 'CSV 欠損ティッカーを補完'),
  ('eco-sc-META', 'theme-seed-semiconductor-equipment', 'META', 'Meta（AIチップ）', '前工程（設計）', '自社AIアクセラレータ', 1, '2026-01-01', 0, NULL, 'CSV 欠損ティッカーを補完'),
  ('eco-sc-NVDA', 'theme-seed-semiconductor-equipment', 'NVDA', 'NVIDIA', '前工程（設計）', 'GPU・AIアクセラレータ（ファブレス）', 1, '2026-01-01', 0, NULL, 'CSV 欠損ティッカーを補完'),
  ('eco-sc-QCOM', 'theme-seed-semiconductor-equipment', 'QCOM', 'Qualcomm', '前工程（設計）', '通信SoC（ファブレス）', 0, '2026-01-01', 0, NULL, 'CSV 欠損ティッカーを補完'),
  ('eco-sc-3445', 'theme-seed-semiconductor-equipment', '3445', 'RS Tech', '前工程', 'シリコン材料・再生ウェハー', 0, '2026-01-01', 0, NULL, 'CSV 欠損ティッカーを補完'),
  ('eco-sc-7735', 'theme-seed-semiconductor-equipment', '7735', 'SCREEN HD', '前工程', '洗浄装置', 0, '2026-01-01', 0, NULL, 'CSV 欠損ティッカーを補完'),
  ('eco-sc-3436', 'theme-seed-semiconductor-equipment', '3436', 'SUMCO', '材料', 'シリコンウェハー', 1, '2026-01-01', 0, NULL, NULL),
  ('eco-sc-TSLA', 'theme-seed-semiconductor-equipment', 'TSLA', 'Tesla（自社AIチップ）', '前工程（設計）', '自動運転AIチップ', 1, '2026-01-01', 0, NULL, 'CSV 欠損ティッカーを補完'),
  ('eco-sc-TXN', 'theme-seed-semiconductor-equipment', 'TXN', 'Texas Instruments', '前工程（IDM）', 'アナログ半導体（IDM）', 1, '2026-01-01', 0, NULL, 'CSV 欠損ティッカーを補完'),
  ('eco-sc-6857', 'theme-seed-semiconductor-equipment', '6857', 'アドバンテスト', '前工程', '半導体テスター', 1, '2026-01-01', 0, NULL, 'CSV 欠損ティッカーを補完'),
  ('eco-sc-6728', 'theme-seed-semiconductor-equipment', '6728', 'アルバック', '前工程', '真空・成膜装置', 0, '2026-01-01', 0, NULL, 'CSV 欠損ティッカーを補完'),
  ('eco-sc-4062', 'theme-seed-semiconductor-equipment', '4062', 'イビデン', '後工程寄り', 'IC基板・パッケージ基板', 0, '2026-01-01', 0, NULL, 'CSV 欠損ティッカーを補完'),
  ('eco-sc-N_A_KIOXIA', 'theme-seed-semiconductor-equipment', 'N/A:KIOXIA', 'キオクシア', 'メモリ製造（IDM）', 'NANDフラッシュメモリ（BiCS FLASH）', 0, '2026-01-01', 1, 'MU', 'CSV 欠損ティッカーを補完'),
  ('eco-sc-7751', 'theme-seed-semiconductor-equipment', '7751', 'キヤノン（Canon Inc.）', '前工程（露光）', '半導体露光装置・NIL・検査装置', 0, '2026-01-01', 0, NULL, 'CSV 欠損ティッカーを補完'),
  ('eco-sc-5334', 'theme-seed-semiconductor-equipment', '5334', 'ノリタケ', '材料', 'CMP研磨材・砥石', 0, '2026-01-01', 0, NULL, 'CSV 欠損ティッカーを補完'),
  ('eco-sc-6890', 'theme-seed-semiconductor-equipment', '6890', 'フェローテック', '前工程', '装置部材・真空関連部品', 0, '2026-01-01', 0, NULL, 'CSV 欠損ティッカーを補完'),
  ('eco-sc-N_A_RAPIDUS', 'theme-seed-semiconductor-equipment', 'N/A:RAPIDUS', 'ラピダス', '前工程〜後工程（ファウンドリ）', '2nm先端ロジック半導体製造', 0, '2026-01-01', 1, 'TSM', 'CSV 欠損ティッカーを補完'),
  ('eco-sc-6723', 'theme-seed-semiconductor-equipment', '6723', 'ルネサス', '前工程（IDM）', 'マイコン・車載半導体', 0, '2026-01-01', 0, NULL, 'CSV 欠損ティッカーを補完'),
  ('eco-sc-6920', 'theme-seed-semiconductor-equipment', '6920', 'レーザーテック', '前工程', 'EUVマスク検査装置', 0, '2026-01-01', 0, NULL, 'CSV のティッカー列を公開コードに合わせて補正'),
  ('eco-sc-6963', 'theme-seed-semiconductor-equipment', '6963', 'ローム', '前工程（IDM）', 'パワー半導体', 0, '2026-01-01', 0, NULL, 'CSV のティッカー列を公開コードに合わせて補正'),
  ('eco-sc-6361', 'theme-seed-semiconductor-equipment', '6361', '荏原（EBARA）', '前工程', '真空ポンプ・CMP装置', 0, '2026-01-01', 0, NULL, 'CSV のティッカー列を公開コードに合わせて補正'),
  ('eco-sc-4047', 'theme-seed-semiconductor-equipment', '4047', '関東電化工業', '材料', '高純度ガス・フォト関連材料', 0, '2026-01-01', 0, NULL, 'CSV のティッカー列を公開コードに合わせて補正'),
  ('eco-sc-6965', 'theme-seed-semiconductor-equipment', '6965', '三井ハイテック', '後工程', 'リードフレーム', 0, '2026-01-01', 0, NULL, 'CSV のティッカー列を公開コードに合わせて補正'),
  ('eco-sc-4005', 'theme-seed-semiconductor-equipment', '4005', '住友化学', '材料', 'フォトレジスト', 0, '2026-01-01', 0, NULL, 'CSV のティッカー列を公開コードに合わせて補正'),
  ('eco-sc-8035', 'theme-seed-semiconductor-equipment', '8035', '東京エレクトロン（TEL）', '前工程', '成膜・エッチング装置', 1, '2026-01-01', 0, NULL, 'CSV のティッカー列を公開コードに合わせて補正'),
  ('eco-sc-4186', 'theme-seed-semiconductor-equipment', '4186', '東京応化工業（TOK）', '材料', 'レジスト・ケミカル', 0, '2026-01-01', 0, NULL, 'CSV のティッカー列を公開コードに合わせて補正'),
  ('eco-sc-7729', 'theme-seed-semiconductor-equipment', '7729', '東京精密（Accretech）', '後工程寄り', '計測装置・ダイサー', 0, '2026-01-01', 0, NULL, 'CSV のティッカー列を公開コードに合わせて補正'),
  ('eco-sc-4023', 'theme-seed-semiconductor-equipment', '4023', '日産化学', '材料', 'フォトレジスト・化学材料', 0, '2026-01-01', 0, NULL, 'CSV のティッカー列を公開コードに合わせて補正'),
  ('eco-sc-4091', 'theme-seed-semiconductor-equipment', '4091', '日本酸素HD', '材料', '半導体用高純度ガス', 0, '2026-01-01', 0, NULL, 'CSV のティッカー列を公開コードに合わせて補正'),
  ('eco-sc-4901', 'theme-seed-semiconductor-equipment', '4901', '富士フイルムHD', '材料（前工程）', 'フォトレジスト・ケミカル', 0, '2026-01-01', 0, NULL, 'CSV のティッカー列を公開コードに合わせて補正'),
  ('eco-sc-4063', 'theme-seed-semiconductor-equipment', '4063', '信越化学工業', '前工程（CMP）', 'シリコンウェハー・レジスト / CMP研磨材・研磨パッド', 0, '2026-01-01', 0, NULL, 'CSV 2 行（ウェハー・レジスト / CMP）を 4063 に統合');
