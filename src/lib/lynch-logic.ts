import { computeTotalReturnYieldRatio } from "@/src/lib/judgment-logic";
import { resolveStockPegRatio } from "@/src/lib/alpha-logic";
import type { LynchCategory } from "@/src/types/investment";

/**
 * 複数ルールが重なるときの優先順位（先にマッチしたものを採用）。
 * Turnaround は損益の符号転換として最優先。次に高成長・優良・低成長配当株を見てから、
 * セクター由来の Cyclical、最後にバランスシート寄りの AssetPlay。
 */
const SUGGEST_PRIORITY: readonly LynchCategory[] = [
  "Turnaround",
  "FastGrower",
  "Stalwart",
  "SlowGrower",
  "Cyclical",
  "AssetPlay",
];

export type LynchScoreBand = "ELITE" | "NEUTRAL" | "GRAY";

/** `Stock` / `EquityResearchSnapshot` 拡張からマッピング可能な最小入力。 */
export type LynchSuggestInput = {
  forwardPe: number | null;
  trailingPe: number | null;
  trailingEps: number | null;
  forwardEps: number | null;
  /** 予想 EPS 成長率（小数 0.15 = 15%） */
  expectedGrowth: number | null;
  /** 配当利回り %（例 2.5） */
  dividendYieldPercent: number | null;
  /** 売上成長率 %（`Stock.revenueGrowth` / Yahoo `financialData.revenueGrowth` 由来） */
  revenueGrowthPercent: number | null;
  /** 時価総額（USD 想定・Yahoo marketCap と同スケール） */
  marketCapUsd: number | null;
  /** セクター名（Yahoo assetProfile / summaryProfile 等） */
  sectorLabel: string | null;
  /** ネットキャッシュ（時価と同通貨・同スケール推奨） */
  netCashUsd: number | null;
  /** PBR。未取得のときは null（AssetPlay の PBR 条件はスキップ）。 */
  priceToBook: number | null;
};

function inRangeInclusive(n: number, lo: number, hi: number): boolean {
  return Number.isFinite(n) && n >= lo && n <= hi;
}

function epsGrowthDecimal(g: number | null): number | null {
  if (g == null || !Number.isFinite(g)) return null;
  return g;
}

function isTurnaround(input: LynchSuggestInput): boolean {
  const t = input.trailingEps;
  const f = input.forwardEps;
  if (t == null || f == null || !Number.isFinite(t) || !Number.isFinite(f)) return false;
  return t < 0 && f > 0;
}

function isFastGrower(input: LynchSuggestInput): boolean {
  const g = epsGrowthDecimal(input.expectedGrowth);
  const rev = input.revenueGrowthPercent;
  const epsInLynchBand = g != null && inRangeInclusive(g, 0.2, 0.3);
  const epsHigh = g != null && g > 0.3;
  const revHigh = rev != null && Number.isFinite(rev) && rev >= 20;
  return epsInLynchBand || epsHigh || revHigh;
}

function isStalwart(input: LynchSuggestInput): boolean {
  const m = input.marketCapUsd;
  const g = epsGrowthDecimal(input.expectedGrowth);
  if (m == null || !Number.isFinite(m) || m < 100e9) return false;
  if (g == null || !Number.isFinite(g)) return false;
  return inRangeInclusive(g, 0.1, 0.15);
}

function isSlowGrower(input: LynchSuggestInput): boolean {
  const g = epsGrowthDecimal(input.expectedGrowth);
  const rev = input.revenueGrowthPercent;
  const div = input.dividendYieldPercent;
  if (div == null || !Number.isFinite(div) || div < 3) return false;
  const growthPct =
    g != null && Number.isFinite(g) ? g * 100 : rev != null && Number.isFinite(rev) ? rev : null;
  if (growthPct == null || !Number.isFinite(growthPct)) return false;
  return growthPct < 5;
}

function normalizeSectorToken(raw: string | null | undefined): string {
  if (raw == null) return "";
  return raw.trim().toLowerCase();
}

/** Auto / Steel / Energy / Semiconductor 系を Cyclical とみなす。 */
export function isCyclicalSectorLabel(sectorLabel: string | null | undefined): boolean {
  const s = normalizeSectorToken(sectorLabel);
  if (s.length === 0) return false;
  const tokens = [
    "auto",
    "automobile",
    "automotive",
    "vehicles",
    "steel",
    "energy",
    "oil",
    "gas",
    "semiconductor",
    "semiconductors",
  ];
  return tokens.some((t) => s.includes(t));
}

function isAssetPlay(input: LynchSuggestInput): boolean {
  const pbr = input.priceToBook;
  if (pbr != null && Number.isFinite(pbr) && pbr > 0 && pbr < 0.8) return true;
  const nc = input.netCashUsd;
  const mc = input.marketCapUsd;
  if (nc == null || mc == null || !Number.isFinite(nc) || !Number.isFinite(mc) || mc <= 0) return false;
  return nc / mc > 0.3;
}

const RULE_TESTERS: Record<
  LynchCategory,
  (input: LynchSuggestInput) => boolean
> = {
  Turnaround: isTurnaround,
  FastGrower: isFastGrower,
  Stalwart: isStalwart,
  SlowGrower: isSlowGrower,
  Cyclical: (i) => isCyclicalSectorLabel(i.sectorLabel),
  AssetPlay: isAssetPlay,
};

export function suggestLynchCategory(input: LynchSuggestInput): LynchCategory {
  for (const cat of SUGGEST_PRIORITY) {
    const fn = RULE_TESTERS[cat];
    if (fn != null && fn(input)) return cat;
  }
  return "Stalwart";
}

/**
 * `(予想EPS成長率% + 配当利回り%) / PER` — `computeTotalReturnYieldRatio` と同一の次元。
 * 成長率が取れない・≤0 のときは null（judgment-logic に寄せる）。
 */
export function calculateLynchScore(input: {
  forwardPe: number | null;
  trailingPe: number | null;
  expectedGrowth: number | null;
  dividendYieldPercent: number | null;
}): number | null {
  return computeTotalReturnYieldRatio({
    forwardPe: input.forwardPe,
    trailingPe: input.trailingPe,
    expectedGrowthDecimal: input.expectedGrowth,
    dividendYieldPercent: input.dividendYieldPercent,
  });
}

export function lynchScoreBand(score: number | null): LynchScoreBand {
  if (score == null || !Number.isFinite(score)) return "GRAY";
  if (score >= 2) return "ELITE";
  if (score < 1) return "GRAY";
  return "NEUTRAL";
}

export function lynchPegForDisplay(input: {
  forwardPe: number | null;
  trailingPe: number | null;
  expectedGrowth: number | null;
  dividendYieldPercent: number | null;
  yahooPegRatio: number | null;
}): number | null {
  return resolveStockPegRatio({
    forwardPe: input.forwardPe,
    trailingPe: input.trailingPe,
    expectedGrowthDecimal: input.expectedGrowth,
    yahooPegRatio: input.yahooPegRatio,
  });
}
