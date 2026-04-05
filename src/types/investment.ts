export type AlphaHistory = number[];

/** Interpretation of `holdings.ticker` for Alpha inputs (see `src/lib/alpha-logic.ts`). */
export type TickerInstrumentKind = "JP_INVESTMENT_TRUST" | "US_EQUITY";

/** DB `holdings` row subset for sync / signals context. */
export interface Holding {
  id: string;
  ticker: string;
  providerSymbol?: string | null;
}

export type HoldingCategory = "Core" | "Satellite";

/** テーマまたはセクター軸の評価額シェア（サーバー集計、円ベース）。 */
export interface StructureTagSlice {
  tag: string;
  marketValue: number;
  weightPercent: number;
  /** 当該タグに属する銘柄数 */
  count: number;
}

/** Core / Satellite の実測 vs 目標 9:1。 */
export interface CoreSatelliteBreakdown {
  coreWeightPercent: number;
  satelliteWeightPercent: number;
  /** 目標コア比率（例: 90） */
  targetCorePercent: number;
  /** 実測コア − 目標（ポイント）。負ならコア不足 */
  coreGapVsTarget: number;
}

export interface Stock {
  id: string;
  ticker: string;
  name: string;
  /** 構造投資テーマ（`structure_tags` 先頭） */
  tag: string;
  alphaHistory: AlphaHistory;
  /** ポートフォリオ内ウェイト %（円換算・valuation_factor 後の評価額ベース） */
  weight: number;
  quantity: number;
  category: HoldingCategory;
  /** `holdings.avg_acquisition_price`（銘柄建て・未設定は null） */
  avgAcquisitionPrice: number | null;
  /** 含み損益（銘柄の建て通貨ベース、quantity×factor 込み） */
  unrealizedPnlLocal: number;
  /** 含み損益の円換算（米株は USD_JPY を適用） */
  unrealizedPnlJpy: number;
  /** (現在価格 − 平均取得) / 平均取得 × 100（取得単価が無効なら 0） */
  unrealizedPnlPercent: number;
  /** 直近 2 件の終値から算出した前日比 %（算出不可は null） */
  dayChangePercent: number | null;
  instrumentKind: TickerInstrumentKind;
  /** セクター（`structure_tags` の 2 番目。無ければ Other）。`sector` 列が空のときのフォールバック表示にも使う */
  secondaryTag: string;
  /** DB `holdings.sector`（明示セクター）。未設定は null（表示・集計は secondaryTag で代替） */
  sector: string | null;
  /** `alpha_history` 最新行の終値（無ければ null） */
  currentPrice: number | null;
  /**
   * 円ベースの評価額（表示・ウェイト用）。
   * 計算: quantity × currentPrice × valuation_factor × (USD_JPY_RATE または 1)。
   * 英字ティッカーは USD 換算、数字のみの投信は JPY のまま。
   * 指数価格を参照する投信は valuation_factor で実保有額（NAV 相当）に合わせる。
   */
  marketValue: number;
  /** 指数などのスケール補正（既定 1） */
  valuationFactor: number;
  /** Yahoo Finance 等。未設定時は `ticker` から自動変換（`price-service`）。 */
  providerSymbol?: string | null;
}

export interface Signal extends Stock {
  isWarning: boolean;
  isBuy: boolean;
  currentAlpha: number;
  /** ISO timestamp from `signals.detected_at`（クライアント合成シグナルでは空文字可） */
  detectedAt: string;
}

export interface SignalPerformanceLog {
  date: string;
  ticker: string;
  type: "BUY" | "WARN";
  result: string;
  status: "Active" | "Avoided" | "Success" | "Failed";
}

/** マクロ・市場指標 1 行（Yahoo 日足の直近終値と前日比 %）。 */
export type MarketIndicator = {
  label: string;
  value: number;
  changePct: number;
};

/** ダッシュボードヘッダー / 一覧フッター用の集計（`getDashboardData` が生成）。 */
export type DashboardSummary = {
  /** 各保有の最新 Alpha（日次）の単純平均 */
  portfolioAverageAlpha: number;
  /** VOO の最新終値（USD）。`alpha_history` は銘柄終値のみ保持のため Yahoo から取得。 */
  benchmarkLatestPrice: number;
  /** 保有銘柄数 */
  totalHoldings: number;
  /** 世界主要インデックス等（`getDashboardData` が Yahoo から一括取得） */
  marketIndicators: MarketIndicator[];
  /** 現在保有の取得価格合計（円）：各銘柄の marketValue − unrealizedPnlJpy の合計 */
  totalCostBasisJpy: number;
  /** `trade_history.realized_pnl_jpy` の累計（円） */
  totalRealizedPnlJpy: number;
  /** 含み損益 + 確定損益（円） */
  totalProfitJpy: number;
  /** totalProfitJpy / totalCostBasisJpy × 100（コスト 0 のときは 0） */
  totalReturnPct: number;
};

export type DashboardData = {
  stocks: Stock[];
  /** 構造投資テーマ（`structure_tags` 先頭）別の評価額・銘柄数 */
  structureByTheme: StructureTagSlice[];
  /** `holdings.sector` 優先、空なら `structure_tags` の 2 番目で集計した評価額・銘柄数 */
  structureBySector: StructureTagSlice[];
  coreSatellite: CoreSatelliteBreakdown;
  totalMarketValue: number;
  summary: DashboardSummary;
};

/** `investment_themes` 行（Notion 等から移行したテーマメタ）。 */
export type InvestmentThemeRecord = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  goal: string | null;
  createdAt: string;
};

/** `/themes/[theme]` 用: テーマメタ + 該当保有の Stock（ウェイトはテーマ内評価額ベース）。 */
export type ThemeDetailData = {
  themeName: string;
  theme: InvestmentThemeRecord | null;
  stocks: Stock[];
  themeTotalMarketValue: number;
  /** テーマ内銘柄の含み損益率（取得単価あり銘柄の単純平均） */
  themeAverageUnrealizedPnlPercent: number;
  /** テーマ内銘柄の最新日次 Alpha の単純平均 */
  themeAverageAlpha: number;
  benchmarkLatestPrice: number;
};

/** One row from `portfolio_daily_snapshots` (patrol / 乖離ログ). */
export type PortfolioDailySnapshotRow = {
  id: string;
  userId: string;
  snapshotDate: string;
  recordedAt: string;
  fxUsdJpy: number;
  benchmarkTicker: string;
  benchmarkClose: number | null;
  totalMarketValueJpy: number;
  totalUnrealizedPnlJpy: number | null;
  portfolioAvgAlpha: number | null;
  portfolioReturnVsPrevPct: number | null;
  benchmarkReturnVsPrevPct: number | null;
  alphaVsPrevPct: number | null;
  /** 同日 `market_glance_snapshots.payload_json` をパースした値（未記録時は undefined） */
  marketIndicators?: MarketIndicator[];
};

/** One row from `holding_daily_snapshots` (銘柄×日・Record snapshot 時). */
/** ダッシュボード「取引履歴」（売却行・サーバーで現在価格・売却後騰落率を付与） */
export type ClosedTradeDashboardRow = {
  id: string;
  tradeDate: string;
  ticker: string;
  name: string;
  market: "JP" | "US";
  accountName: string;
  side: "BUY" | "SELL";
  quantity: number;
  costJpy: number;
  proceedsJpy: number;
  feesJpy: number;
  realizedPnlJpy: number;
  /** 表示用・騰落率計算用（円/単位）。米国株は終値×USD_JPY_RATE */
  currentPriceJpy: number | null;
  /** (現在円単価 − 譲渡÷数量) / (譲渡÷数量) × 100 */
  postExitReturnPct: number | null;
  /** 正: 🚨 痛恨 / 負: ✅ 英断 / 算出不可: — */
  verdictLabel: string;
};

export type HoldingDailySnapshotRow = {
  id: string;
  userId: string;
  holdingId: string;
  snapshotDate: string;
  recordedAt: string;
  ticker: string;
  name: string;
  instrumentKind: TickerInstrumentKind;
  category: HoldingCategory;
  secondaryTag: string;
  quantity: number;
  valuationFactor: number;
  avgAcquisitionPrice: number | null;
  closePrice: number | null;
  marketValueJpy: number;
  unrealizedPnlJpy: number | null;
  unrealizedPnlPct: number | null;
  dayChangePct: number | null;
  benchmarkTicker: string;
  benchmarkClose: number | null;
  fxUsdJpy: number;
};
