-- 江戸循環ネットワーク / 都市鉱山×お宝銘柄 のエコシステムを全消しし、添付リストどおりに再投入する。
-- Apply: npm run db:apply -- migrations/056_edo_urban_mining_ecosystem_reseed.sql
-- 事前: investment_themes に edo-circular / urban-mining-treasure が存在すること（049_split_edo_and_mining.sql 等）

PRAGMA foreign_keys = ON;

-- 現行2テーマのメンバー全削除
DELETE FROM theme_ecosystem_members WHERE theme_id IN ('edo-circular', 'urban-mining-treasure');

-- 旧シード ID で残っている場合（任意だが推奨）
DELETE FROM theme_ecosystem_members WHERE theme_id = 'theme-seed-edo-circular';

-- ========== 都市鉱山×お宝銘柄 (urban-mining-treasure) ==========
INSERT OR REPLACE INTO theme_ecosystem_members
  (id, theme_id, ticker, company_name, field, role, is_major_player, observation_started_at, observation_notes, adoption_stage, adoption_stage_rationale)
VALUES
  ('eco-um-4063', 'urban-mining-treasure', '4063', '信越化学工業', '都市鉱山', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-um-5802', 'urban-mining-treasure', '5802', '住友電気工業', '都市鉱山', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-um-5803', 'urban-mining-treasure', '5803', 'フジクラ', '都市鉱山', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-um-5805', 'urban-mining-treasure', '5805', 'ＳＷＣＣ', '都市鉱山', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-um-5711', 'urban-mining-treasure', '5711', '三菱マテリアル', '都市鉱山', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-um-5713', 'urban-mining-treasure', '5713', '住友金属鉱山', '都市鉱山', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-um-5714', 'urban-mining-treasure', '5714', 'ＤＯＷＡホールディングス', '都市鉱山', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-um-5698', 'urban-mining-treasure', '5698', 'エンビプロ・ホールディングス', '都市鉱山', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-um-9247', 'urban-mining-treasure', '9247', 'ＴＲＥホールディングス', '都市鉱山', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-um-5857', 'urban-mining-treasure', '5857', 'ＡＲＥホールディングス', '都市鉱山', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-um-6218', 'urban-mining-treasure', '6218', 'エンシュウ', 'お宝銘柄', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-um-1435', 'urban-mining-treasure', '1435', 'ＲＯＢＯＴ ＨＯＭＥ', 'お宝銘柄', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-um-2150', 'urban-mining-treasure', '2150', 'ケアネット', 'お宝銘柄', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-um-3660', 'urban-mining-treasure', '3660', 'アイスタイル', 'お宝銘柄', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-um-4565', 'urban-mining-treasure', '4565', 'ネクセラファーマ', 'お宝銘柄', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-um-4592', 'urban-mining-treasure', '4592', 'サンバイオ', 'お宝銘柄', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-um-4593', 'urban-mining-treasure', '4593', 'ヘリオス', 'お宝銘柄', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-um-6027', 'urban-mining-treasure', '6027', '弁護士ドットコム', 'お宝銘柄', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-um-6594', 'urban-mining-treasure', '6594', 'ニデック', 'お宝銘柄', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-um-6613', 'urban-mining-treasure', '6613', 'ＱＤレーザ', 'お宝銘柄', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-um-7733', 'urban-mining-treasure', '7733', 'オリンパス', 'お宝銘柄', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-um-7751', 'urban-mining-treasure', '7751', 'キヤノン', 'お宝銘柄', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-um-8035', 'urban-mining-treasure', '8035', '東京エレクトロン', 'お宝銘柄', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-um-9101', 'urban-mining-treasure', '9101', '日本郵船', 'お宝銘柄', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-um-9104', 'urban-mining-treasure', '9104', '商船三井', 'お宝銘柄', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-um-9107', 'urban-mining-treasure', '9107', '川崎汽船', 'お宝銘柄', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-um-9984', 'urban-mining-treasure', '9984', 'ソフトバンクグループ', 'お宝銘柄', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-um-aapl', 'urban-mining-treasure', 'AAPL', 'Apple Inc.', '米国ハイテク', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-um-msft', 'urban-mining-treasure', 'MSFT', 'Microsoft Corporation', '米国ハイテク', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-um-googl', 'urban-mining-treasure', 'GOOGL', 'Alphabet Inc.', '米国ハイテク', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-um-amzn', 'urban-mining-treasure', 'AMZN', 'Amazon.com Inc.', '米国ハイテク', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-um-nvda', 'urban-mining-treasure', 'NVDA', 'NVIDIA Corporation', '米国ハイテク', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-um-tsla', 'urban-mining-treasure', 'TSLA', 'Tesla Inc.', '米国ハイテク', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-um-meta', 'urban-mining-treasure', 'META', 'Meta Platforms Inc.', '米国ハイテク', '', 0, '2026-04-26', NULL, NULL, NULL);

-- ========== 江戸循環ネットワーク (edo-circular) ==========
INSERT OR REPLACE INTO theme_ecosystem_members
  (id, theme_id, ticker, company_name, field, role, is_major_player, observation_started_at, observation_notes, adoption_stage, adoption_stage_rationale)
VALUES
  ('eco-edo-1925', 'edo-circular', '1925', '大和ハウス工業', '江戸循環ネットワーク', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-edo-1928', 'edo-circular', '1928', '積水ハウス', '江戸循環ネットワーク', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-edo-2802', 'edo-circular', '2802', '味の素', '江戸循環ネットワーク', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-edo-4452', 'edo-circular', '4452', '花王', '江戸循環ネットワーク', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-edo-4502', 'edo-circular', '4502', '武田薬品工業', '江戸循環ネットワーク', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-edo-4503', 'edo-circular', '4503', 'アステラス製薬', '江戸循環ネットワーク', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-edo-4901', 'edo-circular', '4901', '富士フイルムホールディングス', '江戸循環ネットワーク', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-edo-5108', 'edo-circular', '5108', 'ブリヂストン', '江戸循環ネットワーク', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-edo-6301', 'edo-circular', '6301', '小松製作所', '江戸循環ネットワーク', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-edo-6501', 'edo-circular', '6501', '日立製作所', '江戸循環ネットワーク', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-edo-6752', 'edo-circular', '6752', 'パナソニック ホールディングス', '江戸循環ネットワーク', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-edo-6758', 'edo-circular', '6758', 'ソニーグループ', '江戸循環ネットワーク', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-edo-6902', 'edo-circular', '6902', 'デンソー', '江戸循環ネットワーク', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-edo-6954', 'edo-circular', '6954', 'ファナック', '江戸循環ネットワーク', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-edo-6981', 'edo-circular', '6981', '村田製作所', '江戸循環ネットワーク', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-edo-7201', 'edo-circular', '7201', '日産自動車', '江戸循環ネットワーク', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-edo-7203', 'edo-circular', '7203', 'トヨタ自動車', '江戸循環ネットワーク', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-edo-7267', 'edo-circular', '7267', '本田技研工業', '江戸循環ネットワーク', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-edo-8001', 'edo-circular', '8001', '伊藤忠商事', '江戸循環ネットワーク', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-edo-8031', 'edo-circular', '8031', '三井物産', '江戸循環ネットワーク', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-edo-8053', 'edo-circular', '8053', '住友商事', '江戸循環ネットワーク', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-edo-8058', 'edo-circular', '8058', '三菱商事', '江戸循環ネットワーク', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-edo-8306', 'edo-circular', '8306', '三菱ＵＦＪフィナンシャル・グループ', '江戸循環ネットワーク', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-edo-8316', 'edo-circular', '8316', '三井住友フィナンシャルグループ', '江戸循環ネットワーク', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-edo-8411', 'edo-circular', '8411', 'みずほフィナンシャルグループ', '江戸循環ネットワーク', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-edo-8766', 'edo-circular', '8766', '東京海上ホールディングス', '江戸循環ネットワーク', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-edo-9432', 'edo-circular', '9432', '日本電信電話', '江戸循環ネットワーク', '', 0, '2026-04-26', NULL, NULL, NULL),
  ('eco-edo-9433', 'edo-circular', '9433', 'ＫＤＤＩ', '江戸循環ネットワーク', '', 0, '2026-04-26', NULL, NULL, NULL);