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
  /** `holdings.account_type`（特定 / NISA）。未設定時は null（表示側で特定扱い可） */
  accountType: "特定" | "NISA" | null;
  /** 国名（現状は銘柄種別から推定）。例: "米国" / "日本" */
  countryName: string;
  /** 次回決算予定日（YYYY-MM-DD）。取得できない場合は null */
  nextEarningsDate: string | null;
  /** 次回決算までの日数（今日基準）。取得できない場合は null */
  daysToEarnings: number | null;
  /** 年間配当（現地通貨）。取得できない場合は null */
  annualDividendRate: number | null;
  /** 年間配当利回り %。取得できない場合は null */
  dividendYieldPercent: number | null;
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
  /** 含み損益の円換算（米株は USD/JPY レートを適用） */
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
  /** 表示中の `currentPrice` の取得元（ライブ quote / 日次終値または DB 系列） */
  priceSource: "live" | "close";
  /** 価格の基準時刻（ISO 8601）。ライブ時は quote のタイムスタンプ、日次時はその営業日の目安。未取得は null */
  lastUpdatedAt: string | null;
  /** `alpha_history` 最新行の終値（無ければ null） */
  currentPrice: number | null;
  /** 直近日次 Alpha の約30営業日ベース Z（負ほど直近が平均より冷えている）。算出不可は null */
  alphaDeviationZ: number | null;
  /** 過去約90観測の終値高値対比（現在価）。算出不可は null */
  drawdownFromHigh90dPct: number | null;
  /**
   * 円ベースの評価額（表示・ウェイト用）。
   * 計算: quantity × currentPrice × valuation_factor ×（米株は USD/JPY レート、投信等は 1）。
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
  /** VOO の参照価格（USD）。ライブ quote 優先、失敗時は日足終値。 */
  benchmarkLatestPrice: number;
  /** VOO の変化率 %（ライブ時は quote、日次時は直近2本の日足から。算出不可は null）。 */
  benchmarkChangePct: number | null;
  /** VOO 価格の取得元（`quote` ライブ系 / 日足 chart） */
  benchmarkPriceSource: "live" | "close";
  /** VOO 価格の基準時刻（ISO）。ライブ時は quote 時刻、日次時は営業日の目安。 */
  benchmarkAsOf: string | null;
  /** USD/JPY レート（`JPY=X` 最新終値）。取得失敗時は null。 */
  fxUsdJpy: number | null;
  /** 保有銘柄数 */
  totalHoldings: number;
  /** 世界主要インデックス等（`getDashboardData` が Yahoo から一括取得） */
  marketIndicators: MarketIndicator[];
  /** Gold futures (GC=F) price (USD). */
  goldPrice: number | null;
  /** Bitcoin price (BTC-USD, USD). */
  btcPrice: number | null;
  /** 現在保有の取得価格合計（円）：各銘柄の marketValue − unrealizedPnlJpy の合計 */
  totalCostBasisJpy: number;
  /** `trade_history.realized_pnl_jpy` の累計（円） */
  totalRealizedPnlJpy: number;
  /** 含み損益 + 確定損益（円） */
  totalProfitJpy: number;
  /** totalProfitJpy / totalCostBasisJpy × 100（コスト 0 のときは 0） */
  totalReturnPct: number;
  /**
   * 保有銘柄の前日比 %（`dayChangePercent` が取れた銘柄の算術平均）。
   * いずれも算出不可のときは null（Holdings 明細フッターと同じ定義）。
   */
  portfolioAvgDayChangePct: number | null;
};

export type DashboardData = {
  stocks: Stock[];
  /** 保有の有無に関わらず、ユーザーが登録している全テーマ（`investment_themes`）。 */
  allThemes: InvestmentThemeRecord[];
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

/** テーマ・エコシステムのウォッチリスト 1 銘柄（保有問わず観測）。 */
export type ThemeEcosystemWatchItem = {
  id: string;
  themeId: string;
  ticker: string;
  /** 未上場銘柄（dummy ticker） */
  isUnlisted: boolean;
  /** 代理観測用の上場ティッカー（未上場のときに使用） */
  proxyTicker: string | null;
  /** IPO 予定時期（例: '2026-Q4'） */
  estimatedIpoDate: string | null;
  /** 想定時価総額（文字列） */
  estimatedValuation: string | null;
  /** 企業特徴・リスク要因（ツールチップ等で表示） */
  observationNotes: string | null;
  companyName: string;
  field: string;
  role: string;
  isMajorPlayer: boolean;
  /** ポートフォリオのどこかで quantity>0 保有しているか */
  inPortfolio: boolean;
  /** 国名（現状は銘柄種別から推定）。例: "米国" / "日本" */
  countryName: string;
  /** 次回決算予定日（YYYY-MM-DD）。取得できない場合は null */
  nextEarningsDate: string | null;
  /** 次回決算までの日数（今日基準）。取得できない場合は null */
  daysToEarnings: number | null;
  /** 年間配当（現地通貨）。取得できない場合は null */
  annualDividendRate: number | null;
  /** 年間配当利回り %。取得できない場合は null */
  dividendYieldPercent: number | null;
  /** `theme_ecosystem_members.observation_started_at`（銘柄投入日・累積 Alpha の第一優先起点）。未設定時は null */
  observationStartedAt: string | null;
  /** テーマ `created_at` 起点の累積 Alpha %（日次超過の合計）。`alpha_history` 優先、不足時は Yahoo 日次から算出 */
  alphaHistory: number[];
  currentPrice: number | null;
  /** `alphaHistory` の最終点（累積 Alpha %） */
  latestAlpha: number | null;
  /** 累積系列上の実際の起点営観測日（投入日に最も近いデータ上の日）。算出不可時は null */
  alphaObservationStartDate: string | null;
  /** 日次 Alpha 系列からの Z（累積系列ではなく `alpha_history` / Yahoo 日次）。算出不可は null */
  alphaDeviationZ: number | null;
  /** 約90営業日の終値高値対比（現在価）。算出不可は null */
  drawdownFromHigh90dPct: number | null;
};

/** テーマ起点正規化後の累積 Alpha（日次超過の合計、パーセントポイント）。 */
export type CumulativeAlphaPoint = {
  date: string;
  cumulative: number;
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
  /** `theme_ecosystem_members` を拡張したウォッチリスト（テーブル未作成時は []） */
  ecosystem: ThemeEcosystemWatchItem[];
  /** `investment_themes.created_at` 起点のテーマ加重累積 Alpha 系列 */
  cumulativeAlphaSeries: CumulativeAlphaPoint[];
  /** 系列の最終累積値（%）。算出不可時は null */
  structuralAlphaTotalPct: number | null;
  /** 表示用の起点日（テーマ `created_at` の日付部。テーマ行が無い場合は系列先頭に合わせる） */
  cumulativeAlphaAnchorDate: string | null;
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
  /** 記録時点の VOO 当日騰落 %（`getDashboardData` の benchmarkChangePct）。未記録・旧行は null */
  benchmarkChangePct: number | null;
  totalMarketValueJpy: number;
  totalUnrealizedPnlJpy: number | null;
  /** `total_profit`＝記録時 `DashboardSummary.totalProfitJpy`（含み+確定）。未移行 DB では null */
  totalProfitJpy: number | null;
  /** `cost_basis`＝記録時 `DashboardSummary.totalCostBasisJpy`（各銘柄 評価額−含み の合計）。未移行 DB では null */
  costBasisJpy: number | null;
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
  /** 表示用・騰落率計算用（円/単位）。米国株は終値×USD/JPY */
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
