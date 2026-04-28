import type { LynchCategory } from "@/src/types/investment";

/**
 * `getLynchCategory === null` のときの診断モード用。
 * `getLynchCategoryFromInput`（自動判定）とは別の、ユーザー主観ベースのレンズ提案。
 */

/** 「成長の質」鑑定ラジオの値（案 A） */
export type GrowthQualityAnswer =
  | ""
  | "scale_growth"
  | "steady_quality"
  | "macro_cycle"
  | "hidden_value"
  | "reset_story"
  | "cash_yield";

export const GROWTH_QUALITY_OPTIONS: readonly {
  id: GrowthQualityAnswer;
  label: string;
  hint: string;
}[] = [
  {
    id: "scale_growth",
    label: "スケール型",
    hint: "売上・利益が高成長で、まだ伸びしろが大きい",
  },
  {
    id: "steady_quality",
    label: "優良コンパウンド",
    hint: "大型～中堅で実績が安定し、継続的に積み上がる",
  },
  {
    id: "macro_cycle",
    label: "サイクル・業況依存",
    hint: "景気・在庫・商品サイクルで業績が大きく振れる",
  },
  {
    id: "hidden_value",
    label: "バランスシート・含み",
    hint: "資産・キャッシュ・子会社など時価に織り込まれにくい価値が核",
  },
  {
    id: "reset_story",
    label: "リストラ・立て直し",
    hint: "赤字部門整理・財務改善・業績反転がテーマ",
  },
  {
    id: "cash_yield",
    label: "キャッシュ・還流型",
    hint: "成長は緩やかだがFCF・配当・自社株買いが厚い",
  },
];

/** 汎用 5 パッチ（分類横断・監視ログ起点用のキー） */
export const UNIVERSAL_FIVE_PATCHES: readonly { id: string; label: string }[] = [
  { id: "pricing_power", label: "価格決定権・単価改善" },
  { id: "scale_share", label: "規模・シェア・ネットワーク拡大" },
  { id: "new_engine", label: "新市場・新製品・新収益源" },
  { id: "cost_efficiency", label: "コスト・効率・組織改革" },
  { id: "balance_sheet_capital", label: "貸借対照表・資本効率・還流" },
];

/** リンチ「調べておくべきこと」（90秒ルール）に近い短文問い — プレースホルダローテーション用 */
export const LYNCH_90S_RULE_PLACEHOLDERS: readonly string[] = [
  "この会社の強みは物理（設備・資産・立地）か、論理（ブランド・データ・規模の経済）か？",
  "収益が増える主因は「量が売れる」ことか「単価・ミックス」か？",
  "競争優位は 5 年後も持続すると言えるか？ 何が壊すか？",
  "利益の変動は景気・在庫サイクルか、シェア・新製品か？",
  "時価は業績と比べて過小か過大か？ その根拠は？",
  "ネットキャッシュ・有利子負債は健全か？ 資本政策のリスクは？",
  "当面の業績ドライバーは何か？（地域・製品・値上げ・コストなど）",
];

/**
 * 鑑定ラジオの選択からおすすめリンチ分類を返す（null は未選択時のみ）。
 */
export function suggestCategoryFromDiagnostic(answer: GrowthQualityAnswer): LynchCategory | null {
  switch (answer) {
    case "scale_growth":
      return "FastGrower";
    case "steady_quality":
      return "Stalwart";
    case "macro_cycle":
      return "Cyclical";
    case "hidden_value":
      return "AssetPlay";
    case "reset_story":
      return "Turnaround";
    case "cash_yield":
      return "SlowGrower";
    default:
      return null;
  }
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * 診断入力と汎用パッチ選択から物語エリアのプレースホルダを決定（決定的）。
 */
export function pickUnclassifiedStoryPlaceholder(
  growthQuality: GrowthQualityAnswer | "",
  universalPatchIds: readonly string[],
): string {
  const patchKey = [...universalPatchIds].sort().join("|");
  const seed = hashString(`${growthQuality}:${patchKey}`);
  const qs = LYNCH_90S_RULE_PLACEHOLDERS;
  return qs[seed % qs.length]!;
}
