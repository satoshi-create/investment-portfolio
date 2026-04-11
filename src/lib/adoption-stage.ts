/**
 * 技術普及ロジャーズの曲線に沿った観測ラベル（DB `theme_ecosystem_members.adoption_stage`）。
 */
import type { AdoptionStage } from "@/src/types/investment";

const VALID: ReadonlySet<string> = new Set([
  "innovator",
  "early_adopter",
  "chasm",
  "early_majority",
  "late_majority",
]);

/** 集計用 1–5（高いほど普及が進んだ想定） */
export function adoptionStageRank(s: AdoptionStage | null | undefined): number | null {
  if (s == null) return null;
  switch (s) {
    case "innovator":
      return 1;
    case "early_adopter":
      return 2;
    case "chasm":
      return 3;
    case "early_majority":
      return 4;
    case "late_majority":
      return 5;
    default:
      return null;
  }
}

export function parseAdoptionStage(raw: unknown): AdoptionStage | null {
  if (raw == null) return null;
  const t = String(raw).trim().toLowerCase();
  return VALID.has(t) ? (t as AdoptionStage) : null;
}

export function isPostChasmStage(s: AdoptionStage | null | undefined): boolean {
  return s === "early_majority" || s === "late_majority";
}

export type AdoptionStageMeta = {
  labelJa: string;
  icon: string;
  /** 根拠なしのときの短文 */
  defaultRationaleJa: string;
};

export const ADOPTION_STAGE_META: Record<AdoptionStage, AdoptionStageMeta> = {
  innovator: {
    labelJa: "イノベーター",
    icon: "🚀",
    defaultRationaleJa: "実験室・極初期。実用化前の技術ショックが多く、失敗も含めイベント性が強い段階。",
  },
  early_adopter: {
    labelJa: "アーリーアダプター",
    icon: "🔥",
    defaultRationaleJa: "先駆ユーザーが意思決定し、プロトタイプが実利用に乗り始める。期待先行で価格が敏感。",
  },
  chasm: {
    labelJa: "キャズム",
    icon: "🌊",
    defaultRationaleJa: "主流市場への橋が未確立。規模・標準・チャネルが壁になり、勝ち残りが選別される峡谷。",
  },
  early_majority: {
    labelJa: "アーリーマジョリティ",
    icon: "🏗️",
    defaultRationaleJa: "実用と信頼が積み上がり、供給チェーンが厚くなる。ボラティリティは相対的に下がりやすい。",
  },
  late_majority: {
    labelJa: "レイトマジョリティ",
    icon: "📈",
    defaultRationaleJa: "標準化・コモディティ化が進み、成長は鈍化しつつ収益は安定しやすい。",
  },
};

export function adoptionStageTooltip(
  stage: AdoptionStage | null,
  rationale: string | null | undefined,
  observationNotes: string | null | undefined,
): string {
  if (stage == null) {
    const obs = observationNotes?.trim();
    return obs && obs.length > 0 ? obs : "普及段階は未設定です（DB の adoption_stage を設定するとメーター表示されます）。";
  }
  const m = ADOPTION_STAGE_META[stage];
  const custom = rationale?.trim();
  const obs = observationNotes?.trim();
  const body = custom && custom.length > 0 ? custom : obs && obs.length > 0 ? obs : m.defaultRationaleJa;
  return `${m.icon} ${m.labelJa}（${stage}）\n\n${body}`;
}

/** テーマ内の設定済みステージから代表メッセージを生成 */
export function summarizeThemeAdoptionMaturity(
  stages: (AdoptionStage | null | undefined)[],
): { headline: string; detail: string; avgRank: number | null } {
  const ranks = stages.map((s) => adoptionStageRank(s ?? null)).filter((r): r is number => r != null);
  if (ranks.length === 0) {
    return {
      headline: "普及段階は未設定です",
      detail: "エコシステム銘柄に adoption_stage を設定すると、テーマ全体の成熟度を推定できます。",
      avgRank: null,
    };
  }
  const avg = ranks.reduce((a, b) => a + b, 0) / ranks.length;
  let headline: string;
  if (avg < 1.75) headline = "イノベーター〜実験寄りのテーマです";
  else if (avg < 2.75) headline = "アーリーアダプター帯 — 期待と検証が交差するフェーズです";
  else if (avg < 3.75) headline = "このテーマは現在キャズムの真っ只中にいます";
  else if (avg < 4.75) headline = "キャズムを越え、主流採用が進むフェーズです";
  else headline = "レイトマジョリティ寄り — 普及は進み、収益の安定性が相対的に高い帯です";

  const detail = `観測 ${ranks.length} 銘柄の平均ステージ指数 ${avg.toFixed(2)} / 5.0（イノベーター=1 … レイトマジョリティ=5）。日次 Alpha のボラティリティは、峡谷帯でイベント感応が強くなりやすい傾向があります。`;
  return { headline, detail, avgRank: avg };
}
