import type { LynchCategory } from "@/src/types/investment";
import { LYNCH_CATEGORY_LABEL_JA } from "@/src/types/investment";

/**
 * リンチ流ストーリー・マトリクス（急成長〜低成長）に基づくテンプレ。
 * 文言はプロダクト用マトリクス表を正とする（急成長のドライバーは「市場拡大」「シェア奪取」）。
 */
export type LynchStoryMatrixEntry = {
  icon: string;
  drivers: string[];
  /** 2 分ストーリー用の例文・プレースホルダ */
  storyTemplate: string;
  inputHints: string[];
  monitoringJa: string;
};

const ENTRIES: Record<LynchCategory, LynchStoryMatrixEntry> = {
  FastGrower: {
    icon: "🚀",
    drivers: ["市場拡大", "シェア奪取"],
    storyTemplate:
      "「〇〇（製品）は現在××（地域）で支配的。今後数年で全米/世界へ水平展開（スケール）する計画で、成長余力はまだ△△％ある。」",
    inputHints: ["市場の飽和度", "他州・他国への展開余地"],
    monitoringJa: "売上高の成長率がおおむね20%前後を維持しているか？",
  },
  Stalwart: {
    icon: "🏰",
    drivers: ["値上げ", "市場拡大"],
    storyTemplate:
      "「PERは歴史的下限にある。価格決定権を行使してマージンを改善しつつ、新製品が安定成長に寄与し、サプライズを生む。」",
    inputHints: ["過去のPER下限との比較", "新製品の寄与度"],
    monitoringJa: "Forward P/E が過去平均より低いか？",
  },
  Turnaround: {
    icon: "🔄",
    drivers: ["赤字部門の整理・閉鎖", "コスト削減"],
    storyTemplate:
      "「不採算の××部門を閉鎖（GC）し、本業にリフォーカスした。借入金も減少傾向にあり、システムの再起動が完了しつつある。」",
    inputHints: ["赤字部門の切り離し状況", "ネットキャッシュの推移"],
    monitoringJa: "ネットキャッシュが増え、有利子負債が減っているか？",
  },
  AssetPlay: {
    icon: "💎",
    drivers: ["含み資産の顕在化", "時価に織り込まれないキャッシュ・事業"],
    storyTemplate:
      "「時価総額に反映されていない不動産や子会社、特許という名の『蔵の在庫』がある。実質、事業をタダ同然で手に入れている。」",
    inputHints: ["時価総額に織り込まれていない資産の把握", "実質EVの水準"],
    monitoringJa: "実質株価（株価 − キャッシュ/資産ベース）の推移",
  },
  Cyclical: {
    icon: "🌊",
    drivers: ["在庫調整", "コスト削減"],
    storyTemplate:
      "「不況サイクルの底を打ち、在庫の目詰まりが解消された。需要回復と工場稼働率の上昇により、収益は垂直立ち上げを果たす。」",
    inputHints: ["在庫サイクルの位置", "工場稼働率と需要の回復"],
    monitoringJa: "在庫 / 売上高（Inventory to Sales）の改善が見えるか？",
  },
  SlowGrower: {
    icon: "🐢",
    drivers: ["コスト削減", "安定配当"],
    storyTemplate:
      "「成長は緩やかだが、圧倒的なキャッシュ創出力で減配なしの増配を継続。余剰資金は自社株買いに回り、EPSを底上げする。」",
    inputHints: ["減配リスク", "自社株買いとEPS"],
    monitoringJa: "配当性向の健全性と自社株買いの継続性",
  },
};

export type LynchStoryTemplateResolved = LynchStoryMatrixEntry & {
  key: LynchCategory;
  labelJa: string;
};

export function lynchStoryTemplateFor(category: LynchCategory): LynchStoryTemplateResolved {
  return {
    key: category,
    labelJa: LYNCH_CATEGORY_LABEL_JA[category],
    ...ENTRIES[category],
  };
}
