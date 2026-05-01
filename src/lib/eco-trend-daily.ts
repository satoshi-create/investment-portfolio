import {
  alphaMagnitudeBadgeFromCumulativeHistory,
  buildFiveDayPulseDailyAlpha,
  calculateAlphaAcceleration,
} from "@/src/lib/alpha-logic";
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

/** テーマ API JSON から観測日（YYYY-MM-DD）配列を復元（camelCase / snake_case 双方） */
export function parseAlphaObservationDatesJson(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const x of raw) {
    const s = typeof x === "string" ? x.trim() : String(x).trim();
    if (s.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(s)) out.push(s.slice(0, 10));
  }
  return out;
}

/**
 * エコウォッチ 1 行の**純粋な日次** Alpha %（古い→新しい）。`alphaDailyHistory` があればそれを採用し、
 * 空なら累積 `alphaHistory` の隣接差分。`fiveDayPulseForEcosystem` の入力ベース。
 */
export function ecosystemRawDailyAlphaOldestToNewest(e: ThemeEcosystemWatchItem): number[] {
  if (Array.isArray(e.alphaDailyHistory) && e.alphaDailyHistory.length > 0) {
    return e.alphaDailyHistory.filter((x): x is number => Number.isFinite(x));
  }
  const cum = e.alphaHistory;
  if (!Array.isArray(cum) || cum.length < 2) return [];
  const base: number[] = [];
  for (let i = 1; i < cum.length; i += 1) {
    const d = cum[i]! - cum[i - 1]!;
    if (Number.isFinite(d)) base.push(d);
  }
  return base;
}

/**
 * 5D ミニバー用: 日次系列の構築 ＋ 本日暫定 Alpha。`alphaDailyHistory` 優先、
 * 空のときは累積 `alphaHistory` から隣接差分。
 */
export function fiveDayPulseForEcosystem(e: ThemeEcosystemWatchItem): { series: number[]; hasIntradayPulse: boolean } {
  const base = ecosystemRawDailyAlphaOldestToNewest(e);
  if (base.length === 0) {
    return { series: [], hasIntradayPulse: false };
  }
  return buildFiveDayPulseDailyAlpha({
    dailyAlphaHistory: base,
    latestAlphaObservationYmd: e.latestDailyAlphaObservationYmd,
    priceSource: e.priceSource,
    livePrice: e.currentPrice,
    previousClose: e.previousClose,
    benchmarkDayChangePercent: e.benchmarkDayChangePercent,
  });
}

/**
 * 「5D」列セル用: Pulse 後の `series`（チャートと同一）で複利点火を判定し、αM ラベルを付与。
 * 点火の日次入力はミニチャート表示と揃える（ライブ暫定を含み得る）。
 */
export function ecosystemFiveDayTrendCellModel(e: ThemeEcosystemWatchItem): {
  series: number[];
  hasIntradayPulse: boolean;
  isCompoundingIgnited: boolean;
  alphaMagnitudeLabel: string;
} {
  const { series, hasIntradayPulse } = fiveDayPulseForEcosystem(e);
  const accel = calculateAlphaAcceleration({
    dailyAlphaOldestToNewest: series,
    cumulativeAlphaOldestToNewest: e.alphaHistory,
  });
  return {
    series,
    hasIntradayPulse,
    isCompoundingIgnited: accel.isCompoundingIgnited,
    alphaMagnitudeLabel: alphaMagnitudeBadgeFromCumulativeHistory(e.alphaHistory).label,
  };
}

export function dailyAlphaSeriesForMiniTrend(e: ThemeEcosystemWatchItem): number[] {
  return fiveDayPulseForEcosystem(e).series;
}

/** ウォッチリストの 5D 列ソート: パルス系列の最終点（本日ライブを含み得る） */
export function lastDailyAlphaForTrendSort(e: ThemeEcosystemWatchItem): number | null {
  const s = fiveDayPulseForEcosystem(e).series;
  if (s.length === 0) return null;
  const v = s[s.length - 1]!;
  return Number.isFinite(v) ? v : null;
}
