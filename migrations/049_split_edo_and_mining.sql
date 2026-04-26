-- 049_split_edo_and_mining.sql (v3: idempotent inserts)

-- 1. 新テーマの作成
INSERT OR REPLACE INTO investment_themes (id, user_id, name, description, created_at) VALUES 
('edo-circular', 'user-satoshi', '江戸循環ネットワーク', 'エネルギー・素材・生命の三層還流を重視し、国内で閉じる再資源化とインフラ耐久に張るテーマ。', datetime('now')),
('urban-mining-treasure', 'user-satoshi', '都市鉱山×お宝銘柄', '物理資源（金・銀・銅）の高騰をAlphaに変える、都市鉱山・リサイクル・鑑定・リユースに特化したテーマ。', datetime('now'));

-- 2. 既存の重複メンバーを削除（移行先テーマに既に存在する銘柄をクリア）
DELETE FROM theme_ecosystem_members WHERE theme_id = 'urban-mining-treasure' AND ticker IN ('5857.T', '7456.T', '5711.T', '5713.T', '7685.T', '2780.T', '3180.T', 'FCFS', 'WM', 'CPRT', '2674.T');
DELETE FROM theme_ecosystem_members WHERE theme_id = 'edo-circular' AND ticker IN ('4063.T', '5017.T', 'GPK', '9278.T', '7532.T', '4385.T', '3837.T');

-- 3. 銘柄の再割り当て（都市鉱山×お宝銘柄へ）
-- UPDATE が失敗（他テーマとの重複）する場合に備え、INSERT OR REPLACE で移動を試みる
INSERT OR REPLACE INTO theme_ecosystem_members (theme_id, ticker, company_name, field, role, is_major_player, observation_started_at, listing_date, market_cap, listing_price, next_earnings_date, memo, is_bookmarked, instrument_meta_synced_at, earnings_summary_note, chasm, moat, vi_score, is_kept, adoption_stage, adoption_stage_rationale, expectation_category, holder_tags, dividend_months, defensive_strength, revenue_growth, fcf_margin, fcf, fcf_yield)
SELECT 'urban-mining-treasure', ticker, company_name, field, role, is_major_player, observation_started_at, listing_date, market_cap, listing_price, next_earnings_date, memo, is_bookmarked, instrument_meta_synced_at, earnings_summary_note, chasm, moat, vi_score, is_kept, adoption_stage, adoption_stage_rationale, expectation_category, holder_tags, dividend_months, defensive_strength, revenue_growth, fcf_margin, fcf, fcf_yield
FROM theme_ecosystem_members
WHERE ticker IN ('5857.T', '7456.T', '5711.T', '5713.T', '7685.T', '2780.T', '3180.T', 'FCFS', 'WM', 'CPRT', '2674.T')
AND theme_id != 'urban-mining-treasure';

-- 4. 銘柄の再割り当て（江戸循環ネットワークへ）
INSERT OR REPLACE INTO theme_ecosystem_members (theme_id, ticker, company_name, field, role, is_major_player, observation_started_at, listing_date, market_cap, listing_price, next_earnings_date, memo, is_bookmarked, instrument_meta_synced_at, earnings_summary_note, chasm, moat, vi_score, is_kept, adoption_stage, adoption_stage_rationale, expectation_category, holder_tags, dividend_months, defensive_strength, revenue_growth, fcf_margin, fcf, fcf_yield)
SELECT 'edo-circular', ticker, company_name, field, role, is_major_player, observation_started_at, listing_date, market_cap, listing_price, next_earnings_date, memo, is_bookmarked, instrument_meta_synced_at, earnings_summary_note, chasm, moat, vi_score, is_kept, adoption_stage, adoption_stage_rationale, expectation_category, holder_tags, dividend_months, defensive_strength, revenue_growth, fcf_margin, fcf, fcf_yield
FROM theme_ecosystem_members
WHERE ticker IN ('4063.T', '5017.T', 'GPK', '9278.T', '7532.T', '4385.T', '3837.T')
AND theme_id != 'edo-circular';

-- 5. 旧テーマ所属銘柄の削除（移動済み銘柄を旧テーマから消す）
DELETE FROM theme_ecosystem_members 
WHERE theme_id NOT IN ('edo-circular', 'urban-mining-treasure')
AND ticker IN ('5857.T', '7456.T', '5711.T', '5713.T', '7685.T', '2780.T', '3180.T', 'FCFS', 'WM', 'CPRT', '2674.T', '4063.T', '5017.T', 'GPK', '9278.T', '7532.T', '4385.T', '3837.T');

-- 6. 保有銘柄のタグ更新
UPDATE holdings SET structure_tags = json_replace(structure_tags, '$[0]', '都市鉱山×お宝銘柄')
WHERE json_extract(structure_tags, '$[0]') IN ('江戸循環ネットワーク文明', '江戸循環ネットワーク', '都市鉱山×お宝銘柄')
AND ticker IN ('5857.T', '7456.T', '5711.T', '5713.T', '7685.T', '2780.T', '3180.T', 'FCFS', 'WM', 'CPRT', '2674.T');

UPDATE holdings SET structure_tags = json_replace(structure_tags, '$[0]', '江戸循環ネットワーク')
WHERE json_extract(structure_tags, '$[0]') IN ('江戸循環ネットワーク文明', '江戸循環ネットワーク')
AND ticker IN ('4063.T', '5017.T', 'GPK', '9278.T', '7532.T', '4385.T', '3837.T');
