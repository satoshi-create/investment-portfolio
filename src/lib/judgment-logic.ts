/** 判定エンジンへ渡す投資スタンス（期待カテゴリーからマッピング）。 */
export type InvestmentNarrative = "growth" | "recovery" | "speculative";

/** 一覧・CSV 等でそのまま表示する判定ラベル。 */
export type JudgmentStatus = "ELITE" | "ACCUMULATE" | "WATCH" | "DANGER";

export type JudgmentInput = {
  ruleOf40: number;
  fcfYield: number;
  narrative: InvestmentNarrative;
  /** `ticker_efficiency_metrics.prior_rule_of_40`。未記録時は ACCUMULATE の「改善」判定に使えない。 */
  priorRuleOf40?: number | null;
  /** 売上成長率（%）。「成長鈍化」ヒューリスティックに利用。 */
  revenueGrowth?: number | null;
};

export type JudgmentResult = {
  status: JudgmentStatus;
  /** UI ツールチップ・ログ用の一文。 */
  reason: string;
};

/** ソート用: 数値が小さいほど投資優先度が高い（ELITE → … → DANGER）。 */
export function judgmentPriorityRank(status: JudgmentStatus): number {
  switch (status) {
    case "ELITE":
      return 0;
    case "ACCUMULATE":
      return 1;
    case "WATCH":
      return 2;
    case "DANGER":
      return 3;
    default:
      return 9;
  }
}

function fmt(n: number): string {
  return Number.isFinite(n) ? n.toFixed(1) : "—";
}

function growthSlowdown(input: JudgmentInput): boolean {
  const prior = input.priorRuleOf40;
  const r40 = input.ruleOf40;
  const rg = input.revenueGrowth;
  if (input.narrative !== "growth") return false;
  const droppedVsPrior =
    prior != null && Number.isFinite(prior) && Number.isFinite(r40) && r40 < prior - 3;
  const revenueWeak = rg != null && Number.isFinite(rg) && rg < 8;
  return droppedVsPrior || revenueWeak;
}

/**
 * Rule of 40 と FCF Yield を組み合わせた保有銘柄の投資判定（純関数）。
 *
 * - ELITE: 構造が強くキャッシュ創出もプラス
 * - ACCUMULATE: 前期比で R40 が改善しつつ割安シグナル（FCF Yield）
 * - DANGER: 構造崩壊レベルの悪さ、または成長前提といえない実数
 * - WATCH: 中立・モニタリング
 */
export function computeInvestmentJudgment(input: JudgmentInput): JudgmentResult {
  const r40 = input.ruleOf40;
  const fy = input.fcfYield;
  const narrative = input.narrative;

  if (!Number.isFinite(r40) || !Number.isFinite(fy)) {
    return {
      status: "WATCH",
      reason: "Rule of 40 または FCF Yield が算出できないため、数値ベースの断定は保留（期待と実数の検証が必要）。",
    };
  }

  if (r40 > 40 && fy > 0) {
    return {
      status: "ELITE",
      reason: `R40が${fmt(r40)}と40を上回り、かつFCF Yieldがプラス（${fmt(fy)}%）。規律上「構造」と「キャッシュ」の両輪が揃った状態。`,
    };
  }

  if (r40 < -40) {
    return {
      status: "DANGER",
      reason: `R40が${fmt(r40)}と著しく低く、効率性の観点で構造リスクが高い（出血・特異の悪化に警戒）。`,
    };
  }

  if (narrative === "growth" && growthSlowdown(input) && fy < -10) {
    return {
      status: "DANGER",
      reason:
        `成長前提だが実数が悪化（R40 ${fmt(r40)}%、FCF Yield ${fmt(fy)}%）。` +
        `売上成長の鈍化またはR40の低下と相まって規律上「削減・注意」ゾーン。`,
    };
  }

  const prior = input.priorRuleOf40;
  if (prior != null && Number.isFinite(prior) && r40 > prior && fy > 3) {
    return {
      status: "ACCUMULATE",
      reason: `R40が${fmt(prior)}→${fmt(r40)}へ改善し、FCF Yield ${fmt(fy)}%でキャッシュリターン面の割安寄りシグナル。`,
    };
  }

  return {
    status: "WATCH",
    reason:
      `R40 ${fmt(r40)}%、FCF Yield ${fmt(fy)}%。` +
      `エリート条件・累積条件・危険条件のいずれにも該当せず、中立監視（0〜40付近やデータ不足の組み合わせも含む）。`,
  };
}

/**
 * DB の期待カテゴリーを判定エンジン用ナラティブへ。
 * 未設定は **growth**（ユーザー指定のデフォルト）。
 */
export function expectationCategoryToInvestmentNarrative(
  c: "Growth" | "Recovery" | "Quality" | "Value" | "Heritage" | null,
): InvestmentNarrative {
  if (c == null) return "growth";
  if (c === "Growth" || c === "Quality") return "growth";
  if (c === "Recovery" || c === "Value") return "recovery";
  if (c === "Heritage") return "speculative";
  return "growth";
}
