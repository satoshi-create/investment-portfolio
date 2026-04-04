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

/** プライマリ構造タグ別の評価額シェア（サーバー集計、円ベース）。 */
export interface StructureTagSlice {
  tag: string;
  marketValue: number;
  weightPercent: number;
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
  /** `structure_tags` の 2 番目を業界代理で使用（無ければ Other） */
  secondaryTag: string;
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
}

export interface SignalPerformanceLog {
  date: string;
  ticker: string;
  type: "BUY" | "WARN";
  result: string;
  status: "Active" | "Avoided" | "Success" | "Failed";
}
