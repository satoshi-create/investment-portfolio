/** Koyomi 2.0: theme swimlanes (API + UI). */

export type KoyomiQualityKind = import("@/src/lib/alpha-logic").EarningsQualityKind;
export type KoyomiRuleOf40DeltaStatus = import("@/src/lib/alpha-logic").RuleOf40DeltaStatus;
export type KoyomiMuscleDeltaStatus = import("@/src/lib/alpha-logic").FundamentalMuscleDeltaStatus;

export type KoyomiLaneItem = {
  id: string;
  memberId: string;
  themeId: string;
  themeName: string;
  ticker: string;
  companyName: string | null;
  ymd: string;
  dayOrder: number;
  hasOutcome: boolean;
  qualityKind: KoyomiQualityKind;
  qualityScore: number;
  epsSurprisePct: number | null;
  revenueSurprisePct: number | null;
  priceImpactPct: number | null;
  isEpicenter: boolean;
  /** 0..1 先行決算の負の重力の波及 */
  gravityTaint: number;
  isUnlisted: boolean;
  displayTicker: string;
  epsSide: import("@/src/lib/alpha-logic").SurpriseKind;
  revSide: import("@/src/lib/alpha-logic").SurpriseKind;
  /** 直近四半期の Rule of 40（売上成長% + FCF マージン%。Yahoo 四半期）。チップ常時表示の主数値。 */
  ruleOf40Current: number | null;
  /** その 1 四半期前 */
  ruleOf40Prior: number | null;
  ruleOf40Delta: number | null;
  ruleOf40DeltaStatus: KoyomiRuleOf40DeltaStatus;
  /** 売上成長% + 営業利益率%（直近四半期スコア） */
  muscleScoreCurrent: number | null;
  muscleScorePrior: number | null;
  muscleDelta: number | null;
  muscleDeltaStatus: KoyomiMuscleDeltaStatus;
  /** 当日セッションの株価騰落率（%）。Yahoo `price` モジュール。未算出は null */
  regularMarketChangePercent: number | null;
  /**
   * 筋肉（売上成長+営業利益率）が前四半期比で改善なのに、
   * 株価が `MISPRICED_SESSION_DROP_PCT` % 以上下げている場合。
   */
  isMispriced: boolean;
};

export type KoyomiThemeLane = {
  themeId: string;
  themeName: string;
  items: KoyomiLaneItem[];
};

export type KoyomiLaneResponse = {
  startYmd: string;
  endYmd: string;
  todayYmd: string;
  themeLanes: KoyomiThemeLane[];
  outcomeTableMissing: boolean;
};
