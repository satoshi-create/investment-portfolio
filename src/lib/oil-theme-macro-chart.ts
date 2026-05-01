/**
 * 「非石油文明」「石油文明」テーマ用: WTI 近月（CL=F）とテーマ構造トレンド（年輪）の並置・相関。
 * 定義は docs/oil-theme-macro-context.md を参照。
 */

import {
  dailyReturnPercent,
  roundAlphaMetric,
  THEME_STRUCTURAL_TREND_LOOKBACK_DAYS,
} from "@/src/lib/alpha-logic";
import type { PriceBar } from "@/src/lib/price-service";
import type { CumulativeAlphaPoint, OilThemeMacroChartData, OilThemeMacroChartPoint } from "@/src/types/investment";

/** `fetchPriceHistory` に渡す暦日窓（十分な営業日を確保） */
export const OIL_THEME_CL_HISTORY_DAYS = 150;

/** Pearson を返すための最低ペア数（日次リターンのペア） */
export const OIL_THEME_CORRELATION_MIN_PAIRS = 12;

function barsAsc(bars: PriceBar[]): PriceBar[] {
  return [...bars].sort((a, b) => a.date.localeCompare(b.date));
}

function closeOnDate(barsAsc: PriceBar[], ymd: string): number | null {
  const b = barsAsc.find((x) => x.date === ymd);
  if (b == null || !Number.isFinite(b.close) || b.close <= 0) return null;
  return b.close;
}

/**
 * Pearson 積率相関（母標本）。欠損は呼び出し側で揃える。
 */
export function pearsonCorrelation(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < OIL_THEME_CORRELATION_MIN_PAIRS) return null;
  const n = xs.length;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i++) {
    sx += xs[i]!;
    sy += ys[i]!;
  }
  const mx = sx / n;
  const my = sy / n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - mx;
    const dy = ys[i]! - my;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  const den = Math.sqrt(sxx * syy);
  if (den < 1e-14) return null;
  return sxy / den;
}

/**
 * WTI（CL=F）の正規化累積%と `themeStructuralTrendSeries`（累積%）を同一日付軸で並べ、
 * 隣接日同士の (WTI 日次%, テーマ日次加重 Alpha %) の Pearson を算出する。
 */
export function buildOilThemeMacroChartData(
  themeTrend: CumulativeAlphaPoint[],
  clBars: PriceBar[],
): OilThemeMacroChartData | null {
  const trend = [...themeTrend].sort((a, b) => a.date.localeCompare(b.date));
  const bars = barsAsc(clBars);
  if (trend.length < 2 || bars.length < 2) return null;

  const anchorClose = closeOnDate(bars, trend[0]!.date);
  if (anchorClose == null || anchorClose <= 0) return null;

  const points: OilThemeMacroChartPoint[] = [];
  for (const p of trend) {
    const c = closeOnDate(bars, p.date);
    if (c == null || c <= 0) {
      points.push({
        date: p.date,
        wtiNormCumulativePct: null,
        themeTrendCumulativePct: roundAlphaMetric(p.cumulative),
      });
    } else {
      points.push({
        date: p.date,
        wtiNormCumulativePct: roundAlphaMetric((c / anchorClose - 1) * 100),
        themeTrendCumulativePct: roundAlphaMetric(p.cumulative),
      });
    }
  }

  const rx: number[] = [];
  const ry: number[] = [];
  for (let i = 1; i < trend.length; i++) {
    const d0 = trend[i - 1]!.date;
    const d1 = trend[i]!.date;
    const c0 = closeOnDate(bars, d0);
    const c1 = closeOnDate(bars, d1);
    if (c0 == null || c1 == null || c0 <= 0 || c1 <= 0) continue;
    const rWti = dailyReturnPercent(c0, c1);
    if (rWti == null || !Number.isFinite(rWti)) continue;
    const dTheme = trend[i]!.cumulative - trend[i - 1]!.cumulative;
    if (!Number.isFinite(dTheme)) continue;
    rx.push(rWti);
    ry.push(dTheme);
  }

  const wtiVsThemeTrendCorrelation = pearsonCorrelation(rx, ry);
  return {
    points,
    wtiVsThemeTrendCorrelation,
    correlationPairCount: rx.length,
    correlationWindowDays: THEME_STRUCTURAL_TREND_LOOKBACK_DAYS,
  };
}
