/**
 * Single source of truth for Alpha (relative performance vs benchmark) interpretation.
 * Spec: no FX — compare local-currency daily returns directly (returns / Alpha %).
 *
 * For **portfolio valuation weights** (dashboard), pass a live `usdJpyRate` from `price-service` (`JPY=X`).
 */

import { DEFAULT_BENCHMARK_BY_INSTRUMENT_KIND, type TickerInstrumentKind } from "@/src/types/investment";

/** Benchmark ticker persisted in `alpha_history` / used by signal rules (must exist in `benchmarks`). */
export const SIGNAL_BENCHMARK_TICKER = "VOO";

/**
 * Explicit fallback benchmark ticker (keep stable for legacy paths).
 * NOTE: Do not remove — some callers intentionally omit benchmark selection.
 */
export const DEFAULT_BENCHMARK_TICKER = "VOO";

export type QuoteCurrency = "JPY" | "USD";

/**
 * Convert a nominal amount in `currency` to Japanese yen (identity for JPY).
 * For USD, `usdJpyRate` must be a positive finite number (callers supply API rate or `USD_JPY_RATE_FALLBACK` from `fx-constants`).
 */
export function convertValueToJpy(value: number, currency: QuoteCurrency, usdJpyRate: number): number {
  if (!Number.isFinite(value)) return 0;
  if (currency === "JPY") return value;
  if (!Number.isFinite(usdJpyRate) || usdJpyRate <= 0) return 0;
  return value * usdJpyRate;
}

const DIGITS_ONLY = /^\d+$/;

/** TSE 4–5 桁コードは `theme_ecosystem_members` 等で頻出。6 桁以上は投信コード寄りとして分離。 */
export function classifyTickerInstrument(ticker: string): TickerInstrumentKind {
  const t = ticker.trim();
  if (t.length === 0) return "US_EQUITY";
  const upper = t.toUpperCase();
  if (upper.endsWith(".T")) return "JP_LISTED_EQUITY";
  if (DIGITS_ONLY.test(t)) {
    const len = t.length;
    if (len >= 6) return "JP_INVESTMENT_TRUST";
    if (len >= 4 && len <= 5) return "JP_LISTED_EQUITY";
    return "US_EQUITY";
  }
  return "US_EQUITY";
}

export function defaultBenchmarkTickerForInstrumentKind(kind: TickerInstrumentKind): string {
  return DEFAULT_BENCHMARK_BY_INSTRUMENT_KIND[kind] ?? DEFAULT_BENCHMARK_TICKER;
}

export function defaultBenchmarkTickerForTicker(ticker: string): string {
  return defaultBenchmarkTickerForInstrumentKind(classifyTickerInstrument(ticker));
}

/**
 * Currency for dashboard market value: 日本株・投信 → JPY、米株 → USD×為替。
 * 指数連動のスケールずれは `valuation_factor` で調整（ティッカーが数字でも provider が ^ でも円レートは乗せない）。
 */
export function quoteCurrencyForDashboardWeights(ticker: string): QuoteCurrency {
  return classifyTickerInstrument(ticker) === "US_EQUITY" ? "USD" : "JPY";
}

/**
 * Daily return (%): ((close_t - close_{t-1}) / close_{t-1}) * 100
 * Returns null if previous close is missing or non-positive.
 */
export function dailyReturnPercent(prevClose: number, todayClose: number): number | null {
  if (!Number.isFinite(prevClose) || !Number.isFinite(todayClose) || prevClose <= 0) {
    return null;
  }
  return ((todayClose - prevClose) / prevClose) * 100;
}

/** Round to 2 decimal places (Alpha and aligned metrics). */
export function roundAlphaMetric(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Alpha = stockReturn% - benchmarkReturn%. Null if either input is null.
 * Output rounded to 2 decimals.
 */
export function computeAlphaPercent(
  stockReturnPercent: number | null,
  benchmarkReturnPercent: number | null,
): number | null {
  if (stockReturnPercent === null || benchmarkReturnPercent === null) return null;
  return roundAlphaMetric(stockReturnPercent - benchmarkReturnPercent);
}

/** `alpha_history` 等から渡す 1 日分の超過リターン（Ticker% − Bench%）。 */
export type DatedAlphaRow = {
  /** `recorded_at`（YYYY-MM-DD または ISO。先頭 10 文字を日付として扱う） */
  recordedAt: string;
  alphaValue: number;
};

/** `recorded_at` / ISO 文字列から YYYY-MM-DD を取り出す（短い文字列はそのまま返す）。 */
export function toYmd(recordedAt: string): string {
  const t = recordedAt.trim();
  return t.length >= 10 ? t.slice(0, 10) : t;
}

/** UTC 暦日の YYYY-MM-DD（サーバー基準の「今日」）。 */
export function utcTodayYmd(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 暦日 `ymd` から `deltaDays` 日だけずらした YYYY-MM-DD（UTC 正午基準）。 */
export function ymdAddDays(ymd: string, deltaDays: number): string {
  const base = ymd.trim().slice(0, 10);
  if (base.length !== 10) return base;
  const t = new Date(`${base}T12:00:00Z`).getTime();
  if (!Number.isFinite(t)) return base;
  const d = new Date(t + deltaDays * 86_400_000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** テーマ構造トレンド等で用いる、直近 N 暦日の起点日（今日から N 日前、UTC）。 */
export function ymdDaysAgoUtc(days: number): string {
  return ymdAddDays(utcTodayYmd(), -Math.max(0, Math.floor(days)));
}

/** テーマ全体の加重累積 Alpha を「直近何日」で切るか（テーマ詳細の年輪トレンド用）。 */
export const THEME_STRUCTURAL_TREND_LOOKBACK_DAYS = 90;

/**
 * テーマ設定日（または任意の起点）に最も近い観測日をアンカーとし、そこを累積 0 として
 * 以降の日次 Alpha（対ベンチマーク超過）を単純合算した累積系列を返す。
 * （厳密な相対リターンは (P/P0)/(B/B0)-1 だが、日次 Alpha の和で実装する。）
 */
export function calculateCumulativeAlpha(alphaRows: DatedAlphaRow[], startDate: string): { date: string; cumulative: number }[] {
  if (alphaRows.length === 0) return [];

  const sorted = [...alphaRows]
    .map((r) => ({
      ymd: toYmd(r.recordedAt),
      alpha: Number(r.alphaValue),
    }))
    .filter((r) => r.ymd.length === 10)
    .sort((a, b) => a.ymd.localeCompare(b.ymd));

  if (sorted.length === 0) return [];

  const startYmd = toYmd(startDate);
  const anchorTime =
    startYmd.length === 10 ? new Date(`${startYmd}T12:00:00Z`).getTime() : Number.NaN;

  let bestIdx = 0;
  if (Number.isFinite(anchorTime)) {
    let bestDist = Infinity;
    for (let i = 0; i < sorted.length; i++) {
      const t = new Date(`${sorted[i]!.ymd}T12:00:00Z`).getTime();
      const d = Math.abs(t - anchorTime);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
  }

  const out: { date: string; cumulative: number }[] = [];
  out.push({ date: sorted[bestIdx]!.ymd, cumulative: 0 });

  let cum = 0;
  for (let i = bestIdx + 1; i < sorted.length; i++) {
    const a = sorted[i]!.alpha;
    cum += Number.isFinite(a) ? a : 0;
    out.push({ date: sorted[i]!.ymd, cumulative: roundAlphaMetric(cum) });
  }

  return out;
}

/**
 * テーマ内複数銘柄の累積 Alpha 系列を、評価額ウェイトで加重平均（各日はデータがある銘柄のみでウェイト再正規化）。
 */
export function mergeWeightedCumulativeAlphaSeries(
  inputs: { weight: number; series: { date: string; cumulative: number }[] }[],
): { date: string; cumulative: number }[] {
  if (inputs.length === 0) return [];

  const positive = inputs.filter((x) => x.series.length > 0);
  if (positive.length === 0) return [];

  const totalW = positive.reduce((s, x) => s + (x.weight > 0 ? x.weight : 0), 0);
  const weighted = positive.map((x) => ({
    w: totalW > 0 ? x.weight / totalW : 1 / positive.length,
    series: x.series,
  }));

  const dateSet = new Set<string>();
  for (const { series } of weighted) {
    for (const p of series) dateSet.add(p.date);
  }
  const dates = [...dateSet].sort();

  function cumAtOrBefore(series: { date: string; cumulative: number }[], ymd: string): number | null {
    let last: number | null = null;
    for (const p of series) {
      if (p.date <= ymd) last = p.cumulative;
      else break;
    }
    return last;
  }

  const out: { date: string; cumulative: number }[] = [];
  for (const d of dates) {
    let sum = 0;
    let wsum = 0;
    for (const { w, series } of weighted) {
      const v = cumAtOrBefore(series, d);
      if (v !== null) {
        sum += w * v;
        wsum += w;
      }
    }
    if (wsum > 0) {
      out.push({ date: d, cumulative: roundAlphaMetric(sum / wsum) });
    }
  }
  return out;
}

/**
 * 直近の日次 Alpha が、直前までの最大 `windowSize` 日（当日除く）の平均・標準偏差から見て何 σ 外れているか。
 * 負が大きいほど「直近だけ市場期待が冷えている」状態。系列不足や分散 0 は null。
 */
export function computeAlphaDeviationZScore(dailyAlphasChronological: number[], windowSize = 30): number | null {
  if (dailyAlphasChronological.length < 3) return null;
  const maxWin = Math.max(3, Math.floor(windowSize));
  const win = dailyAlphasChronological.slice(-maxWin);
  if (win.length < 3) return null;
  const current = win[win.length - 1]!;
  const baseline = win.slice(0, -1);
  if (baseline.length < 2) return null;
  let sum = 0;
  for (const x of baseline) {
    if (!Number.isFinite(x)) return null;
    sum += x;
  }
  const mean = sum / baseline.length;
  let varAcc = 0;
  for (const x of baseline) {
    const d = x - mean;
    varAcc += d * d;
  }
  const variance = varAcc / (baseline.length - 1);
  const std = Math.sqrt(variance);
  if (!Number.isFinite(std) || std < 1e-9) return null;
  if (!Number.isFinite(current)) return null;
  return roundAlphaMetric((current - mean) / std);
}

/**
 * 直近 `lookback` 本の終値高値に対する現在価の乖離（%）。(現在/高値 - 1)×100。高値下では負。
 */
export function computePriceDrawdownFromHighPercent(
  closesChronological: (number | null | undefined)[],
  currentPrice: number | null | undefined,
  lookback = 90,
): number | null {
  if (currentPrice == null || !Number.isFinite(currentPrice) || currentPrice <= 0) return null;
  const lb = Math.max(1, Math.floor(lookback));
  const slice = closesChronological.slice(-lb);
  const valid = slice.filter((c): c is number => c != null && Number.isFinite(c) && c > 0);
  if (valid.length === 0) return null;
  const high = Math.max(...valid);
  if (!(high > 0)) return null;
  return roundAlphaMetric((currentPrice / high - 1) * 100);
}

export type OpportunityType = "DEEP_VALUE" | "STRUCTURAL_DIP";

/**
 * Detect "dip" opportunity type by combining statistical deviation (Z) and price drawdown.
 *
 * - Deep Value: Z < -1.5σ and drawdown > 20%
 * - Structural Dip: -0.5 < Z < +0.5 and drawdown > 30%
 *
 * Note: `drawdownFromHighPct` is negative below the high (e.g. -25 means -25% from the high).
 */
export function detectOpportunityType(input: {
  alphaDeviationZ: number | null | undefined;
  drawdownFromHighPct: number | null | undefined;
}): OpportunityType | null {
  const z = input.alphaDeviationZ;
  const dd = input.drawdownFromHighPct;
  if (z == null || dd == null) return null;
  if (!Number.isFinite(z) || !Number.isFinite(dd)) return null;

  // Drawdown is negative under the high; "drop rate > 20%" means dd <= -20.
  if (z < -1.5 && dd <= -20) return "DEEP_VALUE";
  if (z > -0.5 && z < 0.5 && dd <= -30) return "STRUCTURAL_DIP";
  return null;
}

/** 加重累積 Alpha 系列が直近で上向きか（終値 vs 数点手前）。 */
export function isCumulativeSeriesTrendUpward(
  series: { cumulative: number }[],
  lookbackPoints = 8,
): boolean {
  if (series.length < 2) return false;
  const last = series[series.length - 1]!.cumulative;
  const lb = Math.max(1, Math.floor(lookbackPoints));
  const idx = Math.max(0, series.length - 1 - lb);
  const prev = series[idx]!.cumulative;
  return Number.isFinite(last) && Number.isFinite(prev) && last > prev;
}

/**
 * テーマ詳細の ✨（割安採掘）条件用: 直近の加重累積 Alpha がプラス帯にあり、かつ右肩上がき。
 * （単なる上向きだけではなく、構造がベンチを上回る「年輪」を刻んでいることを要求）
 */
export function isThemeStructuralTrendPositiveUp(
  series: { cumulative: number }[],
  lookbackPoints = 8,
): boolean {
  if (series.length < 2) return false;
  const last = series[series.length - 1]!.cumulative;
  if (!Number.isFinite(last) || last <= 0) return false;
  const lb = Math.max(1, Math.floor(lookbackPoints));
  const idx = Math.max(0, series.length - 1 - lb);
  const prev = series[idx]!.cumulative;
  return Number.isFinite(prev) && last > prev;
}

/**
 * ===== Capital Flow Rotation Radar (RRG-like) =====
 *
 * We derive rotation coordinates from the Alpha series (daily excess return vs benchmark).
 * - RS-Ratio: "relative strength" index (centered at 100).
 * - RS-Momentum: short-term acceleration of RS-Ratio (also centered at 100).
 *
 * Notes:
 * - Alpha is already "relative" vs benchmark, so compounding is approximated by cumulative sum.
 * - This is intentionally light-weight and deterministic (no external I/O).
 */

export type RotationRadarPoint = {
  date: string; // YYYY-MM-DD
  rsRatio: number; // centered at 100
  rsMomentum: number; // centered at 100
};

export type RotationQuadrant = "LEADING" | "WEAKENING" | "LAGGING" | "IMPROVING";

export function rotationQuadrantOf(p: { rsRatio: number; rsMomentum: number }): RotationQuadrant {
  const x = Number.isFinite(p.rsRatio) ? p.rsRatio : 100;
  const y = Number.isFinite(p.rsMomentum) ? p.rsMomentum : 100;
  if (x >= 100 && y >= 100) return "LEADING";
  if (x >= 100 && y < 100) return "WEAKENING";
  if (x < 100 && y < 100) return "LAGGING";
  return "IMPROVING";
}

export type RotationRadarEvent = "HARVEST" | "NONLINEAR_BREAKOUT";

export function rotationEventsForTransition(prev: RotationQuadrant, next: RotationQuadrant): RotationRadarEvent[] {
  const out: RotationRadarEvent[] = [];
  if (prev === "LEADING" && next === "WEAKENING") out.push("HARVEST");
  if (prev === "IMPROVING" && next === "LEADING") out.push("NONLINEAR_BREAKOUT");
  return out;
}

/**
 * Compute rotation radar vectors (chronological).
 *
 * - `lookbackDays`: number of output points (default 20).
 * - `momentumLagDays`: lag used to estimate acceleration (default 5).
 *
 * Output is a vector of up to `lookbackDays` points (may be shorter if not enough history).
 */
export function computeRotationRadarVector(
  alphaRows: DatedAlphaRow[],
  options?: { lookbackDays?: number; momentumLagDays?: number },
): RotationRadarPoint[] {
  const lookbackDays = Math.max(6, Math.floor(options?.lookbackDays ?? 20));
  const momentumLagDays = Math.max(2, Math.floor(options?.momentumLagDays ?? 5));
  if (alphaRows.length === 0) return [];

  const sorted = [...alphaRows]
    .map((r) => ({ date: toYmd(r.recordedAt), alpha: Number(r.alphaValue) }))
    .filter((r) => r.date.length === 10)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (sorted.length < 3) return [];

  // Need enough points for momentum lag; keep a small buffer.
  const need = lookbackDays + momentumLagDays + 2;
  const slice = sorted.slice(-Math.min(sorted.length, need));
  if (slice.length < Math.max(lookbackDays, momentumLagDays + 3)) return [];

  // Anchor at the first point in slice so rsRatio is comparable within the vector.
  const anchor = slice[0]!.date;
  const cum = calculateCumulativeAlpha(
    slice.map((r) => ({ recordedAt: r.date, alphaValue: r.alpha })),
    anchor,
  );

  // Build rsRatio series around 100.
  const ratio: { date: string; v: number }[] = cum.map((p) => ({
    date: p.date,
    v: roundAlphaMetric(100 + (Number.isFinite(p.cumulative) ? p.cumulative : 0)),
  }));

  // Momentum as a lag-difference (also centered at 100).
  const byDate = new Map<string, number>();
  for (const r of ratio) byDate.set(r.date, r.v);

  const points: RotationRadarPoint[] = [];
  for (let i = 0; i < ratio.length; i++) {
    const cur = ratio[i]!;
    const lagIdx = i - momentumLagDays;
    const lag = lagIdx >= 0 ? ratio[lagIdx]!.v : cur.v;
    const delta = cur.v - lag;
    const mom = roundAlphaMetric(100 + delta);
    points.push({ date: cur.date, rsRatio: cur.v, rsMomentum: mom });
  }

  return points.slice(-lookbackDays);
}

/**
 * ===== ETF gravity logic =====
 *
 * ETFs are "structures" rather than individual companies.
 * The following functions are used by the Global Strata (ETF collection) dashboard.
 */

/**
 * Expense Ratio Drag (% points) for compounding.
 * - Input: `expenseRatioPercent` in percent (e.g. 0.03 for 0.03%).
 * - Output: estimated total drag in % over `years` (rounded to 2 decimals).
 *
 * Approx: \(1 - (1 - e)^{years}\) where \(e\) is annual fee as a decimal.
 */
export function computeExpenseRatioDragPercent(expenseRatioPercent: number, years = 1): number {
  const er = Number.isFinite(expenseRatioPercent) ? expenseRatioPercent : 0;
  const y = Math.max(0, Math.floor(Number.isFinite(years) ? years : 1));
  if (!(er > 0) || y === 0) return 0;
  const e = er / 100;
  if (!(e > 0) || e >= 1) return 100;
  const drag = (1 - Math.pow(1 - e, y)) * 100;
  return roundAlphaMetric(Number.isFinite(drag) ? drag : 0);
}

/**
 * Tracking Alpha for ETFs (structure extraction quality).
 *
 * Not "tracking error vs index" but "how purely this ETF captures the intended structure".
 * - `purityScore`: 0..1 (1 = pure)
 * - `liquidityScore`: 0..1 (1 = liquid / scalable)
 * - `expenseRatioPercent`: fee % (e.g. 0.03)
 *
 * Output is a signed score in % points (higher is better), rounded to 2 decimals.
 */
export function computeEtfTrackingAlphaPercent(input: {
  purityScore: number;
  liquidityScore?: number;
  expenseRatioPercent?: number;
  feeHorizonYears?: number;
}): number {
  const purity = Number.isFinite(input.purityScore) ? input.purityScore : 0;
  const liq = Number.isFinite(input.liquidityScore) ? input.liquidityScore! : 0.6;
  const fee = Number.isFinite(input.expenseRatioPercent) ? input.expenseRatioPercent! : 0;
  const feeYears = input.feeHorizonYears ?? 5;
  const feeDrag = computeExpenseRatioDragPercent(fee, feeYears);

  // 0..100 base score from purity + liquidity; subtract multi-year fee drag.
  const base = (Math.max(0, Math.min(1, purity)) * 70 + Math.max(0, Math.min(1, liq)) * 30);
  const out = base - feeDrag;
  return roundAlphaMetric(Number.isFinite(out) ? out : 0);
}

export type RegionMomentumInput = { region: string; cumulativeAlpha: number };
export type RegionMomentumOutput = {
  region: string;
  cumulativeAlpha: number;
  gravityWeight: number; // 0..1, sums to 1 across the set
};

/**
 * Regional Momentum ("capital gravity") as a softmax over cumulative Alpha.
 * - Regions with higher cumulative alpha attract more weight.
 * - Temperature controls sensitivity: lower => winner-takes-more.
 */
export function computeRegionalMomentum(inputs: RegionMomentumInput[], temperature = 10): RegionMomentumOutput[] {
  const temp = Number.isFinite(temperature) && temperature > 0 ? temperature : 10;
  const cleaned = inputs
    .map((x) => ({
      region: String(x.region ?? "").trim() || "Unknown",
      cumulativeAlpha: Number.isFinite(x.cumulativeAlpha) ? x.cumulativeAlpha : 0,
    }))
    .filter((x) => x.region.length > 0);
  if (cleaned.length === 0) return [];

  const maxA = Math.max(...cleaned.map((x) => x.cumulativeAlpha));
  const exps = cleaned.map((x) => Math.exp((x.cumulativeAlpha - maxA) / temp));
  const sum = exps.reduce((a, b) => a + b, 0);
  const out = cleaned.map((x, i) => ({
    ...x,
    gravityWeight: sum > 0 ? exps[i]! / sum : 1 / cleaned.length,
  }));
  out.sort((a, b) => b.gravityWeight - a.gravityWeight);
  return out;
}
