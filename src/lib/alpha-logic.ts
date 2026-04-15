/**
 * Single source of truth for Alpha (relative performance vs benchmark) interpretation.
 * Spec: no FX — compare local-currency daily returns directly (returns / Alpha %).
 *
 * For **portfolio valuation weights** (dashboard), pass a live `usdJpyRate` from `price-service` (`JPY=X`).
 */

import type { TickerInstrumentKind } from "@/src/types/investment";

/** Benchmark ticker persisted in `alpha_history` / used by signal rules (must exist in `benchmarks`). */
export const SIGNAL_BENCHMARK_TICKER = "VOO";

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

export function classifyTickerInstrument(ticker: string): TickerInstrumentKind {
  const t = ticker.trim();
  if (DIGITS_ONLY.test(t)) return "JP_INVESTMENT_TRUST";
  return "US_EQUITY";
}

/**
 * Currency for dashboard market value: digit-only tickers (投信等) → JPY、それ以外 → USD×為替。
 * 指数連動のスケールずれは `valuation_factor` で調整（ティッカーが数字でも provider が ^ でも円レートは乗せない）。
 */
export function quoteCurrencyForDashboardWeights(ticker: string): QuoteCurrency {
  return classifyTickerInstrument(ticker) === "JP_INVESTMENT_TRUST" ? "JPY" : "USD";
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

export type NonLinearExplosionDiagnostics = {
  /** 1階差分（成長率）: cumulative[t] - cumulative[t-1] */
  velocity: number[];
  /** 2階差分（加速度）: velocity[t] - velocity[t-1] */
  acceleration: number[];
  /** 3階差分（躍度/Jerk）: acceleration[t] - acceleration[t-1] */
  jerk: number[];
  /** Phase Shift 判定 */
  isNonLinearExplosion: boolean;
  /** 判定理由（UI 表示用ではなく、デバッグ・ログ用の簡易タグ） */
  reasons: ("accel_ratio" | "log_vertical")[];
};

function safeMean(xs: number[]): number | null {
  const vals = xs.filter((x) => Number.isFinite(x));
  if (vals.length === 0) return null;
  const s = vals.reduce((a, b) => a + b, 0);
  return s / vals.length;
}

function computeDiffSeries(values: number[]): { velocity: number[]; acceleration: number[]; jerk: number[] } {
  const v: number[] = [];
  for (let i = 1; i < values.length; i++) {
    const a = values[i - 1]!;
    const b = values[i]!;
    v.push(Number.isFinite(a) && Number.isFinite(b) ? b - a : Number.NaN);
  }
  const acc: number[] = [];
  for (let i = 1; i < v.length; i++) {
    const a = v[i - 1]!;
    const b = v[i]!;
    acc.push(Number.isFinite(a) && Number.isFinite(b) ? b - a : Number.NaN);
  }
  const j: number[] = [];
  for (let i = 1; i < acc.length; i++) {
    const a = acc[i - 1]!;
    const b = acc[i]!;
    j.push(Number.isFinite(a) && Number.isFinite(b) ? b - a : Number.NaN);
  }
  return { velocity: v, acceleration: acc, jerk: j };
}

function linearRegressionR2(xs: number[], ys: number[]): { slope: number; r2: number } | null {
  if (xs.length !== ys.length || xs.length < 3) return null;
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - mx;
    const dy = ys[i]! - my;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }
  if (!(sxx > 0) || !(syy > 0)) return null;
  const slope = sxy / sxx;
  const r2 = (sxy * sxy) / (sxx * syy);
  return { slope, r2 };
}

/**
 * 累積 Alpha の「加速の加速」を検知し、相転移（Phase Shift）としてフラグ化する。
 *
 * 判定条件:
 * - 直近7日間の加速度平均が、過去30日（直近7日を除く）の平均の2倍を超える
 * - または、対数空間（正値へシフトした log）で「ほぼ直線」かつ急勾配（垂直立ち上がり）
 */
export function detectNonLinearExplosionFromCumulativeSeries(
  series: { cumulative: number }[],
): NonLinearExplosionDiagnostics {
  const values = series
    .map((p) => p.cumulative)
    .filter((x) => x != null)
    .map((x) => Number(x));

  const { velocity, acceleration, jerk } = computeDiffSeries(values);

  const reasons: ("accel_ratio" | "log_vertical")[] = [];

  // Condition A: acceleration phase shift ratio
  // acceleration[] length = values.length - 2
  const accel = acceleration;
  const last7 = accel.slice(-7);
  const prev30 = accel.slice(-(7 + 30), -7);
  const last7Mean = safeMean(last7);
  const prev30Mean = safeMean(prev30);
  const accelRatioOk =
    last7Mean != null &&
    prev30Mean != null &&
    Number.isFinite(last7Mean) &&
    Number.isFinite(prev30Mean) &&
    // past mean can be tiny; require it to be meaningfully > 0 to avoid noise explosions
    prev30Mean > 0.02 &&
    last7Mean > prev30Mean * 2;
  if (accelRatioOk) reasons.push("accel_ratio");

  // Condition B: "vertical" in log space (shifted log; robust to scale)
  // Use last 7 points of cumulative, require strong fit + steep slope + positive momentum.
  const logVerticalOk = (() => {
    if (values.length < 10) return false;
    const window = values.slice(-7);
    const winMin = Math.min(...window.filter((x) => Number.isFinite(x)));
    const winMax = Math.max(...window.filter((x) => Number.isFinite(x)));
    if (!Number.isFinite(winMin) || !Number.isFinite(winMax)) return false;
    // Require meaningful lift in the raw space (avoid tiny wiggles)
    if (winMax - winMin < 1.25) return false;
    // Shift to positive for log; use global min of window for local sensitivity
    const shift = -Math.min(...window, 0) + 1;
    const ys = window.map((x) => Math.log(x + shift));
    if (ys.some((y) => !Number.isFinite(y))) return false;
    const xs = window.map((_, i) => i);
    const reg = linearRegressionR2(xs, ys);
    if (!reg) return false;
    const avgVel = safeMean(velocity.slice(-7));
    // slope threshold ~ 0.33/day => e^(0.33) ≈ 1.39x per day in shifted space
    return reg.r2 >= 0.92 && reg.slope >= 0.33 && avgVel != null && avgVel > 0.35;
  })();
  if (logVerticalOk) reasons.push("log_vertical");

  return {
    velocity,
    acceleration,
    jerk,
    isNonLinearExplosion: reasons.length > 0,
    reasons,
  };
}
