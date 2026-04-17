-- Apply: turso db shell <db> < migrations/025_ai_datacenter_from_csv.sql
-- Source: src/lib/ai-data.csv → theme_ecosystem_members（AIデータセンター）

PRAGMA foreign_keys = ON;

INSERT OR REPLACE INTO theme_ecosystem_members
  (id, theme_id, ticker, company_name, field, role, is_major_player, observation_started_at)
VALUES
  ('eco-ai-pstg', 'theme-seed-ai-datacenter', 'PSTG', 'Pure Storage, Inc.', 'データストレージ', '企業向けオールフラッシュストレージ', 0, '2026-04-17'),
  ('eco-ai-ntap', 'theme-seed-ai-datacenter', 'NTAP', 'NetApp, Inc.', 'データストレージ', 'データ管理・ストレージOS', 0, '2026-04-17'),
  ('eco-ai-dell', 'theme-seed-ai-datacenter', 'DELL', 'Dell Technologies Inc.', 'データストレージ', 'サーバー・ストレージ統合提供', 0, '2026-04-17'),
  ('eco-ai-myrg', 'theme-seed-ai-datacenter', 'MYRG', 'MYR Group Inc.', '建設・電力', '電力・通信の電気工事', 0, '2026-04-17'),
  ('eco-ai-eme', 'theme-seed-ai-datacenter', 'EME', 'EMCOR Group, Inc.', '建設・電力', '機械・電気設備工事', 0, '2026-04-17'),
  ('eco-ai-nrg', 'theme-seed-ai-datacenter', 'NRG', 'NRG Energy, Inc.', '建設・電力', '発電・電力供給', 0, '2026-04-17'),
  ('eco-ai-mtz', 'theme-seed-ai-datacenter', 'MTZ', 'MasTec, Inc.', '建設・電力', '通信・エネルギー建設', 0, '2026-04-17'),
  ('eco-ai-gnrc', 'theme-seed-ai-datacenter', 'GNRC', 'Generac Holdings Inc.', '建設・電力', '非常用・分散型発電機', 0, '2026-04-17'),
  ('eco-ai-vst', 'theme-seed-ai-datacenter', 'VST', 'Vistra Corp.', '建設・電力', '大規模発電事業', 0, '2026-04-17'),
  ('eco-ai-gev', 'theme-seed-ai-datacenter', 'GEV', 'GE Vernova Inc.', '建設・電力', '発電・送電インフラ', 0, '2026-04-17'),
  ('eco-ai-btdr', 'theme-seed-ai-datacenter', 'BTDR', 'Bitdeer Technologies Group', 'ビットコイン採掘', '採掘→AI/HPC DC転用', 0, '2026-04-17'),
  ('eco-ai-ceg', 'theme-seed-ai-datacenter', 'CEG', 'Constellation Energy Corporation', '建設・電力', '原子力中心の発電会社', 0, '2026-04-17'),
  ('eco-ai-btbt', 'theme-seed-ai-datacenter', 'BTBT', 'WhiteFiber, Inc.', 'ビットコイン採掘', 'HPC向けDC転換', 0, '2026-04-17'),
  ('eco-ai-etn', 'theme-seed-ai-datacenter', 'ETN', 'Eaton Corporation plc', '空調・冷却・水', '電力管理機器', 0, '2026-04-17'),
  ('eco-ai-riot', 'theme-seed-ai-datacenter', 'RIOT', 'Riot Platforms, Inc.', 'ビットコイン採掘', '大規模電力契約', 0, '2026-04-17'),
  ('eco-ai-vrt', 'theme-seed-ai-datacenter', 'VRT', 'Vertiv Holdings Co', '空調・冷却・水', 'DC専用電力・冷却', 0, '2026-04-17'),
  ('eco-ai-awk', 'theme-seed-ai-datacenter', 'AWK', 'American Water Works Company', '空調・冷却・水', '上水道事業', 0, '2026-04-17'),
  ('eco-ai-xyl', 'theme-seed-ai-datacenter', 'XYL', 'Xylem Inc.', '空調・冷却・水', '水・冷却管理技術', 0, '2026-04-17'),
  ('eco-ai-fix', 'theme-seed-ai-datacenter', 'FIX', 'Comfort Systems USA, Inc.', '空調・冷却・水', 'HVAC設置・保守', 0, '2026-04-17'),
  ('eco-ai-msft', 'theme-seed-ai-datacenter', 'MSFT', 'Microsoft Corporation', 'ソフトウエア', 'クラウド・AI基盤', 0, '2026-04-17'),
  ('eco-ai-ecl', 'theme-seed-ai-datacenter', 'ECL', 'Ecolab Inc.', '空調・冷却・水', '産業向け水管理', 0, '2026-04-17'),
  ('eco-ai-snow', 'theme-seed-ai-datacenter', 'SNOW', 'Snowflake Inc.', 'ソフトウエア', 'クラウドデータ基盤', 0, '2026-04-17'),
  ('eco-ai-googl', 'theme-seed-ai-datacenter', 'GOOGL', 'Alphabet Inc.', 'ソフトウエア', '検索・クラウド', 0, '2026-04-17'),
  ('eco-ai-ddog', 'theme-seed-ai-datacenter', 'DDOG', 'Datadog, Inc.', 'ソフトウエア', '監視・運用ソフト', 0, '2026-04-17'),
  ('eco-ai-meta', 'theme-seed-ai-datacenter', 'META', 'Meta Platforms, Inc.', 'ソフトウエア', 'AI大規模利用', 0, '2026-04-17'),
  ('eco-ai-now', 'theme-seed-ai-datacenter', 'NOW', 'ServiceNow, Inc.', 'ソフトウエア', '業務プロセスSaaS', 0, '2026-04-17'),
  ('eco-ai-duk', 'theme-seed-ai-datacenter', 'DUK', 'Duke Energy', '素材', '電力', 0, '2026-04-17'),
  ('eco-ai-so', 'theme-seed-ai-datacenter', 'SO', 'Southern Company', '素材', '電力', 0, '2026-04-17'),
  ('eco-ai-aa', 'theme-seed-ai-datacenter', 'AA', 'Alcoa', '素材', 'アルミ', 0, '2026-04-17'),
  ('eco-ai-wm', 'theme-seed-ai-datacenter', 'WM', 'Waste Management', '素材', '廃棄物・分別', 0, '2026-04-17'),
  ('eco-ai-rsg', 'theme-seed-ai-datacenter', 'RSG', 'Republic Services', '素材', '廃棄物・分別', 0, '2026-04-17'),
  ('eco-ai-mp', 'theme-seed-ai-datacenter', 'MP', 'MP Materials', '素材', 'レアアース', 0, '2026-04-17'),
  ('eco-ai-eqix', 'theme-seed-ai-datacenter', 'EQIX', 'Equinix', '建設・電力', '相互接続型DC／ネットワーク中立ハブ', 0, '2026-04-17'),
  ('eco-ai-dlr', 'theme-seed-ai-datacenter', 'DLR', 'Digital Realty', '建設・電力', '大規模DC不動産／ハイパースケール対応', 0, '2026-04-17'),
  ('eco-ai-oklo', 'theme-seed-ai-datacenter', 'OKLO', 'Oklo', 'SMR・次世代炉', 'AI向け小型炉（将来枠）', 0, '2026-04-17'),
  ('eco-ai-ccj', 'theme-seed-ai-datacenter', 'CCJ', 'Cameco', 'ウラン供給', '世界最大級ウラン供給', 0, '2026-04-17'),
  ('eco-ai-leu', 'theme-seed-ai-datacenter', 'LEU', 'Centrus Energy', '核燃料加工（HALEU）', '次世代炉燃料のボトルネック', 0, '2026-04-17'),
  ('eco-ai-smr', 'theme-seed-ai-datacenter', 'SMR', 'NuScale Power', 'SMR', 'SMR商用化（実証枠）', 0, '2026-04-17'),
  ('eco-ai-fan', 'theme-seed-ai-datacenter', 'FAN', 'First Trust Global Wind Energy ETF', 'ETF', '風力特化ETF', 0, '2026-04-17');