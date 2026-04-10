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
  ('eco-deoil-vlowy', 'theme-seed-de-oil', 'VLOWY', 'Vallourec S.A. (ADR)', 'Material', '高温地熱用・特殊シームレス鋼管', 0, '2026-02-28'),
  ('eco-deoil-jks', 'theme-seed-de-oil', 'JKS', 'JinkoSolar Holding Co., Ltd.', '太陽光モジュール', '大型ソーラー・蓄電池。脱炭素電源の物理レイヤー', 0, '2026-02-28'),
  ('eco-deoil-nvts', 'theme-seed-de-oil', 'NVTS', 'Navitas Semiconductor Corporation', 'パワー半導体（GaN/SiC）', 'EV充電・太陽光向け次世代電力変換', 0, '2026-02-28');


-- 江戸循環ネットワーク文明 ecosystem / watchlist
-- theme_id: investment-themes-seed.sql の「江戸循環ネットワーク文明」行（theme-seed-edo-circular）
-- 事前: 012_theme_ecosystem_observation_started_at.sql / theme_ecosystem_members の observation_notes 列（migrate-theme-ecosystem-unlisted.ts 等）適用済み

PRAGMA foreign_keys = ON;

INSERT OR REPLACE INTO theme_ecosystem_members
  (id, theme_id, ticker, company_name, field, role, is_major_player, observation_started_at, observation_notes)
VALUES
  ('eco-edo-5022', 'theme-seed-edo-circular', '5022', 'レボインターナショナル', 'エネルギー還流', '現代の下肥商', 0, '2026-02-28', '地政学ポテンシャル: 廃食用油回収の分散型ネットワークとSAF化'),
  ('eco-edo-5020', 'theme-seed-edo-circular', '5020', 'ＥＮＥＯＳホールディングス', 'エネルギー還流', '大江戸エネルギー大問屋', 0, '2026-02-28', '地政学ポテンシャル: 廃プラ油化・SAF等、巨大還流ハブへの転換'),
  ('eco-edo-5019', 'theme-seed-edo-circular', '5019', '出光興産', 'エネルギー還流', '地域エネルギーの元締', 0, '2026-02-28', '地政学ポテンシャル: アンモニア・水素の地域グリッド構築'),
  ('eco-edo-5011', 'theme-seed-edo-circular', '5011', 'ニチレキグループ', 'エネルギー還流', '現代の普請', 0, '2026-02-28', '地政学ポテンシャル: アスファルト再生による道路インフラの長寿命化'),
  ('eco-edo-5013', 'theme-seed-edo-circular', '5013', 'ユシロ化学工業', 'エネルギー還流', '道具の守り人', 0, '2026-02-28', '地政学ポテンシャル: 生分解性切削油による低エントロピー加工'),
  ('eco-edo-5018', 'theme-seed-edo-circular', '5018', 'ＭＯＲＥＳＣＯ', 'エネルギー還流', '職人御用達の油さし', 0, '2026-02-28', '地政学ポテンシャル: 環境負荷極小の特殊真空ポンプ油等'),
  ('eco-edo-5021', 'theme-seed-edo-circular', '5021', 'コスモエネルギーホールディングス', 'エネルギー還流', '風の文明への先導者', 0, '2026-02-28', '地政学ポテンシャル: 風力発電とSAFへのポートフォリオ移行'),
  ('eco-edo-3315', 'theme-seed-edo-circular', '3315', '日本コークス工業', 'エネルギー還流', '現代の炭焼き', 0, '2026-02-28', '地政学ポテンシャル: 石炭技術の資源リサイクル・粉体技術への転用'),
  ('eco-edo-5010', 'theme-seed-edo-circular', '5010', '日本精蝋', 'エネルギー還流', '現代の蝋燭屋', 0, '2026-02-28', '地政学ポテンシャル: 天然由来ワックス・高機能素材による脱石油'),
  ('eco-edo-5017', 'theme-seed-edo-circular', '5017', '富士石油', 'エネルギー還流', '循環型リファイナリー', 0, '2026-02-28', '地政学ポテンシャル: 原油精製拠点のバイオ燃料化プロセス'),
  ('eco-edo-5015', 'theme-seed-edo-circular', '5015', 'ビーピー・カストロール', 'エネルギー還流', '摩擦の制御師', 0, '2026-02-28', '地政学ポテンシャル: 高効率潤滑による機械寿命の最大化'),

  ('eco-edo-3861', 'theme-seed-edo-circular', '3861', '王子ホールディングス', '素材還流', '大江戸八百八町の森番', 0, '2026-02-28', '地政学ポテンシャル: 広大な社有林による炭素固定と木材由来新素材CNFの社会実装'),
  ('eco-edo-3863', 'theme-seed-edo-circular', '3863', '日本製紙', '素材還流', '令和の和紙革新師', 0, '2026-02-28', '地政学ポテンシャル: 脱プラを加速させる紙製バリア包装とCNFの多用途展開'),
  ('eco-edo-3941', 'theme-seed-edo-circular', '3941', 'レンゴー', '素材還流', '還流の総元締', 0, '2026-02-28', '地政学ポテンシャル: 段ボールリサイクル率99%以上を支える循環インフラ'),
  ('eco-edo-3877', 'theme-seed-edo-circular', '3877', '中越パルプ工業', '素材還流', '里山資源の再生屋', 0, '2026-02-28', '地政学ポテンシャル: 放置竹林を紙に変える竹紙プロジェクト'),
  ('eco-edo-3708', 'theme-seed-edo-circular', '3708', '特種東海製紙', '素材還流', '高機能紙の細工師', 0, '2026-02-28', '地政学ポテンシャル: 特殊紙技術と廃棄物焼却による自家発電循環'),
  ('eco-edo-3891', 'theme-seed-edo-circular', '3891', 'ニッポン高度紙工業', '素材還流', '電気の還流を支える薄紙師', 0, '2026-02-28', '地政学ポテンシャル: コンデンサ用セパレータ世界首位でエネルギー循環を支える'),
  ('eco-edo-3896', 'theme-seed-edo-circular', '3896', '阿波製紙', '素材還流', '水と繊維の調律師', 0, '2026-02-28', '地政学ポテンシャル: 水処理膜用支持体など環境浄化ネットワークの中核'),
  ('eco-edo-3950', 'theme-seed-edo-circular', '3950', 'ザ・パック', '素材還流', '現代の通い袋師', 0, '2026-02-28', '地政学ポテンシャル: プラスチックから紙へのシフトを店頭から支える'),
  ('eco-edo-3864', 'theme-seed-edo-circular', '3864', '三菱製紙', '素材還流', '情報の定着師', 0, '2026-02-28', '地政学ポテンシャル: リサイクル可能な感熱紙と環境配慮素材への転換'),

  ('eco-edo-4540', 'theme-seed-edo-circular', '4540', 'ツムラ', '生命還流', '現代の薬草園・漢方の守り人', 0, '2026-02-28', '地政学ポテンシャル: 生薬の持続可能な調達ネットワークと未病・養生の知恵'),
  ('eco-edo-4527', 'theme-seed-edo-circular', '4527', 'ロート製薬', '生命還流', '養生と自律の伴走者', 0, '2026-02-28', '地政学ポテンシャル: 自己治癒力を高める再生医療とウェルビーイングの循環'),
  ('eco-edo-4502', 'theme-seed-edo-circular', '4502', '武田薬品工業', '生命還流', '薬種中買仲間の末裔', 0, '2026-02-28', '地政学ポテンシャル: 近世大阪道修町から続く知恵のグローバル構造化'),
  ('eco-edo-4894', 'theme-seed-edo-circular', '4894', 'クオリプス', '生命還流', '生命を耕す現代の土壌師', 0, '2026-02-28', '地政学ポテンシャル: iPS細胞による臓器再生という命の還流の物理実装'),
  ('eco-edo-4524', 'theme-seed-edo-circular', '4524', '森下仁丹', '生命還流', '伝統知恵のパッケージング師', 0, '2026-02-28', '地政学ポテンシャル: 生薬成分と微小カプセルによる始末の設計'),
  ('eco-edo-4568', 'theme-seed-edo-circular', '4568', '第一三共', '生命還流', '蘭学から続く知の継承者', 0, '2026-02-28', '地政学ポテンシャル: 日本独自のバイオ技術による生命ネットワークの再構築'),
  ('eco-edo-4574', 'theme-seed-edo-circular', '4574', '大幸薬品', '生命還流', '置き薬の精神的支柱', 0, '2026-02-28', '地政学ポテンシャル: 家庭の自立的な保健システムを支える歴史的信頼の還流'),
  ('eco-edo-4523', 'theme-seed-edo-circular', '4523', 'エーザイ', '生命還流', '養生訓の現代的実践者', 0, '2026-02-28', '地政学ポテンシャル: 共感を中心とした生命ネットワークのケア'),
  ('eco-edo-4880', 'theme-seed-edo-circular', '4880', 'セルソース', '生命還流', '細胞の再資源化拠点', 0, '2026-02-28', '地政学ポテンシャル: 個人の細胞を未来の資源として還流させるインフラ'),
  ('eco-edo-4536', 'theme-seed-edo-circular', '4536', '参天製薬', '生命還流', '職人の目を見守る番人', 0, '2026-02-28', '地政学ポテンシャル: 見る文化を支え感性を維持する特化型インフラ');