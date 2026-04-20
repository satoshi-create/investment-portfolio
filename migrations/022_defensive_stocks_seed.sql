-- Seed: Structural Investment Theme "ディフェンシブ銘柄"
-- - Keep insert-only semantics (no updates to existing rows)
-- - URL slug is handled at UI layer ("defensive-stocks" -> "ディフェンシブ銘柄")

PRAGMA foreign_keys = ON;

-- Theme row (insert-only)
INSERT INTO investment_themes (id, user_id, name, description, goal, created_at)
SELECT
  'theme-seed-defensive-stocks',
  'user-satoshi',
  'ディフェンシブ銘柄',
  '景気の熱狂ではなく、生活・信用・医療・物流など「基底レイヤー」から淡々とキャッシュを還流させる銘柄群。配当月・著名投資家の保有・防御的強みを手がかりに、静かに信頼できる構造を観測する。',
  'Alpha を追い過ぎない。乖離（Z）が 0 に近い「平常」を尊び、±2σ 超の揺らぎを点検対象にする。配当カレンダーでキャッシュ還流のリズムを把握し、暴落局面での守りの厚みを確認する。',
  datetime('now')
WHERE NOT EXISTS (
  SELECT 1 FROM investment_themes t
  WHERE t.user_id = 'user-satoshi' AND t.name = 'ディフェンシブ銘柄'
);

-- Members (insert-only; guarded by both PRIMARY KEY(id) and UNIQUE(theme_id,ticker))
WITH rows AS (
  SELECT 'eco-defensive-aapl' AS id, 'AAPL' AS ticker, 'Apple' AS company_name, 'USA' AS country, 'テクノロジー' AS field,
         '個人の思考と記憶を繋ぎ止める現代の「筆記具」' AS role,
         'デジタル生活のインフラ' AS defensive_strength,
         '["バークシャー"]' AS holder_tags,
         '[2,5,8,11]' AS dividend_months,
         0 AS is_major_player,
         '2026-04-13' AS observation_started_at,
         NULL AS observation_notes
  UNION ALL SELECT 'eco-defensive-axp','AXP','American Express','USA','金融サービス',
         '特権と信頼を還流させるグローバルな「通行手形」',
         '信用ネットワークの門番',
         '["バークシャー","ロンリード"]',
         '[1,4,7,10]',0,'2026-04-13',NULL
  UNION ALL SELECT 'eco-defensive-bac','BAC','Bank of America','USA','銀行',
         '経済の血液を循環させる巨大な「大噴水」',
         '資本の貯水池',
         '["バークシャー","ロンリード"]',
         '[3,6,9,12]',0,'2026-04-13',NULL
  UNION ALL SELECT 'eco-defensive-ko','KO','Coca-Cola','USA','飲料',
         '100年変わらぬレシピで渇きを癒やす「聖水」の分配',
         '普遍的な喉の潤い',
         '["バークシャー"]',
         '[4,7,10,12]',0,'2026-04-13',NULL
  UNION ALL SELECT 'eco-defensive-cvx','CVX','Chevron','USA','エネルギー',
         '現代文明の火を絶やさない「油問屋」の総元締',
         '化石燃料の最後の砦',
         '["バークシャー"]',
         '[3,6,9,12]',0,'2026-04-13',NULL
  UNION ALL SELECT 'eco-defensive-mco','MCO','Moody''s','USA','金融サービス',
         '市場の「正しさ」を定義する現代の「検校」',
         '格付けの審判員',
         '["バークシャー"]',
         '[3,6,9,12]',0,'2026-04-13',NULL
  UNION ALL SELECT 'eco-defensive-oxy','OXY','Occidental Petroleum','USA','エネルギー',
         '石油を掘り、炭素を埋める「土壌の調律師」',
         '炭素還流の先駆者',
         '["バークシャー"]',
         '[1,4,7,10]',0,'2026-04-13',NULL
  UNION ALL SELECT 'eco-defensive-cb','CB','Chubb','USA','保険',
         '万が一の災厄を平準化する「相互扶助」の極致',
         'リスクの受け皿',
         '["バークシャー"]',
         '[1,4,7,10]',0,'2026-04-13',NULL
  UNION ALL SELECT 'eco-defensive-khc','KHC','Kraft Heinz','USA','食品',
         '慣れ親しんだ味で安心を届ける「現代の調味料屋」',
         '食卓の彩り師',
         '["バークシャー"]',
         '[3,6,9,12]',0,'2026-04-13',NULL
  UNION ALL SELECT 'eco-defensive-googl','GOOGL','Alphabet','USA','インターネット',
         '全人類の知を整理し、アクセスを可能にする「現代の公文書館」',
         '情報の図書館',
         '["バークシャー"]',
         '[]',0,'2026-04-13',NULL
  UNION ALL SELECT 'eco-defensive-nyt','NYT','New York Times','USA','メディア',
         '混乱する世界に「記述」という楔を打ち込む「瓦版」の最高峰',
         '言葉の定着師',
         '["バークシャー"]',
         '[1,4,7,10]',0,'2026-04-13',NULL
  UNION ALL SELECT 'eco-defensive-wmt','WMT','Walmart','USA','小売',
         '生活必需品を最安値で還流させる「大江戸の卸問屋」',
         '供給網の総督',
         '["エル"]',
         '[1,4,6,9]',0,'2026-04-13',NULL
  UNION ALL SELECT 'eco-defensive-shw','SHW','Sherwin-Williams','USA','化学',
         '世界を塗り替え、劣化から守る「現代の漆塗り」',
         '景観の守護者',
         '["エル"]',
         '[3,6,9,12]',0,'2026-04-13',NULL
  UNION ALL SELECT 'eco-defensive-pg','PG','Procter & Gamble','USA','日用品',
         '日々の清潔と養生を支える「現代の始末屋」',
         '生活の基底膜',
         '["エル","ロンリード"]',
         '[2,5,8,11]',0,'2026-04-13',NULL
  UNION ALL SELECT 'eco-defensive-cvs','CVS','CVS Health','USA','ヘルスケア',
         '処方箋と日常のケアを繋ぐ「現代の薬種屋」',
         '街の養生所',
         '["エル","ロンリード"]',
         '[2,5,8,11]',0,'2026-04-13',NULL
  UNION ALL SELECT 'eco-defensive-jnj','JNJ','Johnson & Johnson','USA','ヘルスケア',
         '絆創膏から手術ロボまで、命の「普請」を支える',
         '生命の絆の番人',
         '["エル","ロンリード"]',
         '[3,6,9,12]',0,'2026-04-13',NULL
  UNION ALL SELECT 'eco-defensive-sbux','SBUX','Starbucks','USA','飲食店',
         '喧騒の中に静寂を売る「現代の茶屋」',
         '第三の居場所',
         '["エル"]',
         '[2,5,8,11]',0,'2026-04-13',NULL
  UNION ALL SELECT 'eco-defensive-ma','MA','Mastercard','USA','金融サービス',
         '現金の重みから解放する「見えない両替商」',
         '価値交換の神経網',
         '["エル"]',
         '[2,5,9,11]',0,'2026-04-13',NULL
  UNION ALL SELECT 'eco-defensive-abt','ABT','Abbott Laboratories','USA','ヘルスケア',
         '体内の「今」を数値化する「現代の蘭学者」',
         '診断の羅針盤',
         '["エル"]',
         '[2,5,8,11]',0,'2026-04-13',NULL
  UNION ALL SELECT 'eco-defensive-dpz','DPZ','Domino''s Pizza','USA','飲食店',
         '時間を短縮し満足を届ける「現代の出前」',
         '胃袋の即時還流',
         '["エル"]',
         '[3,6,9,12]',0,'2026-04-13',NULL
  UNION ALL SELECT 'eco-defensive-vig','VIG','Vanguard VIG','USA','ETF',
         '成長し続ける企業の集合体、まさに「投資の森」',
         '増配の年輪',
         '["エル"]',
         '[3,6,9,12]',0,'2026-04-13',NULL
  UNION ALL SELECT 'eco-defensive-nke','NKE','Nike','USA','アパレル',
         '「ただ動け」と背中を押す「現代の草鞋師」',
         '身体の拡張機',
         '["エル"]',
         '[1,4,7,10]',0,'2026-04-13',NULL
  UNION ALL SELECT 'eco-defensive-v','V','Visa','USA','金融サービス',
         '世界中どこでも「通じる」価値の定着装置',
         '決済の標準言語',
         '["エル"]',
         '[3,6,9,12]',0,'2026-04-13',NULL
  UNION ALL SELECT 'eco-defensive-cost','COST','Costco','USA','小売',
         'まとめ買いという「始末」の文化を体現する場所',
         '蔵造りの大倉庫',
         '["エル"]',
         '[2,5,8,11]',0,'2026-04-13',NULL
  UNION ALL SELECT 'eco-defensive-unh','UNH','UnitedHealth','USA','ヘルスケア',
         '膨大なデータを命に還流させる「現代の養生訓」',
         '医療のオーケストレーター',
         '["エル"]',
         '[3,6,9,12]',0,'2026-04-13',NULL
  UNION ALL SELECT 'eco-defensive-unp','UNP','Union Pacific','USA','鉄道',
         '鉄路で物流を支える「現代の五街道」',
         '大陸の動脈',
         '["エル"]',
         '[3,6,9,12]',0,'2026-04-13',NULL
  UNION ALL SELECT 'eco-defensive-mkc','MKC','McCormick','USA','食品',
         '世界中の香りを還流させる「現代の香具師」',
         '味覚の調律師',
         '["エル","ロンリード"]',
         '[1,4,7,10]',0,'2026-04-13',NULL
  UNION ALL SELECT 'eco-defensive-chd','CHD','Church & Dwight','USA','日用品',
         '素朴な素材で清潔を守る「知恵のパッケージ」',
         '重曹の錬金術師',
         '["エル"]',
         '[3,6,9,12]',0,'2026-04-13',NULL
  UNION ALL SELECT 'eco-defensive-hd','HD','Home Depot','USA','小売',
         '自らの手で生活を修繕する「DIY文化」の供給源',
         '普請の道具屋',
         '["エル"]',
         '[3,6,9,12]',0,'2026-04-13',NULL
  UNION ALL SELECT 'eco-defensive-lmt','LMT','Lockheed Martin','USA','防衛',
         '圧倒的な力で均衡を保つ「現代の城郭師」',
         '守護の技術者',
         '["エル"]',
         '[3,6,9,12]',0,'2026-04-13',NULL
  UNION ALL SELECT 'eco-defensive-dhr','DHR','Danaher','USA','ライフサイエンス',
         '絶え間ない最適化を繰り返す「カイゼンの思想」',
         '改善の科学者',
         '["エル"]',
         '[1,4,7,10]',0,'2026-04-13',NULL
  UNION ALL SELECT 'eco-defensive-abbv','ABBV','AbbVie','USA','ヘルスケア',
         '過剰な反応を抑え、調和を取り戻す「生命の調律」',
         '免疫の調停者',
         '["エル"]',
         '[2,5,8,11]',0,'2026-04-13',NULL
  UNION ALL SELECT 'eco-defensive-mmm','MMM','3M','USA','複合',
         '異なる技術を繋ぎ、新構造を生む「現代の細工師」',
         '万能の接着師',
         '["エル"]',
         '[3,6,9,12]',0,'2026-04-13',NULL
  UNION ALL SELECT 'eco-defensive-pm','PM','Philip Morris','USA','嗜好品',
         '習慣を技術で変容させる「現代の嗜み」',
         '煙なき憩いの創造者',
         '["エル"]',
         '[1,4,7,10]',0,'2026-04-13',NULL
  UNION ALL SELECT 'eco-defensive-mo','MO','Altria','USA','嗜好品',
         '規制の荒波を越えて還流する「古き良き煙」',
         '伝統的嗜好の継承者',
         '["エル"]',
         '[1,4,7,10]',0,'2026-04-13',NULL
  UNION ALL SELECT 'eco-defensive-pep','PEP','PepsiCo','USA','飲料・スナック',
         '日常の中の小さな「悦び」を量産する装置',
         '娯楽的栄養の提供者',
         '["エル"]',
         '[1,3,6,9]',0,'2026-04-13',NULL
  UNION ALL SELECT 'eco-defensive-jpm','JPM','JPMorgan Chase','USA','銀行',
         'グローバル金融の「中心点」として君臨する',
         '資本の総督',
         '["ロンリード"]',
         '[1,4,7,10]',0,'2026-04-13',NULL
  UNION ALL SELECT 'eco-defensive-wfc','WFC','Wells Fargo','USA','銀行',
         '庶民の預金を循環させる「現代の掛屋」',
         '生活に根ざした金庫',
         '["ロンリード"]',
         '[3,6,9,12]',0,'2026-04-13',NULL
  UNION ALL SELECT 'eco-defensive-cl','CL','Colgate-Palmolive','USA','日用品',
         '毎朝の儀式（歯磨き）を支える「現代の生活習慣」',
         '清潔の伝道師',
         '["ロンリード"]',
         '[2,5,8,11]',0,'2026-04-13',NULL
  UNION ALL SELECT 'eco-defensive-sjm','SJM','J.M. Smucker','USA','食品',
         'ジャムとコーヒーで日常の「輪郭」を作る',
         '朝食の記憶',
         '["ロンリード"]',
         '[3,6,9,12]',0,'2026-04-13',NULL
  UNION ALL SELECT 'eco-defensive-t','T','AT&T','USA','通信',
         '繋がることが当たり前を支える「現代のインフラ」',
         '情報の電信柱',
         '["ロンリード"]',
         '[2,5,8,11]',0,'2026-04-13',NULL
  UNION ALL SELECT 'eco-defensive-ge','GE','General Electric','USA','複合',
         'エジソンから続く「形にする力」の継承者',
         '発明の末裔',
         '["ロンリード"]',
         '[1,4,7,10]',0,'2026-04-13',NULL
  UNION ALL SELECT 'eco-defensive-dow','DOW','Dow Chemical','USA','化学',
         'あらゆる製品の「素（もと）」を生成する力',
         '素材の源流',
         '["ロンリード"]',
         '[3,6,9,12]',0,'2026-04-13',NULL
  UNION ALL SELECT 'eco-defensive-de','DE','Deere & Company','USA','機械',
         '農業を「工学」に変える「現代の鍬」',
         '土を耕す知能',
         '["ロンリード"]',
         '[2,5,8,11]',0,'2026-04-13',NULL
  UNION ALL SELECT 'eco-defensive-vfc','VFC','VF Corporation','USA','アパレル',
         '風景に馴染む「現代の普段着」の供給',
         '日常を着こなす力',
         '["ロンリード"]',
         '[3,6,9,12]',0,'2026-04-13',NULL
  UNION ALL SELECT 'eco-defensive-rtx','RTX','Raytheon (RTX)','USA','防衛・航空',
         '高度な技術で領土を守る「現代の防人」',
         '見えない盾と矛',
         '["ロンリード"]',
         '[3,6,9,12]',0,'2026-04-13',NULL
  UNION ALL SELECT 'eco-defensive-pcg','PCG','Pacific Gas & Electric','USA','公共事業',
         '生活の基盤である「光」を届けるインフラ',
         '地域の灯火',
         '["ロンリード"]',
         '[1,4,7,10]',0,'2026-04-13',NULL
  UNION ALL SELECT 'eco-defensive-leh','LEH','Lehman Brothers','USA','金融(破綻)',
         '永遠に続く構造などないことを教える「現代の碑」',
         '過信の反省点',
         '["ロンリード"]',
         '[]',0,'2026-04-13','消滅'

)
INSERT INTO theme_ecosystem_members (
  id,
  theme_id,
  ticker,
  company_name,
  field,
  role,
  is_major_player,
  observation_started_at,
  observation_notes,
  holder_tags,
  dividend_months,
  defensive_strength
)
SELECT
  r.id,
  'theme-seed-defensive-stocks',
  r.ticker,
  r.company_name,
  r.field,
  r.role,
  r.is_major_player,
  r.observation_started_at,
  r.observation_notes,
  r.holder_tags,
  r.dividend_months,
  r.defensive_strength
FROM rows r
WHERE NOT EXISTS (SELECT 1 FROM theme_ecosystem_members m WHERE m.id = r.id)
  AND NOT EXISTS (
    SELECT 1 FROM theme_ecosystem_members m
    WHERE m.theme_id = 'theme-seed-defensive-stocks' AND m.ticker = r.ticker
  );

