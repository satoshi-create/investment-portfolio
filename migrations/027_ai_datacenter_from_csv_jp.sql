-- Apply: turso db shell <db> < migrations/027_ai_datacenter_from_csv_jp.sql
-- Source: src/lib/ai-data_jp.csv（9613・6361は既存シードと重複のため除外）

PRAGMA foreign_keys = ON;

INSERT OR REPLACE INTO theme_ecosystem_members
  (id, theme_id, ticker, company_name, field, role, is_major_player, observation_started_at)
VALUES
  ('eco-ai-jp-kioxia', 'theme-seed-ai-datacenter', 'N/A:KIOXIA', 'Kioxia Holdings Corporation', 'データストレージ', 'NANDフラッシュ。AI時代の記憶素子', 0, '2026-01-01'),
  ('eco-ai-jp-6701', 'theme-seed-ai-datacenter', '6701', 'NEC Corporation', 'データストレージ', '企業・DC向けストレージ／サーバー', 0, '2026-01-01'),
  ('eco-ai-jp-6501', 'theme-seed-ai-datacenter', '6501', 'Hitachi, Ltd.', 'データストレージ', 'ストレージ＋制御系', 0, '2026-01-01'),
  ('eco-ai-jp-6702', 'theme-seed-ai-datacenter', '6702', 'Fujitsu Limited', 'データストレージ', 'データセンター向けIT基盤', 0, '2026-01-01'),
  ('eco-ai-jp-toshiba-eds', 'theme-seed-ai-datacenter', 'N/A:TOSHIBA-EDS', 'Toshiba Electronic Devices & Storage', 'データストレージ', 'ストレージ用半導体', 0, '2026-01-01'),
  ('eco-ai-jp-1959', 'theme-seed-ai-datacenter', '1959', 'Kyudenko Corporation', '建設・電力', '電力・空調工事', 0, '2026-01-01'),
  ('eco-ai-jp-5802', 'theme-seed-ai-datacenter', '5802', 'Sumitomo Electric Industries', '建設・電力', '光ファイバー・送電線', 0, '2026-01-01'),
  ('eco-ai-jp-1944', 'theme-seed-ai-datacenter', '1944', 'Kinden Corporation', '建設・電力', '電力・通信インフラ工事', 0, '2026-01-01'),
  ('eco-ai-jp-6617', 'theme-seed-ai-datacenter', '6617', 'Toko Takaoka Co., Ltd.', '建設・電力', '変電・送配電機器', 0, '2026-01-01'),
  ('eco-ai-jp-5801', 'theme-seed-ai-datacenter', '5801', 'Furukawa Electric Co., Ltd.', '建設・電力', '光ファイバー・DC配線', 0, '2026-01-01'),
  ('eco-ai-jp-5803', 'theme-seed-ai-datacenter', '5803', 'Fujikura Ltd.', '建設・電力', '高速通信ケーブル', 0, '2026-01-01'),
  ('eco-ai-jp-jera', 'theme-seed-ai-datacenter', 'N/A:JERA', 'JERA Co., Inc.', '発電・電力', '発電専業（基幹電源）', 0, '2026-01-01'),
  ('eco-ai-jp-9503', 'theme-seed-ai-datacenter', '9503', 'Kansai Electric Power Company', '発電・電力', '電力供給・DC対応', 0, '2026-01-01'),
  ('eco-ai-jp-6367', 'theme-seed-ai-datacenter', '6367', 'Daikin Industries, Ltd.', '空調・冷却', 'DC向け空調・冷却', 0, '2026-01-01'),
  ('eco-ai-jp-7011', 'theme-seed-ai-datacenter', '7011', 'Mitsubishi Heavy Industries', '水インフラ', '上下水処理', 0, '2026-01-01'),
  ('eco-ai-jp-4776', 'theme-seed-ai-datacenter', '4776', 'Cybozu, Inc.', '非常電源', '発電・非常電源', 0, '2026-01-01'),
  ('eco-ai-jp-4901', 'theme-seed-ai-datacenter', '4901', 'FUJIFILM Holdings Corporation', 'ソフトウエア', 'DC運用・業務基盤', 0, '2026-01-01'),
  ('eco-ai-jp-4307', 'theme-seed-ai-datacenter', '4307', 'Nomura Research Institute', 'ソフトウエア', '非常用発電機', 0, '2026-01-01'),
  ('eco-ai-jp-4091', 'theme-seed-ai-datacenter', '4091', 'Nippon Sanso Holdings', 'ソフトウエア', '企業IT・データ基盤', 0, '2026-01-01'),
  ('eco-ai-jp-4021', 'theme-seed-ai-datacenter', '4021', 'Nissan Chemical Corporation', 'ソフトウエア', '業務アプリ層', 0, '2026-01-01'),
  ('eco-ai-jp-8035', 'theme-seed-ai-datacenter', '8035', 'Tokyo Electron Limited', 'ソフトウエア', '通信・IoT基盤', 0, '2026-01-01'),
  ('eco-ai-jp-5741', 'theme-seed-ai-datacenter', '5741', 'UACJ', '素材', 'アルミ', 0, '2026-01-01'),
  ('eco-ai-jp-5714', 'theme-seed-ai-datacenter', '5714', 'DOWAホールディングス', '素材', '都市鉱山・分別', 0, '2026-01-01'),
  ('eco-ai-jp-9247', 'theme-seed-ai-datacenter', '9247', 'TREホールディングス', '素材', '解体・リサイクル', 0, '2026-01-01'),
  ('eco-ai-jp-9519', 'theme-seed-ai-datacenter', '9519', 'JERA', '建設・電力', '非FIT・企業PPA', 0, '2026-01-01'),
  ('eco-ai-jp-renova', 'theme-seed-ai-datacenter', 'N/A:RENOVA', 'レノバ', '建設・電力', '火力・再エネ・将来原子力', 0, '2026-01-01');