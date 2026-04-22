-- 構造投資「ビットコイン」テーマ: 日本株エコシステム追加（観測開始 2026-01-01）
-- theme_id: theme-seed-bitcoin-structural
-- Apply: npx tsx scripts/apply-migration.ts migrations/047_bitcoin_ecosystem_jp_members.sql

PRAGMA foreign_keys = ON;

INSERT OR REPLACE INTO theme_ecosystem_members
  (id, theme_id, ticker, company_name, field, role, is_major_player, observation_started_at)
VALUES
  (
    'eco-btc-jp-3350',
    'theme-seed-bitcoin-structural',
    '3350',
    'Metaplanet Inc.',
    'レバレッジ・財務',
    '構造: 日本版マイクロストラテジー（BTC 蓄積体）。観測: BTC 保有残高の増加ペース、ワラントによる資金調達構造。2026-04: 「財務 OS を円から BTC へリプレイス」する先駆者。株価の BTC 連動係数が日本で最も高い、との見立て。',
    1,
    '2026-01-01'
  ),
  (
    'eco-btc-jp-8698',
    'theme-seed-bitcoin-structural',
    '8698',
    'Monex Group, Inc.',
    '制度・ゲートウェイ',
    '構造: 暗号資産交換 OS（コインチェック）の運営。観測: 取引所の売買代金、ドコモ経済圏との構造的統合。2026-04: コインチェックの NASDAQ 上場後の評価と、NTT ドコモとの連携による「大衆化構造」を観測。',
    1,
    '2026-01-01'
  ),
  (
    'eco-btc-jp-8473',
    'theme-seed-bitcoin-structural',
    '8473',
    'SBI Holdings, Inc.',
    '制度・ゲートウェイ',
    '構造: 総合デジタル資産エコシステム。観測: リップル（XRP）との接続、マイニング事業の採算。2026-04: 伝統的金融とデジタル資産をブリッジする最大のノード。B2C から B2B（R3 等）まで垂直統合。',
    1,
    '2026-01-01'
  ),
  (
    'eco-btc-jp-9449',
    'theme-seed-bitcoin-structural',
    '9449',
    'GMO Internet Group, Inc.',
    'OS・インフラ',
    '構造: デジタル通貨インフラ・ステーブルコイン。観測: ステーブルコイン（GYEN）の流通量、マイニング機器・電力供給。2026-04: 独自ステーブルコインによる「決済 OS」の構築と、インフラ層での BTC ネットワーク支援。',
    0,
    '2026-01-01'
  ),
  (
    'eco-btc-jp-3778',
    'theme-seed-bitcoin-structural',
    '3778',
    'SAKURA Internet Inc.',
    'インフラ・AI転換',
    '構造: 計算資源供給（BTC マイニングからの教訓）。観測: 政府支援による GPU 確保量、HPC（高性能計算）需要。2026-04: 直接の BTC 保有はないが、マイナーと同じ「計算資源の供給」構造。市場では同セクターとして動きやすい。',
    0,
    '2026-01-01'
  ),
  (
    'eco-btc-jp-4385',
    'theme-seed-bitcoin-structural',
    '4385',
    'Mercari, Inc.',
    'C2C・循環OS',
    '構造: ビットコインの流動性出口（メルコイン）。観測: 不用品売買代金の BTC 変換比率。2026-04: 「ビットコインを売らずに使う」循環（始末と活用）の構造を持つ、との整理。',
    0,
    '2026-01-01'
  ),
  (
    'eco-btc-jp-1605',
    'theme-seed-bitcoin-structural',
    '1605',
    'INPEX Corporation',
    'エネルギー・出口',
    '構造: 余剰エネルギーの BTC 変換（将来構造）。観測: フレアリングガス利用のマイニング検討、原油価格相関。2026-04: 石油文明側が「エネルギーの貯蔵」として BTC をどう組み込むかの過渡期、との観測枠。',
    0,
    '2026-01-01'
  );
