import type { ThemeEcosystemWatchItem } from "@/src/types/investment";

/** テーマ API JSON から `alphaDailyHistory`（または snake_case）を復元 */
export function parseAlphaDailyHistoryJson(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const out: number[] = [];
  for (const x of raw) {
    const n = typeof x === "number" ? x : Number(x);
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

/**
 * 5D ミニバー用の日次 Alpha 系列。`alphaDailyHistory` を優先し、
 * 古い API 応答のため空のときは累積 `alphaHistory` から隣接差分を取る。
 */
export function dailyAlphaSeriesForMiniTrend(e: ThemeEcosystemWatchItem): number[] {
  if (Array.isArray(e.alphaDailyHistory) && e.alphaDailyHistory.length > 0) {
    return e.alphaDailyHistory;
  }
  const cum = e.alphaHistory;
  if (!Array.isArray(cum) || cum.length < 2) return [];
  const out: number[] = [];
  for (let i = 1; i < cum.length; i += 1) {
    out.push(cum[i]! - cum[i - 1]!);
  }
  return out;
}
