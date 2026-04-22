-- 構造投資テーマ「ビットコイン」エコシステム拡充（MSTR / IREN / APLD / MARA / CLSK / COIN / IBIT）
-- theme_id: theme-seed-bitcoin-structural（045 と同一）
-- Apply: npx tsx scripts/apply-migration.ts migrations/046_bitcoin_ecosystem_members.sql

PRAGMA foreign_keys = ON;

INSERT OR REPLACE INTO theme_ecosystem_members
  (id, theme_id, ticker, company_name, field, role, is_major_player, observation_started_at)
VALUES
  (
    'eco-btc-mstr',
    'theme-seed-bitcoin-structural',
    'MSTR',
    'Strategy Inc.',
    'レバレッジ・財務',
    '構造: ビットコインの増幅装置・信認の核。観測: NAVプレミアム率、BTC買い増し発表の頻度。2026-04: 保有数 815,061 BTC（平均取得単価 $75,527）。配当支払い検討が構造的サポート。',
    1,
    '2026-04-01'
  ),
  (
    'eco-btc-iren',
    'theme-seed-bitcoin-structural',
    'IREN',
    'Iris Energy Limited',
    'インフラ・AI転換',
    '構造: 垂直統合型データセンター（BTC×AI）。観測: AI向け計算リソース収益比率、電力確保量。2026-04: Q1 2026 に 3億8,460万ドルの純利益。赤字から劇的黒字転換。',
    0,
    '2026-04-01'
  ),
  (
    'eco-btc-apld',
    'theme-seed-bitcoin-structural',
    'APLD',
    'Applied Digital Corporation',
    'インフラ・AI転換',
    '構造: 次世代 HPC・AI ホスティングインフラ。観測: M7 等大手テックとのホスティング契約締結。2026-04: さとしさんの「元カレ銘柄」として、AIインフラへの構造転換の主役。',
    0,
    '2026-04-01'
  ),
  (
    'eco-btc-mara',
    'theme-seed-bitcoin-structural',
    'MARA',
    'Marathon Digital Holdings, Inc.',
    '生産・採掘',
    '構造: ネットワークの番人・BTC 生産元。観測: HODL 戦略（売却せず保持）の継続。2026-04: 最大のハッシュレートを維持しつつ、B/S に BTC を蓄積する構造。',
    0,
    '2026-04-01'
  ),
  (
    'eco-btc-clsk',
    'theme-seed-bitcoin-structural',
    'CLSK',
    'CleanSpark, Inc.',
    '生産・採掘',
    '構造: 高効率マイナー（低コスト生産者）。観測: 1PH/s あたりの生産コスト（採算ライン）。2026-04: ヒューストンの巨大 HPC 併設サイトが稼働。エネルギー効率が武器。',
    0,
    '2026-04-01'
  ),
  (
    'eco-btc-coin',
    'theme-seed-bitcoin-structural',
    'COIN',
    'Coinbase Global, Inc.',
    '制度・ゲートウェイ',
    '構造: 暗号資産経済の OS・交換ハブ。観測: 取引高に対する保管資産（ETF 含）の比率。2026-04: 制度化された BTC 需要の受け皿。規制対応という参入障壁を持つ構造。',
    1,
    '2026-04-01'
  ),
  (
    'eco-btc-ibit',
    'theme-seed-bitcoin-structural',
    'IBIT',
    'iShares Bitcoin Trust ETF',
    '制度・ゲートウェイ',
    '構造: 機関投資家の資金流入パイプライン。観測: 純流入額のトレンド（構造的需要の強さ）。2026-04: 現物 ETF。伝統的金融市場からの「構造的な吸い上げ」を観測。',
    1,
    '2024-01-01'
  );