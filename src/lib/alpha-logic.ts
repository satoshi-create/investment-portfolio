/**
 * Single source of truth for Alpha (relative performance vs benchmark) interpretation.
 * Spec: no FX — compare local-currency daily returns directly (returns / Alpha %).
 *
 * For **portfolio valuation weights** (dashboard), pass a live `usdJpyRate` from `price-service` (`JPY=X`).
 */

import {
  DEFAULT_BENCHMARK_BY_INSTRUMENT_KIND,
  type CumulativeAlphaPoint,
  type TickerInstrumentKind,
} from "@/src/types/investment";

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
 * PEG = PER / (予想EPS成長率の小数 × 100)（例: 成長15%→0.15、PER30→PEG2）。
 * Forward PER と将来成長のペアを想定（呼び出し側で forward を優先すること）。
 */
export function computePegRatio(per: number, earningsGrowthDecimal: number): number | null {
  if (!Number.isFinite(per) || per <= 0) return null;
  if (!Number.isFinite(earningsGrowthDecimal) || earningsGrowthDecimal <= 0) return null;
  const denom = earningsGrowthDecimal * 100;
  if (!(denom > 0)) return null;
  const peg = per / denom;
  if (!Number.isFinite(peg) || peg < 0) return null;
  return Math.round(peg * 100) / 100;
}

/** 自前計算を優先し、不足時は Yahoo `pegRatio` を採用。 */
export function resolveStockPegRatio(args: {
  forwardPe: number | null;
  trailingPe: number | null;
  expectedGrowthDecimal: number | null;
  yahooPegRatio: number | null;
}): number | null {
  const per = args.forwardPe ?? args.trailingPe ?? null;
  if (per != null && args.expectedGrowthDecimal != null) {
    const peg = computePegRatio(per, args.expectedGrowthDecimal);
    if (peg != null) return peg;
  }
  const y = args.yahooPegRatio;
  if (y != null && Number.isFinite(y) && y > 0) return Math.round(y * 100) / 100;
  return null;
}

/** TOPIX ETF（日本リージョンの既定ベンチ）。合成ベンチの JP レッグに使用。 */
export const TOPIX_ETF_BENCHMARK_TICKER = DEFAULT_BENCHMARK_BY_INSTRUMENT_KIND.JP_LISTED_EQUITY;

/**
 * テーマ内の US / JP 構成比（0..1、合算 1）。
 * - いずれかの `marketValue` が正なら **評価額加重**
 * - すべて 0 / 非有限なら **銘柄数**（US vs JP）
 */
export function computeThemeUsJpRatiosFromStocks(
  stocks: { instrumentKind: TickerInstrumentKind; marketValue: number }[],
): { usRatio: number; jpRatio: number; basis: "market_value" | "equal_count" } {
  if (stocks.length === 0) {
    return { usRatio: 1, jpRatio: 0, basis: "equal_count" };
  }
  let mvUs = 0;
  let mvJp = 0;
  for (const s of stocks) {
    const mv = Number.isFinite(s.marketValue) && s.marketValue > 0 ? s.marketValue : 0;
    if (s.instrumentKind === "US_EQUITY") mvUs += mv;
    else mvJp += mv;
  }
  const mvTotal = mvUs + mvJp;
  if (mvTotal > 0) {
    return { usRatio: mvUs / mvTotal, jpRatio: mvJp / mvTotal, basis: "market_value" };
  }
  let nUs = 0;
  let nJp = 0;
  for (const s of stocks) {
    if (s.instrumentKind === "US_EQUITY") nUs += 1;
    else nJp += 1;
  }
  const n = nUs + nJp;
  if (n === 0) return { usRatio: 1, jpRatio: 0, basis: "equal_count" };
  return { usRatio: nUs / n, jpRatio: nJp / n, basis: "equal_count" };
}

/**
 * 合成ベンチ用 US/JP 比率。ダッシュの `marketValue` は円換算できた共通名目前提のため、
 * 表示レンズ（USD/JPY）を替えても比率は {@link computeThemeUsJpRatiosFromStocks} と同一になる。
 */
export function computeThemeUsJpRatiosForSyntheticBenchmark(
  stocks: { instrumentKind: TickerInstrumentKind; marketValue: number }[],
  _displayLens: QuoteCurrency,
  _usdJpyRate: number,
): { usRatio: number; jpRatio: number; basis: "market_value" | "equal_count" } {
  void _displayLens;
  void _usdJpyRate;
  return computeThemeUsJpRatiosFromStocks(stocks);
}

/**
 * 日次の合成ベンチマーク騰落率（%）。
 * `Synthetic_Return = VOO_Return * US_Ratio + TOPIX_Return * JP_Ratio`（正規化済み比率）。
 * 片側のみのテーマは単一ベンチのリターンに一致。
 */
export function computeSyntheticBenchmarkDailyReturnPercent(
  vooReturnPct: number | null,
  topixReturnPct: number | null,
  usRatio: number,
  jpRatio: number,
): number | null {
  const u = Math.max(0, usRatio);
  const j = Math.max(0, jpRatio);
  const denom = u + j;
  if (denom <= 1e-15) return null;
  const nu = u / denom;
  const nj = j / denom;
  if (nj < 1e-12) {
    if (vooReturnPct == null || !Number.isFinite(vooReturnPct)) return null;
    return roundAlphaMetric(vooReturnPct);
  }
  if (nu < 1e-12) {
    if (topixReturnPct == null || !Number.isFinite(topixReturnPct)) return null;
    return roundAlphaMetric(topixReturnPct);
  }
  if (vooReturnPct == null || topixReturnPct == null || !Number.isFinite(vooReturnPct) || !Number.isFinite(topixReturnPct)) {
    return null;
  }
  return roundAlphaMetric(nu * vooReturnPct + nj * topixReturnPct);
}

/** 日足バーの終了日 `date` に対するセッション騰落率（%）を Map に格納。 */
export function benchmarkDailyReturnPercentByEndDate(bars: { date: string; close: number }[]): Map<string, number> {
  const sorted = [...bars]
    .filter((b) => typeof b.date === "string" && b.date.length >= 10 && Number.isFinite(b.close) && b.close > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  const out = new Map<string, number>();
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!.close;
    const cur = sorted[i]!.close;
    const ret = dailyReturnPercent(prev, cur);
    if (ret != null) out.set(sorted[i]!.date.slice(0, 10), ret);
  }
  return out;
}

export type ThemeSyntheticStockInput = {
  ticker: string;
  weight: number;
  instrumentKind: TickerInstrumentKind;
  /** 終了営業日 YYYY-MM-DD → その日の日次 Alpha（対銘柄種別デフォルトベンチ） */
  dailyAlphaByEndDateYmd: Map<string, number>;
};

/**
 * テーマ加重の銘柄リターン対 **合成ベンチ** の日次超過を積み上げた累積 Alpha 系列。
 * 純 US / 純 JP では合成リターンが VOO / TOPIX に一致するため、物差しは Lv.1 と整合。
 *
 * **通貨・為替**: 各銘柄の `dailyAlphaByEndDateYmd` は「現地通貨建て終値」から算出した % 差分（Lv.1 の既定ベンチ対比）。
 * 日本株・投信は株も 1306.T も JPY — ここでは % のみ扱い、为替換算レイヤーは挟まない（二重調整にならない）。
 */
export function computeThemeCumulativeAlphaVsSyntheticFromDailyExcesses(input: {
  startAnchorYmd: string;
  stocks: ThemeSyntheticStockInput[];
  usRatio: number;
  jpRatio: number;
  vooReturnByEndDateYmd: Map<string, number>;
  topixReturnByEndDateYmd: Map<string, number>;
}): CumulativeAlphaPoint[] {
  const { stocks, usRatio, jpRatio, vooReturnByEndDateYmd, topixReturnByEndDateYmd, startAnchorYmd } = input;
  const dateSet = new Set<string>();
  for (const s of stocks) {
    for (const d of s.dailyAlphaByEndDateYmd.keys()) {
      if (d.length === 10) dateSet.add(d);
    }
  }
  const dates = [...dateSet].sort();
  const dailyRows: DatedAlphaRow[] = [];

  for (const d of dates) {
    const rv = vooReturnByEndDateYmd.get(d) ?? null;
    const rj = topixReturnByEndDateYmd.get(d) ?? null;
    const rSynth = computeSyntheticBenchmarkDailyReturnPercent(rv, rj, usRatio, jpRatio);
    if (rSynth == null) continue;

    let sumW = 0;
    let sumWr = 0;
    for (const s of stocks) {
      const a = s.dailyAlphaByEndDateYmd.get(d);
      if (a == null || !Number.isFinite(a)) continue;
      // Unpack absolute stock return from stored alpha = rStock − rBenchNative (same native bench as Lv.1 DB rows).
      const rBenchNative = s.instrumentKind === "US_EQUITY" ? rv : rj;
      if (rBenchNative == null || !Number.isFinite(rBenchNative)) continue;
      const rStock = a + rBenchNative;
      if (!Number.isFinite(rStock)) continue;
      const w = Math.max(0, s.weight);
      if (w <= 0) continue;
      sumW += w;
      sumWr += w * rStock;
    }
    if (sumW <= 0) continue;
    const rTheme = sumWr / sumW;
    const excess = roundAlphaMetric(rTheme - rSynth);
    dailyRows.push({ recordedAt: d, alphaValue: excess });
  }

  if (dailyRows.length < 2) return [];
  return calculateCumulativeAlpha(dailyRows, startAnchorYmd);
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
 * **FX-neutral** ポートフォリオ平均 Alpha（日次 % の単純平均）。
 * `alpha_history` は現地終値ベースで Lv.1 算出済みのため、この値は名目為替レンズに依らない。
 */
export function portfolioAverageFxNeutralDailyAlphaPct(stocks: { alphaHistory: readonly number[] }[]): number {
  const vals = stocks
    .map((s) => (s.alphaHistory.length > 0 ? s.alphaHistory[s.alphaHistory.length - 1]! : null))
    .filter((x): x is number => x != null && Number.isFinite(x));
  if (vals.length === 0) return 0;
  const sum = vals.reduce((a, b) => a + b, 0);
  return roundAlphaMetric(sum / vals.length);
}

/**
 * 日次 Alpha を `alpha_history` に永続化するときの絶対値上限（%ポイント）。
 * Yahoo 等の欠損・ズレで一度に数十 % 跳ぶような値はバグとして扱い、保存しない。
 */
export const ALPHA_HISTORY_PERSIST_ABS_MAX = 20;

/** `true` のとき `alpha_history` へ書かない（異常に大きい日次 Alpha）。 */
export function shouldRejectDailyAlphaForPersistence(alpha: number): boolean {
  if (!Number.isFinite(alpha)) return true;
  return Math.abs(alpha) > ALPHA_HISTORY_PERSIST_ABS_MAX;
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

/** Inventory「ライブ Alpha」用: 米国株は S&P 500（指数）、日本は TOPIX（指数）。 */
export const LIVE_ALPHA_US_BENCHMARK_TICKER = "^GSPC";
/** Yahoo で欠ける場合は `dashboard-data` 側で TOPIX ETF にフォールバックする。 */
export const LIVE_ALPHA_JP_BENCHMARK_TICKER = "^TPX";

/**
 * 現在値と前日終値から算出した銘柄リターン（%）。
 * `dailyReturnPercent` と同じ定義だが live / prev を明示するラッパー。
 */
export function computeStockDayReturnPercentLive(
  livePrice: number | null,
  previousClose: number | null,
): number | null {
  if (livePrice == null || previousClose == null || previousClose <= 0 || !Number.isFinite(livePrice)) {
    return null;
  }
  return dailyReturnPercent(previousClose, livePrice);
}

/**
 * ライブ Alpha（日次のベンチ対比超過 %）。
 * Stock_Return − Benchmark_Return（いずれも当日 vs 前日終値）。
 */
export function computeLiveAlphaDayPercent(input: {
  livePrice: number | null;
  previousClose: number | null;
  benchmarkDayChangePercent: number | null;
}): number | null {
  const sr = computeStockDayReturnPercentLive(input.livePrice, input.previousClose);
  return computeAlphaPercent(sr, input.benchmarkDayChangePercent);
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
 * テーマ詳細の「累積 Alpha」チャートの暦日アンカー（累積 0 の基準日に最も近い観測日を {@link calculateCumulativeAlpha} が選ぶ）。
 * VOO→TOPIX（1306.T）ベンチマーク移行後の物差しを揃え、切替日前後の系列を同一ルールで積み上げる。
 */
export const CUMULATIVE_ALPHA_DISPLAY_ANCHOR_YMD = "2026-02-27";

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
 * テーマ「年輪トレンド」用: 各銘柄の **日次 Alpha** を観測日で評価額加重平均し、その系列を累積する。
 *
 * 旧 `mergeWeightedCumulativeAlphaSeries(各銘柄の累積系列)` は、銘柄ごとに `calculateCumulativeAlpha` の
 * アンカー営業日がズレるため、日によって「累積が取れる銘柄の集合」が変わり **段差・垂直跳び** が出やすい。
 * 日次 → 加重 → 累積の一経路に揃える。
 *
 * ウォッチリスト横断では **単日・少数銘柄の異常な `alpha_value`** で加重平均が暴れることがあるため、
 * 日次 Alpha は **±`STRUCTURAL_TREND_DAILY_ALPHA_CLIP_ABS`%** にクリップしてから加重する。
 */
/** 年輪トレンドの日次 Alpha クリップ（%ポイント）。DB / 取得由来の外れ値でチャートが垂直に跳ばないようにする。 */
export const STRUCTURAL_TREND_DAILY_ALPHA_CLIP_ABS = 25;

export function computeThemeStructuralTrendCumulativeFromWeightedDailyAlphas(
  inputs: { weight: number; dailyAlphaByYmd: Map<string, number> }[],
  windowStartYmd: string,
): CumulativeAlphaPoint[] {
  if (inputs.length === 0) return [];
  const start = windowStartYmd.trim().slice(0, 10);
  if (start.length !== 10) return [];

  const weighted = inputs
    .map((x) => ({
      w: x.weight > 0 && Number.isFinite(x.weight) ? x.weight : 0,
      m: x.dailyAlphaByYmd,
    }))
    .filter((x) => x.w > 0);
  if (weighted.length === 0) return [];

  const dateSet = new Set<string>();
  for (const { m } of weighted) {
    for (const d of m.keys()) {
      if (d.length === 10 && d >= start) dateSet.add(d);
    }
  }
  const dates = [...dateSet].sort();
  if (dates.length === 0) return [];

  const out: CumulativeAlphaPoint[] = [];
  out.push({ date: dates[0]!, cumulative: 0 });

  let cum = 0;
  for (let i = 1; i < dates.length; i++) {
    const d = dates[i]!;
    let sumW = 0;
    let sumWA = 0;
    for (const { w, m } of weighted) {
      const raw = m.get(d);
      if (raw == null || !Number.isFinite(raw)) continue;
      const a = Math.max(-STRUCTURAL_TREND_DAILY_ALPHA_CLIP_ABS, Math.min(STRUCTURAL_TREND_DAILY_ALPHA_CLIP_ABS, raw));
      sumW += w;
      sumWA += w * a;
    }
    if (sumW <= 0) continue;
    const daily = sumWA / sumW;
    cum += Number.isFinite(daily) ? daily : 0;
    out.push({ date: d, cumulative: roundAlphaMetric(cum) });
  }
  return out;
}

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
