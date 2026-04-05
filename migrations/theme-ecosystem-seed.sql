-- AIデータセンター ecosystem / watchlist
-- theme_id は investment-themes-seed.sql の AIデータセンター行に合わせる
-- 事前: migrations/012_theme_ecosystem_observation_started_at.sql 適用済みであること

PRAGMA foreign_keys = ON;

INSERT OR REPLACE INTO theme_ecosystem_members
  (id, theme_id, ticker, company_name, field, role, is_major_player, observation_started_at)
VALUES
  ('eco-ai-sndk', 'theme-seed-ai-datacenter', 'SNDK', 'SanDisk Corporation', 'データストレージ', 'フラッシュメモリ・SSD。AI時代のデータ保存層（WD子会社）', 0, '2026-01-01'),
  ('eco-ai-wdc', 'theme-seed-ai-datacenter', 'WDC', 'Western Digital Corporation', 'データストレージ', 'HDD・SSD大手。DC向け記憶装置', 0, '2026-01-01'),
  ('eco-ai-stx', 'theme-seed-ai-datacenter', 'STX', 'Seagate Technology Holdings plc', 'データストレージ', 'HDD専業。超大容量ストレージ', 0, '2026-01-01'),
  ('eco-ai-pwr', 'theme-seed-ai-datacenter', 'PWR', 'Quanta Services, Inc.', '建設・電力', '送電・通信インフラ工事', 0, '2026-01-01'),
  ('eco-ai-prim', 'theme-seed-ai-datacenter', 'PRIM', 'Primoris Services Corporation', '建設・電力', 'エネルギー・通信建設', 0, '2026-01-01'),
  ('eco-ai-aph', 'theme-seed-ai-datacenter', 'APH', 'Amphenol Corporation', '建設・電力', '高速光・銅コネクタ', 0, '2026-01-01'),
  ('eco-ai-cifr', 'theme-seed-ai-datacenter', 'CIFR', 'Cipher Mining Inc.', 'ビットコイン採掘', '電力保有型採掘', 0, '2026-01-01'),
  ('eco-ai-iren', 'theme-seed-ai-datacenter', 'IREN', 'Iris Energy Limited', 'ビットコイン採掘', '再エネ型採掘・DC', 0, '2026-01-01'),
  ('eco-ai-1942', 'theme-seed-ai-datacenter', '1942', 'Kandenko Co., Ltd.', '建設・電力', '送電・DC電気工事', 0, '2026-01-01'),
  ('eco-ai-9501', 'theme-seed-ai-datacenter', '9501', 'Tokyo Electric Power Company Holdings, Incorporated', '発電・電力', '大規模電力供給', 0, '2026-01-01'),
  ('eco-ai-6503', 'theme-seed-ai-datacenter', '6503', 'Mitsubishi Electric Corporation', '空調・冷却', '空調・電力制御', 0, '2026-01-01'),
  ('eco-ai-9613', 'theme-seed-ai-datacenter', '9613', 'Kubota Corporation', '空調・冷却', '冷却水・循環ポンプ', 0, '2026-01-01'),
  ('eco-ai-4401', 'theme-seed-ai-datacenter', '4401', 'ADEKA Corporation', '材料', '石英ガラス・マスク材料', 0, '2026-01-01'),
  ('eco-ai-amat', 'theme-seed-ai-datacenter', 'AMAT', 'Applied Materials, Inc.', '前工程', '成膜・エッチング装置', 0, '2026-01-01'),
  ('eco-ai-intc', 'theme-seed-ai-datacenter', 'INTC', 'Intel Corporation', 'IDM（設計〜前工程〜後工程）', 'CPU/GPU/AI向け半導体（IDM）', 0, '2026-01-01'),
  ('eco-ai-3436', 'theme-seed-ai-datacenter', '3436', 'SUMCO Corporation', '材料', 'シリコンウェハー', 0, '2026-01-01'),
  ('eco-ai-6361', 'theme-seed-ai-datacenter', '6361', 'Ebara Corporation', '前工程', '真空ポンプ・CMP装置', 0, '2026-01-01'),
  ('eco-ai-4063', 'theme-seed-ai-datacenter', '4063', 'Shin-Etsu Chemical Co., Ltd.', '前工程（CMP）', 'CMP研磨材・研磨パッド', 0, '2026-01-01'),
  ('eco-ai-5703', 'theme-seed-ai-datacenter', '5703', 'Nippon Light Metal Holdings Company, Ltd.', '素材', 'アルミ', 0, '2026-01-01'),
  ('eco-ai-nee', 'theme-seed-ai-datacenter', 'NEE', 'NextEra Energy, Inc.', '建設・電力', '再エネPPA供給', 0, '2026-01-01'),
  ('eco-ai-apld', 'theme-seed-ai-datacenter', 'APLD', 'Applied Digital Corporation', 'ビットコイン採掘', '電力直結型AI・HPC向けDC', 0, '2026-01-01'),
  ('eco-ai-aa', 'theme-seed-ai-datacenter', 'AA', 'Alcoa Corporation', '素材（アルミ）', 'アルミ精錬・供給', 0, '2026-01-01'),
  ('eco-ai-s32', 'theme-seed-ai-datacenter', 'S32', 'South32 Limited', '資源（アルミ・銅）', 'アルミ・銅の中堅供給者', 0, '2026-01-01'),
  ('eco-ai-rio', 'theme-seed-ai-datacenter', 'RIO', 'Rio Tinto plc', '資源（銅・アルミ）', '銅・アルミ供給／M&A軸', 0, '2026-01-01'),
  ('eco-ai-uec', 'theme-seed-ai-datacenter', 'UEC', 'Uranium Energy Corp.', 'ウラン', 'ウラン開発・生産', 0, '2026-01-01'),
  ('eco-ai-uuuu', 'theme-seed-ai-datacenter', 'UUUU', 'Energy Fuels Inc.', 'ウラン・レアアース', '米国内供給＋加工', 0, '2026-01-01'),
  ('eco-ai-qqq', 'theme-seed-ai-datacenter', 'QQQ', 'Invesco QQQ Trust Series 1', 'ETF（マグニフィセント７）', 'マグニフィセント７連動ETF', 0, '2026-01-01'),
  ('eco-ai-fngs', 'theme-seed-ai-datacenter', 'FNGS', 'MicroSectors FANG+ ETN', 'ETF（マグニフィセント７）', 'FANG+ 指数連動', 0, '2026-01-01'),
  ('eco-ai-5411', 'theme-seed-ai-datacenter', '5411', 'JFE Holdings, Inc.', 'その他', 'インドの将来性テーマ（表では当該タグ。AIデータセンターseedに含める場合の投入用）', 0, '2026-01-01'),
  ('eco-ai-googl', 'theme-seed-ai-datacenter', 'GOOGL', 'Alphabet Inc.', '検索／広告／AI', '情報探索・広告・AI API基盤', 0, '2026-01-01'),
  ('eco-ai-6166', 'theme-seed-ai-datacenter', '6166', 'Nakamura-Tome Precision Industry Co., Ltd.', '前工程', '半導体向けダイヤモンドワイヤ', 0, '2026-01-01'),
  ('eco-ai-corz', 'theme-seed-ai-datacenter', 'CORZ', 'Core Scientific, Inc.', 'ビットコイン採掘', '', 0, '2026-01-01'),
  ('eco-ai-agr', 'theme-seed-ai-datacenter', 'AGR', 'Avangrid, Inc.', '洋上風力・電力', '米国洋上風力開発・DC向け再エネ供給', 0, '2026-01-01'),
  ('eco-ai-pry', 'theme-seed-ai-datacenter', 'PRY', 'Prysmian S.p.A.', '送電・海底ケーブル', '洋上風力×DC送電インフラ', 0, '2026-01-01'),
  ('eco-ai-gev', 'theme-seed-ai-datacenter', 'GEV', 'GE Vernova Inc.', '風力タービン', '', 0, '2026-01-01'),
  ('eco-ai-crwv', 'theme-seed-ai-datacenter', 'CRWV', 'CoreWeave, Inc.', 'ビットコイン採掘', '表では採掘分類。実体はAI/HPCクラウド中心のため分野の見直し推奨', 0, '2026-01-01');


  -- 非石油文明 ecosystem / watchlist
-- theme_id: investment-themes-seed.sql の「非石油文明」行（theme-seed-de-oil）
-- 事前: 012_theme_ecosystem_observation_started_at.sql 適用済み

PRAGMA foreign_keys = ON;

INSERT OR REPLACE INTO theme_ecosystem_members
  (id, theme_id, ticker, company_name, field, role, is_major_player, observation_started_at)
VALUES
  ('eco-deoil-slb', 'theme-seed-de-oil', 'SLB', 'Schlumberger NV', 'エネルギーOS・地熱', '世界最大の油田サービス。石油技術を地熱や水素、CCUSへ転換する「技術の輸出国」。', 0, '2026-02-28'),
  ('eco-deoil-sedg', 'theme-seed-de-oil', 'SEDG', 'SolarEdge Technologies, Inc.', '太陽光パワコン', '分散型電源の「電力変換OS」提供', 0, '2026-02-28'),
  ('eco-deoil-300750', 'theme-seed-de-oil', '300750.SZ', 'Contemporary Amperex Technology Co., Limited (CATL)', '二次電池インフラ', '非石油文明の「エネルギー・ストレージ」', 0, '2026-02-28'),
  ('eco-deoil-ttk', 'theme-seed-de-oil', 'TTKPRESTIG.NS', 'TTK Prestige Limited', '電化調理器具', '調理プロトコルの「ガス脱却」推進', 0, '2026-02-28'),
  ('eco-deoil-plug', 'theme-seed-de-oil', 'PLUG', 'Plug Power Inc.', '水素燃料電池', '石油代替の「グリーン水素」プロトコル', 0, '2026-02-28'),
  ('eco-deoil-enph', 'theme-seed-de-oil', 'ENPH', 'Enphase Energy, Inc.', 'マイクロインバーター', '家庭用エネルギーの「分散型制御OS」', 0, '2026-02-28'),
  ('eco-deoil-reliance', 'theme-seed-de-oil', 'RELIANCE.NS', 'Reliance Industries Limited', '複合（新エネ）', '石油精製OSから「グリーン水素OS」への転換', 0, '2026-02-28'),
  ('eco-deoil-vfs', 'theme-seed-de-oil', 'VFS', 'VinFast Auto Ltd.', 'EV・二輪', '東南アジアの「移動電化OS」急先鋒', 0, '2026-02-28'),
  ('eco-deoil-ttm', 'theme-seed-de-oil', 'TTM', 'Tata Motors Limited', 'EV・商用車', 'インドの「石油依存脱却」を担う最大プラットフォーム', 0, '2026-02-28'),
  ('eco-deoil-azre', 'theme-seed-de-oil', 'AZRE', 'Azure Power Global Limited', '太陽光発電', 'インドの「天産エネルギー」供給OS', 0, '2026-02-28'),
  ('eco-deoil-sqm', 'theme-seed-de-oil', 'SQM', 'Sociedad Química y Minera de Chile S.A.', 'リチウム資源', '非石油文明の「物理ソース（リチウム）」支配', 0, '2026-02-28'),
  ('eco-deoil-nu', 'theme-seed-de-oil', 'NU', 'Nu Holdings Ltd.', 'デジタル金融', '資源消費を極小化する「ペーパーレス・デジタルOS」', 0, '2026-02-28'),
  ('eco-deoil-dq', 'theme-seed-de-oil', 'DQ', 'Daqo New Energy Corp.', 'ポリシリコン', '太陽光パネルの「計算資源（シリコン）」供給', 0, '2026-02-28'),
  ('eco-deoil-nio', 'theme-seed-de-oil', 'NIO', 'NIO Inc.', 'EV・インフラ', 'バッテリー交換式による「充電待機バグ」の解消', 0, '2026-02-28'),
  ('eco-deoil-vwdry', 'theme-seed-de-oil', 'VWDRY', 'Vestas Wind Systems A/S (ADR)', 'Physical (Power)', '風力発電タービン製造（世界シェア1位）', 0, '2026-02-28'),
  ('eco-deoil-sbgsy', 'theme-seed-de-oil', 'SBGSY', 'Schneider Electric SE (ADR)', 'Logic / OS', 'エネルギー管理 / 自動化ソリューション', 0, '2026-02-28'),
  ('eco-deoil-abbny', 'theme-seed-de-oil', 'ABBNY', 'ABB Ltd (ADR)', 'Logic / Control', '産業オートメーション / EV充電インフラ', 0, '2026-02-28'),
  ('eco-deoil-dnngy', 'theme-seed-de-oil', 'DNNGY', 'Ørsted A/S (ADR)', 'Physical (Power)', '洋上風力発電開発・運営', 0, '2026-02-28'),
  ('eco-deoil-mod', 'theme-seed-de-oil', 'MOD', 'Modine Manufacturing Company', 'Thermal Mgmt', 'AIサーバー用高度液冷システム', 0, '2026-02-28'),
  ('eco-deoil-vlowy', 'theme-seed-de-oil', 'VLOWY', 'Vallourec S.A. (ADR)', 'Material', '高温地熱用・特殊シームレス鋼管', 0, '2026-02-28');