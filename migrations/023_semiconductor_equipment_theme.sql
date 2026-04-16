-- 構造投資テーマ: 半導体製造装置（CSV 由来ウォッチリスト）
-- 事前: 010_investment_themes / 012_theme_ecosystem_observation_started_at 相当が schema に含まれること

PRAGMA foreign_keys = ON;

INSERT INTO investment_themes (id, user_id, name, description, goal, created_at)
SELECT
  'theme-seed-semiconductor-equipment',
  'user-satoshi',
  '半導体製造装置',
  'ウェハをチップへ変換する「物理 OS」レイヤー。成膜・エッチ・露光・洗浄・検査・テスト・ダイシング等の前後工程ツールに焦点を当て、ファウンドリの設備投資サイクルと相関しやすい銘柄群を観測する。',
  'SOX・主要ファウンドリの CapEx コメントと照らし、テーマ加重累積 Alpha（VOO 比）と各銘柄の Z・落率で「在庫調整 vs 構造需要」を分解して読む。',
  datetime('now')
WHERE NOT EXISTS (
  SELECT 1 FROM investment_themes t
  WHERE t.user_id = 'user-satoshi' AND t.name = '半導体製造装置'
);

INSERT OR REPLACE INTO theme_ecosystem_members
  (id, theme_id, ticker, company_name, field, role, is_major_player, observation_started_at)
VALUES
  ('eco-semi-amat', 'theme-seed-semiconductor-equipment', 'AMAT', 'Applied Materials, Inc.', '前工程', '成膜・エッチング装置', 1, '2026-04-16'),
  ('eco-semi-lrcx', 'theme-seed-semiconductor-equipment', 'LRCX', 'Lam Research Corporation', '前工程', 'エッチング装置', 1, '2026-04-16'),
  ('eco-semi-klac', 'theme-seed-semiconductor-equipment', 'KLAC', 'KLA Corporation', '前工程', '検査・計測装置', 1, '2026-04-16'),
  ('eco-semi-cohu', 'theme-seed-semiconductor-equipment', 'COHU', 'Cohu, Inc.', '後工程寄り', 'テストハンドラー・検査装置', 0, '2026-04-16'),
  ('eco-semi-klic', 'theme-seed-semiconductor-equipment', 'KLIC', 'Kulicke and Soffa Industries, Inc.', '後工程', 'ワイヤーボンダー', 0, '2026-04-16'),
  ('eco-semi-6146', 'theme-seed-semiconductor-equipment', '6146', 'DISCO Corporation', '後工程', 'ダイシング・研磨装置', 1, '2026-04-16'),
  ('eco-semi-6525', 'theme-seed-semiconductor-equipment', '6525', 'Kokusai Electric Corporation', '前工程', '成膜装置（CVD/ALD）', 0, '2026-04-16'),
  ('eco-semi-7735', 'theme-seed-semiconductor-equipment', '7735', 'SCREEN Holdings Co., Ltd.', '前工程', '洗浄装置', 1, '2026-04-16'),
  ('eco-semi-6857', 'theme-seed-semiconductor-equipment', '6857', 'Advantest Corporation', '前工程', '半導体テスター', 1, '2026-04-16'),
  ('eco-semi-6728', 'theme-seed-semiconductor-equipment', '6728', 'ULVAC, Inc.', '前工程', '真空・成膜装置', 0, '2026-04-16'),
  ('eco-semi-7751', 'theme-seed-semiconductor-equipment', '7751', 'Canon Inc.', '前工程（露光）', '半導体露光装置・NIL・検査装置', 0, '2026-04-16'),
  ('eco-semi-6890', 'theme-seed-semiconductor-equipment', '6890', 'Ferrotec Holdings Corporation', '前工程', '装置部材・真空関連部品', 0, '2026-04-16'),
  ('eco-semi-6361', 'theme-seed-semiconductor-equipment', '6361', 'Ebara Corporation', '前工程', '真空ポンプ・CMP装置', 0, '2026-04-16'),
  ('eco-semi-8035', 'theme-seed-semiconductor-equipment', '8035', 'Tokyo Electron Limited', '前工程', '成膜・エッチング装置', 1, '2026-04-16'),
  ('eco-semi-7729', 'theme-seed-semiconductor-equipment', '7729', 'Tokyo Seimitsu Co., Ltd.', '後工程寄り', '計測装置・ダイサー', 0, '2026-04-16'),
  ('eco-semi-6920', 'theme-seed-semiconductor-equipment', '6920', 'Lasertec Corporation', '前工程', 'EUVマスク検査装置', 0, '2026-04-16');
