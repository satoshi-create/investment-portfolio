import type { JudgmentStatus } from "@/src/lib/judgment-logic";

export type AlphaHistory = number[];

/** Interpretation of `holdings.ticker` for Alpha inputs (see `src/lib/alpha-logic.ts`). */
export type TickerInstrumentKind = "JP_INVESTMENT_TRUST" | "JP_LISTED_EQUITY" | "US_EQUITY";

/**
 * Default benchmark ticker per instrument kind (regional benchmark separation).
 * - US: VOO
 * - JP listed equity / investment trust: TOPIX ETF (1306.T)
 */
export const DEFAULT_BENCHMARK_BY_INSTRUMENT_KIND: Record<TickerInstrumentKind, string> = {
  US_EQUITY: "VOO",
  JP_LISTED_EQUITY: "1306.T",
  JP_INVESTMENT_TRUST: "1306.T",
} as const;

/** DB `holdings` row subset for sync / signals context. */
export interface Holding {
  id: string;
  ticker: string;
  providerSymbol?: string | null;
  /** DB `holdings.listing_date` — 上場日・初回取引日（YYYY-MM-DD）。未設定は null */
  listingDate?: string | null;
  /** DB `holdings.market_cap`（現地通貨ベース・任意スケール）。未設定は null */
  marketCap?: number | null;
  /** DB `holdings.listing_price`（上場時 / 公募価格・現地通貨）。未設定は null。`instrument-metadata-sync` が Yahoo 日足最古バーで補完し得る */
  listingPrice?: number | null;
  /** DB `holdings.next_earnings_date` — 調査スナップより優先して決算日表示に使う（YYYY-MM-DD）。未設定は null */
  nextEarningsDate?: string | null;
  /** DB `holdings.ex_dividend_date`（Yahoo 同期）。未設定は null */
  exDividendDate?: string | null;
  /** DB `holdings.record_date`。未設定は null */
  recordDate?: string | null;
  /** DB `holdings.annual_dividend_rate`。未設定は null */
  annualDividendRate?: number | null;
  /** DB `holdings.dividend_yield_percent`。未設定は null */
  dividendYieldPercent?: number | null;
  /** DB `holdings.yahoo_research_synced_at`（ISO）。未設定は null */
  yahooResearchSyncedAt?: string | null;
  /**
   * DB `holdings.institutional_ownership`（機関投資家保有率・小数 0.15=15%）。Yahoo 同期。未設定は null
   */
  institutionalOwnership?: number | null;
  /** DB `holdings.memo`（自由記述）。未設定は null */
  memo?: string | null;
  /** DB `holdings.is_bookmarked`。未読込時は省略可 */
  isBookmarked?: boolean;
  /** DB `holdings.stop_loss_pct`（%・含み損益率が −値でこの幅を超えたら損切り想定）。未設定は null */
  stopLossPct?: number | null;
  /** DB `holdings.target_profit_pct`（%・利確ライン）。未設定は null */
  targetProfitPct?: number | null;
  /** DB `holdings.trade_deadline`（YYYY-MM-DD）。未設定は null */
  tradeDeadline?: string | null;
  /** DB `holdings.exit_rule_enabled`（1=短期ルールをシグナル・UIに適用） */
  exitRuleEnabled?: boolean;
  /** DB `holdings.avg_acquisition_price`（`fetchHoldingsWithProviderForUser` が読む場合のみ） */
  avgAcquisitionPrice?: number | null;
}

/**
 * Semantic KPI tone for signed metrics — maps to Tailwind `@theme inline` tokens in `app/globals.css`.
 * Use `INVESTMENT_METRIC_TONE_TEXT_CLASS[tone]` for `className`.
 */
export const INVESTMENT_METRIC_TONE_TEXT_CLASS = {
  positive: "text-accent-emerald",
  negative: "text-accent-rose",
  neutral: "text-muted-foreground",
  caution: "text-accent-amber",
} as const;

export type InvestmentMetricTone = keyof typeof INVESTMENT_METRIC_TONE_TEXT_CLASS;

/** Maps signed % KPIs (e.g. performance since IPO) to a semantic tone for themed text colors. */
export function investmentMetricToneForSignedPercent(value: number | null | undefined): InvestmentMetricTone {
  if (value == null || !Number.isFinite(value)) return "neutral";
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "neutral";
}

export type HoldingCategory = "Core" | "Satellite";

/**
 * Yahoo `quoteSummary` のキャッシュフロー（年次・四半期）から組み立てた自社株買いプロフィール。
 * `repurchaseOfStock` は Yahoo 上で負のことが多いため、表示・集計は絶対値。
 */
export type YahooBuybackPosture = {
  /** 会計期末ベース（年次が無いときは暦年集計を `YYYY-12-31` 代表日で格納）。新しい順。 */
  fiscalRepurchasesAbs: readonly { endDateYmd: string; amountAbs: number }[];
  /** 直近 3 暦年（年次または暦年集計）の自社株買い絶対値合計 */
  sum3yAbs: number | null;
  /** 直近 5 暦年 */
  sum5yAbs: number | null;
  /** 直近 4 四半期のうち、自社株買いが非ゼロだった期の数（0〜4） */
  activeQuartersLast4: number | null;
};

/**
 * ピーター・リンチの6分類（`holdings.expectation_category` / `theme_ecosystem_members.expectation_category`）。
 * DB 値は英語キー、UI は `LYNCH_CATEGORY_LABEL_JA`。
 */
export const LYNCH_CATEGORY_KEYS = [
  "SlowGrower",
  "Stalwart",
  "FastGrower",
  "AssetPlay",
  "Cyclical",
  "Turnaround",
] as const;
export type LynchCategory = (typeof LYNCH_CATEGORY_KEYS)[number];

export const LYNCH_CATEGORY_LABEL_JA: Record<LynchCategory, string> = {
  SlowGrower: "低成長株",
  Stalwart: "優良株",
  FastGrower: "急成長株",
  AssetPlay: "資産株",
  Cyclical: "市況関連株",
  Turnaround: "業績回復株",
};

/**
 * 構造分類タグ（自前 AI チップの設計主体など、ツール・UI 用のキー）。
 * DB の自由文とは別系統。拡張時はここに足す。
 */
export type StructureTag = "INFERENCE_SOVEREIGNTY";

/** 推論主権: 自前で AI 向けチップを設計・握る企業に付与するセマンティクス。 */
export const STRUCTURE_TAG_INFERENCE_SOVEREIGNTY: StructureTag = "INFERENCE_SOVEREIGNTY";

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
  /** 権利落ち日（ex-dividend date, YYYY-MM-DD）。取得できない場合は null。Inventory の配当カレンダーでは月次バケットに「X」表示 */
  exDividendDate: string | null;
  /** 権利落ちまでの日数（今日基準）。取得できない場合は null */
  daysToExDividend: number | null;
  /** 権利確定日（record date, YYYY-MM-DD）。取得できない場合は null。配当カレンダーでは月次バケットに「R」表示 */
  recordDate: string | null;
  /** 権利確定までの日数（今日基準）。取得できない場合は null */
  daysToRecordDate: number | null;
  /** 年間配当（現地通貨）。取得できない場合は null */
  annualDividendRate: number | null;
  /** 年間配当利回り %。取得できない場合は null */
  dividendYieldPercent: number | null;
  /** Yahoo 等のバリュエーション指標（無い場合は null）。投信などは通常 null。 */
  trailingPe: number | null;
  forwardPe: number | null;
  /** Yahoo `defaultKeyStatistics.priceToBook`。未取得・非正は null。 */
  priceToBook: number | null;
  trailingEps: number | null;
  forwardEps: number | null;
  /** PEG（Forward PER 優先で成長率とペア。算出不可は null） */
  pegRatio: number | null;
  /**
   * 配当込みPEG: `PE / (Earnings growth % + Dividend yield %)`（利回り未取得は 0 扱い）。
   * 分母が非正のときは通常の `pegRatio` にフォールバック。`computeDividendAdjustedPeg`。
   */
  dividendAdjustedPeg: number | null;
  /** トータル・リターン・レシオ `(予想成長% + 配当利回り%) / PER`（Forward PER 優先）。`computeTotalReturnYieldRatio` */
  totalReturnYieldRatio: number | null;
  /** 予想EPS成長率（小数 0.15 = 15%）。Yahoo 由来・未取得は null */
  expectedGrowth: number | null;
  /** Yahoo `assetProfile.country` 等。テーマ帯の可視化に利用。 */
  yahooCountry: string | null;
  /** 直近4Qの自社株買い（Yahoo CF・絶対値合算）。 */
  ttmRepurchaseOfStock: number | null;
  /** 推定 連続配当 年数（Yahoo 配当履歴 `historical` 優先。無いときは quoteSummary からの控えめなヒント）。 */
  consecutiveDividendYears: number | null;
  /** Yahoo CF 由来の自社株買いの複数期プロフィール（還元姿勢）。 */
  yahooBuybackPosture: YahooBuybackPosture | null;
  /** Yahoo `defaultKeyStatistics` の発行済株数スナップ（リサーチ取得時）。未取得は null。 */
  yahooQuoteSharesOutstanding: number | null;
  /** Yahoo `netSharePurchaseActivity.netInfoShares`（インサイダー純売買・自社株買いとは別）。 */
  yahooInsiderNetPurchaseShares: number | null;
  /**
   * 機関投資家の発行済株式に対する保有率（Yahoo `heldPercentInstitutions`、小数 0.15 = 15%）。未取得は null。
   */
  institutionalOwnership: number | null;
  /** 構造投資テーマ（`structure_tags` 先頭） */
  tag: string;
  alphaHistory: AlphaHistory;
  /**
   * `alphaHistory[i]` の観測日（YYYY-MM-DD）。`alphaHistory` と同長（系列が空なら空配列）。
   */
  alphaHistoryObservationDates: readonly string[];
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
  /** ライブ Alpha 用の前日終値（quote の騰落率から逆算、または alpha_history 系列）。算出不可は null */
  previousClose: number | null;
  /** 対応ベンチマークの当日騰落率（%）。米国→^GSPC、日本→^TPX（取得失敗時は ETF 等にフォールバックし得る） */
  benchmarkDayChangePercent: number | null;
  /** `benchmarkDayChangePercent` のデータ源シンボル（ツールチップ用） */
  liveAlphaBenchmarkTicker: string | null;
  /**
   * `alpha_history` で参照した最新日次 Alpha の観測日（YYYY-MM-DD）。系列が空なら null。
   */
  latestAlphaObservationYmd: string | null;
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
  /** `holdings.expectation_category`（リンチ分類）。未設定は null */
  expectationCategory: LynchCategory | null;
  /** `holdings.earnings_summary_note`（決算要約メモ）。未設定は null */
  earningsSummaryNote: string | null;
  /** `holdings.lynch_drivers_narrative`（ストーリーパネル・ドライバー叙述）。未設定は null */
  lynchDriversNarrative: string | null;
  /** `holdings.lynch_story_text`（ストーリーパネル・リンチ分析本文）。未設定は null */
  lynchStoryText: string | null;

  /** DB `holdings.listing_date`（上場日・YYYY-MM-DD）。未設定は null */
  listingDate: string | null;
  /** DB `holdings.market_cap`。未設定は null */
  marketCap: number | null;
  /** DB `holdings.listing_price`（上場価格・現地通貨）。未設定は null。`prefetchHoldingsInstrumentMetadata` が Yahoo 日足最古バーで補完し得る */
  listingPrice: number | null;
  /** DB `holdings.memo`。未設定は null */
  memo: string | null;
  /** DB `holdings.is_bookmarked` */
  isBookmarked: boolean;
  /** DB `holdings.stop_loss_pct`（%）。未設定は null */
  stopLossPct: number | null;
  /** DB `holdings.target_profit_pct`（%）。未設定は null */
  targetProfitPct: number | null;
  /** DB `holdings.trade_deadline`（YYYY-MM-DD）。未設定は null */
  tradeDeadline: string | null;
  /** DB `holdings.exit_rule_enabled` */
  exitRuleEnabled: boolean;
  /**
   * 上場来騰落率（表示用）。可能なら Yahoo 日足の **最古日〜最新日** を同一基準（adj または close のペア）で
   * (末日/初日 − 1)×100。チャート取得不能時は (現在価格 / listing_price − 1)×100 にフォールバック。
   */
  performanceSinceFoundation: number | null;

  /**
   * Efficiency metrics (theme ecosystem enriched).
   * NOTE: Some DBs / rows may not have these; in that case runtime may carry NaN.
   * UI should treat non-finite values as "—".
   */
  revenueGrowth: number;
  fcfMargin: number;
  fcfYield: number;
  /** revenueGrowth + fcfMargin */
  ruleOf40: number;
  /** R40×FCF Yield 判定エンジン（`computeInvestmentJudgment`） */
  judgmentStatus: JudgmentStatus;
  judgmentReason: string;
  /**
   * ネットキャッシュ（`ticker_efficiency_metrics.net_cash`、FMP 年次 BS: 流動性資産 − totalDebt、現地通貨）。
   * 未取得・非対象は null。
   */
  netCash: number | null;
  /** netCash ÷ 希薄化株数。欠損時は null。 */
  netCashPerShare: number | null;
  /** 株価 − 1株当たりネットキャッシュ（現地通貨）。いずれか欠損時は null。 */
  priceMinusNetCashPerShare: number | null;
  /** 当日（セッション）出来高（Yahoo `regularMarketVolume`、ライブ取得時） */
  regularMarketVolume: number | null;
  /** 10 日平均出来高。 */
  averageDailyVolume10Day: number | null;
  /** 出来高 / 10 日平均。商い急増の目安。 */
  volumeRatio: number | null;
  /**
   * 複利点火（ホームの Compounding Ignition 等）。ダッシュボード API がサーバで `stockFiveDayTrendIgnitionModel`
   * と同一ロジックにより設定。未送信の銘柄ではクライアントが再計算する。
   */
  isCompoundingIgnited?: boolean;
}

/** DB `signals.signal_type` and client-side synthetic live signals. */
export type LiveSignalType = "BUY" | "WARN" | "BREAK" | "CRITICAL";

export interface Signal extends Stock {
  isWarning: boolean;
  isBuy: boolean;
  /** Origin channel: slow trend (WARN) vs σ-shock structural break (BREAK / CRITICAL). */
  signalType: LiveSignalType;
  currentAlpha: number;
  /** ISO timestamp from `signals.detected_at`（クライアント合成シグナルでは空文字可） */
  detectedAt: string;
}

export interface SignalPerformanceLog {
  date: string;
  ticker: string;
  type: LiveSignalType;
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
  /**
   * 名目為替に依らない日次 α（現地リターン − 現地ベンチ）。Lv.1 の `alpha_history` 由来で、
   * 数値は `portfolioAverageAlpha` と一致する。
   */
  portfolioAverageFxNeutralAlpha: number;
  /**
   * 上記平均に使った各銘柄の「最新日次 α」の観測日のうち、最も古い YYYY-MM-DD（鮮度の下限）。
   * 全銘柄同じ日に揃っていれば `freshest` と一致。
   */
  portfolioAvgAlphaStalestLatestYmd: string | null;
  /** 平均に使った観測日のうち最も新しい YYYY-MM-DD。 */
  portfolioAvgAlphaFreshestLatestYmd: string | null;
  /**
   * ヘッダ表示用: NY 基準の観測日ラベル（例: "NY Mon 4/17 Close · vs VOO daily α"）。
   * サーバーで生成し、クライアントはそのまま表示。
   */
  portfolioAvgAlphaAsOfDisplay: string | null;
  /** 過去スナップショットの「日次α（%）」の算術平均（期待値）。未記録時は null。 */
  averageDailyAlphaPct: number | null;
  /** 現在値ベースの Live Alpha（全保有の時価加重平均、%）。算出不可時は null。 */
  portfolioTotalLiveAlphaPct: number | null;
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
  /** 現在保有の含み損益合計（円）。各銘柄 `unrealizedPnlJpy` の合計 */
  totalUnrealizedPnlJpy: number;
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

/** ダッシュボード「構造的年輪」用。各テーマの直近 ~90 日・加重累積 Alpha（構造トレンドと同系列の要約）。 */
export type ThemeStructuralSparklineEntry = {
  themeId: string;
  cumulativeValues: number[];
};

/** グローバル検索用: テーマエコシステムの観測銘柄 1 行。 */
export type EcosystemWatchlistSearchItem = {
  memberId: string;
  themeId: string;
  themeName: string;
  ticker: string;
  companyName: string;
  /** 複利点火（二階微分）検出済みフラグ。トップ画面のスリム帯表示に使用。 */
  isCompoundingIgnited: boolean;
  /** API で hybrid 注入後の価格ソース（永続化バックフィルは close のみ）。 */
  compoundingIgnitionPriceSource?: "live" | "close";
  /** 最新の Alpha 値 (%) */
  latestAlpha: number | null;
  /** 5日間トレンドの Alpha 系列 */
  alphaHistory5d: number[];
};

export type DashboardData = {
  stocks: Stock[];
  /** 保有の有無に関わらず、ユーザーが登録している全テーマ（`investment_themes`）。 */
  allThemes: InvestmentThemeRecord[];
  /** テーマカード用ミニチャート（テーマ ID 単位、`cumulativeValues` は時系列の累積 %） */
  themeStructuralSparklines: ThemeStructuralSparklineEntry[];
  /** 構造投資テーマ（`structure_tags` 先頭）別の評価額・銘柄数 */
  structureByTheme: StructureTagSlice[];
  /** `holdings.sector` 優先、空なら `structure_tags` の 2 番目で集計した評価額・銘柄数 */
  structureBySector: StructureTagSlice[];
  coreSatellite: CoreSatelliteBreakdown;
  totalMarketValue: number;
  summary: DashboardSummary;
  /** 構造テーマの観測銘柄（検索・ナビ用） */
  ecosystemWatchlistSearch: EcosystemWatchlistSearchItem[];
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

/** 技術普及キャズム上の位置（`theme_ecosystem_members.adoption_stage`）。 */
export type AdoptionStage = "innovator" | "early_adopter" | "chasm" | "early_majority" | "late_majority";

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
  /** 未上場: 最新ラウンド評価額（数値）。不明なら null */
  lastRoundValuation: number | null;
  /** 未上場を支える資本の供給源（例: "Amazon 40; Google 20; Apollo 10"）。 */
  privateCreditBacking: string | null;
  /** 企業特徴・リスク要因（ツールチップ等で表示） */
  observationNotes: string | null;
  companyName: string;
  /** ウォッチ上の分類タグ（Watchlist Asset の field と同系。例: 「IT / サービス」）。DB `theme_ecosystem_members.field` */
  field: string;
  role: string;
  isMajorPlayer: boolean;
  /** ポートフォリオのどこかで quantity>0 保有しているか */
  inPortfolio: boolean;
  /** 国名（現状は銘柄種別から推定）。例: "米国" / "日本" */
  countryName: string;
  /** 表示通貨・評価額換算（`classifyTickerInstrument` と一致） */
  instrumentKind: TickerInstrumentKind;
  /** 次回決算予定日（YYYY-MM-DD）。取得できない場合は null */
  nextEarningsDate: string | null;
  /** 次回決算までの日数（今日基準）。取得できない場合は null */
  daysToEarnings: number | null;
  /** 権利落ち日（ex-dividend date, YYYY-MM-DD）。取得できない場合は null */
  exDividendDate: string | null;
  /** 権利落ちまでの日数（今日基準）。取得できない場合は null */
  daysToExDividend: number | null;
  /** 権利確定日（record date, YYYY-MM-DD）。取得できない場合は null */
  recordDate: string | null;
  /** 権利確定までの日数（今日基準）。取得できない場合は null */
  daysToRecordDate: number | null;
  /** 年間配当（現地通貨）。取得できない場合は null */
  annualDividendRate: number | null;
  /** 年間配当利回り %。取得できない場合は null */
  dividendYieldPercent: number | null;
  /** Yahoo 等のバリュエーション指標（無い場合は null）。未上場・投信などは通常 null。 */
  trailingPe: number | null;
  forwardPe: number | null;
  /** Yahoo PBR（`priceToBook`）。未取得・非正は null。 */
  priceToBook: number | null;
  trailingEps: number | null;
  forwardEps: number | null;
  pegRatio: number | null;
  /** 配当込みPEG（無配は利回り0扱い・分母不可時は `pegRatio`）。`computeDividendAdjustedPeg`。 */
  dividendAdjustedPeg: number | null;
  /** トータル・リターン・レシオ（保有 `Stock` と同定義） */
  totalReturnYieldRatio: number | null;
  expectedGrowth: number | null;
  yahooCountry: string | null;
  ttmRepurchaseOfStock: number | null;
  consecutiveDividendYears: number | null;
  yahooBuybackPosture: YahooBuybackPosture | null;
  yahooQuoteSharesOutstanding: number | null;
  yahooInsiderNetPurchaseShares: number | null;
  /** 機関投資家保有率（Yahoo、小数 0.15=15%）。未取得は null。 */
  institutionalOwnership: number | null;
  /** `theme_ecosystem_members.observation_started_at`（銘柄投入日・累積 Alpha の第一優先起点）。未設定時は null */
  observationStartedAt: string | null;
  /** 観測起点からの累積 Alpha %（累積系列）。スパークライン・最新累積値用。日次は `alphaDailyHistory`。 */
  alphaHistory: number[];
  /** `alphaHistory`（累積）各点の営業日 YYYY-MM-DD。`alphaHistory` と同長。 */
  alphaCumulativeObservationDates: string[];
  /**
   * 日次 Alpha % の時系列（保有 `Stock.alphaHistory` と同義）。`TrendMiniChart`（5D）用。
   * `alphaHistory` は累積なので別配列。
   */
  alphaDailyHistory: number[];
  /** `alphaDailyHistory` 各点の観測日 YYYY-MM-DD。`alphaDailyHistory` と同長。 */
  alphaDailyObservationDates: string[];
  currentPrice: number | null;
  /** `alphaHistory` の最終点（累積 Alpha %） */
  latestAlpha: number | null;
  /** 累積系列上の実際の起点営観測日（投入日に最も近いデータ上の日）。算出不可時は null */
  alphaObservationStartDate: string | null;
  /** 日次 Alpha 系列からの Z（累積系列ではなく `alpha_history` / Yahoo 日次）。算出不可は null */
  alphaDeviationZ: number | null;
  /** 約90営業日の終値高値対比（現在価）。算出不可は null */
  drawdownFromHigh90dPct: number | null;
  /** 技術普及ステージ。未設定・旧 DB は null */
  adoptionStage: AdoptionStage | null;
  /** ステージ判断の根拠（ツールチップ優先）。未設定は null */
  adoptionStageRationale: string | null;
  /** `theme_ecosystem_members.expectation_category`（リンチ分類）。未設定は null */
  expectationCategory: LynchCategory | null;
  /** パラダイムシフトを阻む課題（DB `theme_ecosystem_members.chasm`）。未設定は null */
  chasm: string | null;
  /** 競合を寄せ付けない参入障壁（DB `theme_ecosystem_members.moat`）。未設定は null */
  moat: string | null;
  /** 垂直統合スコア 0–100（DB `theme_ecosystem_members.vi_score`）。未設定は null */
  viScore: number | null;

  /**
   * Defensive theme extensions (stored as JSON TEXT in SQLite).
   * - `holder_tags`: ["バークシャー","エル","ロンリード",...]
   * - `dividend_months`: [1,4,7,10,...]
   */
  holderTags: string[];
  dividendMonths: number[];
  defensiveStrength: string | null;
  /** `theme_ecosystem_members.is_kept` — 投資タイミング待ちの候補としてキープ */
  isKept: boolean;

  /**
   * Efficiency metrics (stored on theme_ecosystem_members; NaN when unknown).
   * - Rule of 40 = revenue growth % + FCF margin %.
   * - FCF Yield = FCF / valuation × 100 (listed: stored; unlisted: can be estimated from lastRoundValuation/estimatedValuation).
   */
  revenueGrowth: number;
  fcfMargin: number;
  fcfYield: number;
  ruleOf40: number;
  /** `ticker_efficiency_metrics.net_cash`（上場のみ・未取得は null） */
  netCash: number | null;
  /** ネットキャッシュ ÷ 時価総額 × 100（`marketCap` が正のときのみ算出） */
  netCashYieldPercent: number | null;
  /** `computeInvestmentJudgment` — サーバーが必ず付与（テーマ詳細 API） */
  judgmentStatus: JudgmentStatus;
  judgmentReason: string;

  /** DB `theme_ecosystem_members.listing_date`（上場日・YYYY-MM-DD）。未設定は null */
  listingDate: string | null;
  /** DB `theme_ecosystem_members.market_cap`。未設定は null */
  marketCap: number | null;
  /** DB `theme_ecosystem_members.listing_price`。未設定は null。`prefetchThemeEcosystemInstrumentMetadata` が Yahoo 日足最古バーで補完し得る */
  listingPrice: number | null;
  /** DB `theme_ecosystem_members.memo`（`observation_notes` とは別）。未設定は null */
  memo: string | null;
  /** DB `theme_ecosystem_members.earnings_summary_note`（決算要約・Markdown）。`memo` とは別 */
  earningsSummaryNote: string | null;
  /** DB `theme_ecosystem_members.lynch_drivers_narrative`（`encodeStoryPanelLynchPersist` 同梱可）。未適用 DB は null */
  lynchDriversNarrative: string | null;
  /** DB `theme_ecosystem_members.lynch_story_text`。未適用 DB は null */
  lynchStoryText: string | null;
  /** DB `theme_ecosystem_members.is_bookmarked`（`is_kept` とは別フラグ） */
  isBookmarked: boolean;
  /**
   * 上場来騰落率。可能なら日足初日〜末日の同一基準リターン、それ以外は `listing_price` と表示価格の比。
   */
  performanceSinceFoundation: number | null;

  /** `alpha_history` 由来の日次系列の直近観測日（5D Pulse）。 */
  latestDailyAlphaObservationYmd: string | null;
  priceSource: "live" | "close";
  previousClose: number | null;
  benchmarkDayChangePercent: number | null;
  liveAlphaBenchmarkTicker: string | null;
  regularMarketVolume: number | null;
  averageDailyVolume10Day: number | null;
  volumeRatio: number | null;

  /**
   * 複利点火（物理永続 + API で hybrid 再計算）。
   * `fast` スケルトン時は DB の `is_compounding_ignited` のみ参照。
   */
  isCompoundingIgnited: boolean;
  /** hybrid 再計算に使った株価ソース（live = Yahoo quote 優先が効いた）。 */
  compoundingIgnitionPriceSource?: "live" | "close";
};

/** 全テーマ横断のウォッチブックマーク 1 行（`getEcosystemCrossThemeBookmarks` 用） */
export type EcosystemCrossThemeBookmarkItem = ThemeEcosystemWatchItem & {
  themeName: string;
};

/** Alias: テーマエコシステムの 1 行（`ThemeEcosystemWatchItem` と同一）。 */
export type ThemeMember = ThemeEcosystemWatchItem;

/**
 * Unlisted unicorn holding schema (seed / import-friendly, snake_case).
 * NOTE: Runtime/UI uses `ThemeEcosystemWatchItem` (camelCase) as the canonical shape.
 */
export type UnicornHolding = {
  is_unlisted: true;
  expected_ipo_date: string;
  last_round_valuation: number;
  proxy_ticker: string;
  private_credit_backing: string;
};

/** テーマ起点正規化後の累積 Alpha（日次超過の合計、パーセントポイント）。 */
export type CumulativeAlphaPoint = {
  date: string;
  cumulative: number;
};

/**
 * 複利点火（日次 Alpha の二階微分）判定。`calculateAlphaAcceleration` の戻り値。
 * `skipReason` はデバッグ用（UI は未使用可）。
 */
export type AlphaAccelerationResult = {
  isCompoundingIgnited: boolean;
  lastAcceleration: number | null;
  lastVelocity: number | null;
  skipReason:
    | "too_few_daily_points"
    | "nan_in_series"
    | "cumulative_not_upward"
    | "accel_pair_not_both_positive"
    | null;
};

/**
 * 累積 Alpha の傾きから離散 Magnitude（M1.0–M8.0）。`alphaMagnitudeBadgeFromCumulativeHistory`。
 */
export type AlphaMagnitudeBadge = {
  label: string;
  slopePerStep: number | null;
};

export type ResourceSyncJudgment = "BUY_OPPORTUNITY" | "OVERHEATED" | "SYNCING" | "DECOUPLED" | null;

/** 江戸循環テーマ: 資源ETF vs エコシステム銘柄の正規化騰落率（同一アンカー）と乖離。 */
export type ResourceStructuralSyncPoint = {
  date: string;
  /** GLD 終値基準・起点からの累積騰落率（%） */
  gldPct: number;
  slvPct: number;
  cperPct: number;
  /** GLD / SLV / CPER の単純平均（%） */
  resourceCompositePct: number;
  /** ウォッチ対象銘柄の同日騰落率の単純平均（%） */
  ecosystemEquityAvgPct: number;
  /** Eco 平均 − 資源複合（乖離、pt） */
  spread: number;
  /** 乖離の絶対値が直近窓平均+σを上回る領域（網掛け用） */
  spreadWidening: boolean;
};

export type ResourceStructuralSyncData = {
  points: ResourceStructuralSyncPoint[];
  /** 全系列で採用した累積%の起点日 */
  anchorYmd: string | null;
  /** 系列に使ったエコシステムのティッカー（表示用） */
  ecoTickersUsed: string[];
  /** 銘柄ごとの最終判定 */
  individualJudgments: Record<string, {
    spread: number;
    judgment: ResourceSyncJudgment;
  }>;
};

/** 「都市鉱山×お宝銘柄」バナー: Yahoo 先物/指数シンボルの最新参照価格。 */
export type UrbanMiningMetalSpotRow = {
  labelJa: string;
  yahooSymbol: string;
  price: number | null;
  changePct: number | null;
  asOfDate: string | null;
};

/** 原油マクロ vs テーマ構造トレンド（年輪）並置チャートの 1 日。 */
export type OilThemeMacroChartPoint = {
  date: string;
  /** WTI 近月（CL=F）: 系列先頭日終値を基準とした累積騰落率（%）。欠損は null。 */
  wtiNormCumulativePct: number | null;
  /** `themeStructuralTrendSeries.cumulative` と同一。 */
  themeTrendCumulativePct: number | null;
};

/** WTI vs テーマ加重日次 Alpha の相関メタ付き。 */
export type OilThemeMacroChartData = {
  points: OilThemeMacroChartPoint[];
  /**
   * Pearson 相関（母標本）: 隣接する構造トレンド観測日について
   * WTI 日次%リターン vs テーマ加重日次 Alpha（累積系列の日次差分）。
   * ペア数が閾値未満のとき null。
   */
  wtiVsThemeTrendCorrelation: number | null;
  correlationPairCount: number;
  /** `THEME_STRUCTURAL_TREND_LOOKBACK_DAYS` と同義（表示用メタ）。 */
  correlationWindowDays: number;
};

/** 「非石油文明」「石油文明」専用: 原油スポット指標 + 対テーマ並置チャート。 */
export type OilThemeMacroContext = {
  indicators: MarketIndicator[];
  /** CL=F 日足の最終バー日付など（YYYY-MM-DD、ベストエフォート） */
  asOf: string | null;
  chart: OilThemeMacroChartData | null;
};

/** `/themes/[theme]` 用: テーマメタ + 該当保有の Stock（ウェイトはテーマ内評価額ベース）。 */
export type ThemeDetailData = {
  themeName: string;
  /** `investment_themes` に `theme` 名で一致する行が無い（URL/DB 名の不一致のヒント用） */
  themeMissing: boolean;
  theme: InvestmentThemeRecord | null;
  stocks: Stock[];
  themeTotalMarketValue: number;
  /** テーマ内銘柄の含み損益率（取得単価あり銘柄の単純平均） */
  themeAverageUnrealizedPnlPercent: number;
  /** テーマ内銘柄の最新日次 Alpha の単純平均 */
  themeAverageAlpha: number;
  /**
   * テーマ内保有の時価加重ライブ日次α（%）。`getDashboardData` の `portfolioTotalLiveAlphaPct` と同じ定義（テーマ内銘柄に限定）。
   * 算出不可時は null。
   */
  themeTotalLiveAlphaPct: number | null;
  /** 名目為替レンズに依らない日次 α（Lv.1 / 数値は通常 `themeAverageAlpha` と一致） */
  themeAverageFxNeutralAlpha: number;
  /** テーマ算出時の USD/JPY（換算レート・表示合成比の根拠） */
  fxUsdJpy: number;
  benchmarkLatestPrice: number;
  /**
   * テーマ保有の地域構成（合成ベンチマーク用）。評価額が付いている銘柄は時価加重、全ゼロ時は銘柄数。
   * `null` は保有ゼロ等で算出不能。
   */
  themeSyntheticUsRatio: number | null;
  themeSyntheticJpRatio: number | null;
  themeSyntheticBasis: "market_value" | "equal_count" | null;
  /** ヘッダー / ツールチップ用の参照終値（取得失敗時は null） */
  themeBenchmarkVooClose: number | null;
  themeBenchmarkTopixClose: number | null;
  /** 合成物差しの説明（title 用） */
  themeSyntheticBenchmarkTooltip: string | null;
  /** `theme_ecosystem_members` を拡張したウォッチリスト（テーブル未作成時は []） */
  ecosystem: ThemeEcosystemWatchItem[];
  /** `investment_themes.created_at` 起点のテーマ加重累積 Alpha 系列 */
  cumulativeAlphaSeries: CumulativeAlphaPoint[];
  /** 系列の最終累積値（%）。算出不可時は null */
  structuralAlphaTotalPct: number | null;
  /** 表示用の起点日（テーマ `created_at` の日付部。テーマ行が無い場合は系列先頭に合わせる） */
  cumulativeAlphaAnchorDate: string | null;
  /** 直近 N 日（サーバー UTC）を起点としたテーマ加重累積 Alpha（年輪トレンドチャート用・日次 Alpha を加重平均してから累積） */
  themeStructuralTrendSeries: CumulativeAlphaPoint[];
  /** `themeStructuralTrendSeries` の最終累積（%）。算出不可時は null */
  themeStructuralTrendTotalPct: number | null;
  /** 上記系列の累積起点日（YYYY-MM-DD） */
  themeStructuralTrendStartDate: string | null;
  /**
   * 「江戸循環ネットワーク文明」専用: 資源ETF（GLD/SLV/CPER）とエコ銘柄の同期騰落・乖離系列。
   * それ以外のテーマ・取得失敗時は null。
   */
  resourceStructuralSync: ResourceStructuralSyncData | null;
  /** `URBAN_MINING_THEME_NAME` のみ。金/銀/銅の Yahoo 参照価格（未取得は null 行）。 */
  urbanMiningMetalSpot: UrbanMiningMetalSpotRow[] | null;
  /**
   * 「非石油文明」「石油文明」のみ（フル取得時）。`fast=1` では常に null。
   * 原油スポット指標と WTI vs 構造トレンドの並置・相関。
   */
  oilMacroContext: OilThemeMacroContext | null;
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
  /** 記録時点の保有行数（`dash.stocks.length`）。032 未適用の旧行は null */
  holdingsCount: number | null;
  /** 直前の `snapshot_date` の holding_daily_snapshots と比較した新規 `holding_id` 数。比較不可時は null */
  holdingsAddedCount: number | null;
  /** 同上・消えた `holding_id` 数。比較不可時は null */
  holdingsRemovedCount: number | null;
  /** 同上・両日に存在した `holding_id` 数。比較不可時は null */
  holdingsContinuingCount: number | null;
  /**
   * 米株・日本上場株の数量合計のうち、`isLikelyEtfOrFundHolding` が false の行のみ（投信は種別上対象外）。
   * DB: `non_etf_listed_equity_quantity_total`。033 未適用の旧行は null。
   */
  nonEtfListedEquityQuantityTotal: number | null;
  portfolioAvgAlpha: number | null;
  portfolioReturnVsPrevPct: number | null;
  benchmarkReturnVsPrevPct: number | null;
  alphaVsPrevPct: number | null;
  /**
   * DB 列 `market_indicators_json`（記録時に dashboard の Market glance と同一 JSON を保存）。CSV 分析用。
   * 未移行・空行は undefined。
   */
  marketIndicatorsJson?: string;
  /** 同日 `market_glance_snapshots.payload_json` または上記列をパースした値（未記録時は undefined） */
  marketIndicators?: MarketIndicator[];
};

/**
 * スナップショット窓（既定30日暦日・端点含む）の集計。`portfolio_aggregate_kpis`。
 * 表示クライアントの `buildSnapshotStats` と同一定義（合計損益・評価額変化は窓内最古→最新）。
 */
export type PortfolioAggregateKPI = {
  id: string;
  userId: string;
  asOfDate: string;
  windowDays: number;
  snapshotCount: number;
  periodStart: string;
  periodEnd: string;
  totalProfitChange: number | null;
  valuationChange: number | null;
  avgPfDailyChangePct: number | null;
  avgBmDailyChangePct: number | null;
  /** 行ごとの `effectiveAlphaVsPrevPct` の算術平均（%） */
  avgAlphaDeviationPct: number | null;
  /** 記録行の VOO 当日%（`benchmark_change_pct`）の単純平均 */
  avgVooDailyPct: number | null;
  computedAt: string;
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
  /** `trade_history.reason`（取引時メモ）。未記録・旧行は null */
  reason: string | null;
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
  /** 記録時点の PEG（算出不可は null） */
  pegRatio: number | null;
  /** 記録時点の予想成長率（小数） */
  expectedGrowth: number | null;
};
