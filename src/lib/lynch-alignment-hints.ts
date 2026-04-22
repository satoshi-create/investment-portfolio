import type { LynchCategory } from "@/src/types/investment";

export type LynchHintInput = {
  lynchCategory: LynchCategory | null;
  /** Yahoo 予想EPS成長率（小数 0.15 = 15%） */
  expectedGrowth: number | null;
  trailingPe: number | null;
  forwardPe: number | null;
  dividendYieldPercent: number | null;
};

function pePick(s: LynchHintInput): number | null {
  const v = s.trailingPe ?? s.forwardPe ?? null;
  return v != null && Number.isFinite(v) && v > 0 ? v : null;
}

function growthPctDecimal(s: LynchHintInput): number | null {
  const g = s.expectedGrowth;
  if (g == null || !Number.isFinite(g)) return null;
  return g * 100;
}

/** 分類と主要指標のズレを短い文言で返す（最大2件・自動分類ではない）。 */
export function lynchAlignmentHintLines(input: LynchHintInput): string[] {
  const cat = input.lynchCategory;
  if (cat == null) return [];
  const g = growthPctDecimal(input);
  const pe = pePick(input);
  const hints: string[] = [];

  if (cat === "SlowGrower") {
    if (g != null && g > 7) {
      hints.push("成長率が低成長株の目安（年3〜5%）より高めです。分類の前提を確認してください。");
    }
    if (input.dividendYieldPercent != null && input.dividendYieldPercent < 1.5) {
      hints.push("配当利回りが低めです。増配・配当性向のストーリーを確認してください。");
    }
    if (pe != null && pe > 24) {
      hints.push("PERが低めの目安に比べて高めです（銘柄により異なります）。");
    }
  }
  if (cat === "Stalwart") {
    if (g != null && g > 18) {
      hints.push("成長率が優良株の目安より高めです。急成長寄りでないか確認してください。");
    }
    if (g != null && g > 0 && g < 6) {
      hints.push("成長率が優良株の目安（年10〜12%前後）より低めです。");
    }
    if (pe != null && pe > 38) {
      hints.push("PERが高めです。妥当性・利益の薄まりリスクを確認してください。");
    }
  }
  if (cat === "FastGrower") {
    if (g != null && g > 0 && g < 15) {
      hints.push("予想成長が急成長の目安（年20〜25%前後）より低めです。");
    }
    if (pe != null && pe > 0 && pe < 14) {
      hints.push("PERが急成長株では相対的に低めです。見通しと整合するか確認してください。");
    }
  }
  if (cat === "AssetPlay") {
    if (g != null && g > 15) {
      hints.push("成長率が高めです。本業成長と資産プレイのどちらを主に見ているか整理してください。");
    }
  }
  if (cat === "Cyclical") {
    if (pe != null && pe > 35) {
      hints.push("PERが高めです。業界サイクル上の位置と整合するか確認してください。");
    }
  }
  if (cat === "Turnaround") {
    if (g != null && g > 20) {
      hints.push("予想成長が高めです。業績回復途上との整合を確認してください。");
    }
  }

  return hints.slice(0, 2);
}
