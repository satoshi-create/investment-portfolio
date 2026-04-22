import type { Client } from "@libsql/client";

import type {
  CoreSatelliteBreakdown,
  CumulativeAlphaPoint,
  DashboardData,
  HoldingCategory,
  InvestmentThemeRecord,
  LiveSignalType,
  Signal,
  Stock,
  StructureTagSlice,
  ThemeDetailData,
  ThemeEcosystemWatchItem,
  ThemeStructuralSparklineEntry,
  TickerInstrumentKind,
} from "@/src/types/investment";
import {
  benchmarkDailyReturnPercentByEndDate,
  calculateCumulativeAlpha,
  classifyTickerInstrument,
  computeAlphaDeviationZScore,
  computePriceDrawdownFromHighPercent,
  computeThemeCumulativeAlphaVsSyntheticFromDailyExcesses,
  computeThemeStructuralTrendCumulativeFromWeightedDailyAlphas,
  computeThemeUsJpRatiosForSyntheticBenchmark,
  portfolioAverageFxNeutralDailyAlphaPct,
  convertValueToJpy,
  CUMULATIVE_ALPHA_DISPLAY_ANCHOR_YMD,
  defaultBenchmarkTickerForTicker,
  computeLiveAlphaDayPercent,
  dailyReturnPercent,
  LIVE_ALPHA_JP_BENCHMARK_TICKER,
  LIVE_ALPHA_US_BENCHMARK_TICKER,
  mergeWeightedCumulativeAlphaSeries,
  quoteCurrencyForDashboardWeights,
  roundAlphaMetric,
  SIGNAL_BENCHMARK_TICKER,
  THEME_STRUCTURAL_TREND_LOOKBACK_DAYS,
  TOPIX_ETF_BENCHMARK_TICKER,
  toYmd,
  ymdDaysAgoUtc,
  type DatedAlphaRow,
  type ThemeSyntheticStockInput,
} from "@/src/lib/alpha-logic";
import {
  alphaWatchTargetsFromEcosystemMembers,
  reconcileAlphaHistoryForWatchlistTickers,
} from "@/src/lib/alpha-history-reconcile";
import { parseAdoptionStage } from "@/src/lib/adoption-stage";
import { parseExpectationCategory } from "@/src/lib/expectation-category";
import {
  computeInvestmentJudgment,
  expectationCategoryToInvestmentNarrative,
} from "@/src/lib/judgment-logic";
import {
  formatPortfolioAvgAlphaAsOfDisplay,
} from "@/src/lib/us-market-session";
import {
  aggregateByHoldingSector,
  aggregateByTheme,
  portfolioThemeTagMatchesThemePage,
  sanitizeMarketValueForAggregation,
  sectorFromStructureTags,
  themeFromStructureTags,
} from "@/src/lib/structure-tags";
import { USD_JPY_RATE_FALLBACK } from "@/src/lib/fx-constants";
import {
  fetchGlobalMarketIndicators,
  fetchLatestPrice,
  fetchEquityResearchSnapshots,
  fetchRecentDatedDailyAlphasVsBenchmark,
  fetchLatestPriceWithChangePct,
  fetchLiveQuoteSnapshot,
  fetchHoldingsHybridPriceSnapshots,
  fetchPriceHistory,
  type HybridHoldingPriceSnapshot,
  fetchUsdJpyRate,
  holdingLivePriceKey,
  fetchChartTotalReturnPercentSinceFirstDailyBar,
} from "@/src/lib/price-service";
import {
  prefetchHoldingsInstrumentMetadata,
  prefetchThemeEcosystemInstrumentMetadata,
} from "@/src/lib/instrument-metadata-sync";

export { syncStockMetadata } from "@/src/lib/instrument-metadata-sync";
export type { SyncStockMetadataResult } from "@/src/lib/instrument-metadata-sync";

const TARGET_CORE_PERCENT = 90;

type AlphaPoint = { alpha: number; close: number | null; /** 日次 α の観測日（`alpha_history.recorded_at` 暦日） */ observationYmd: string };

/**
 * `alpha_history` 行 → ティッカー別の日次 Alpha 系列。
 * **暦日でソート**し同一日は後勝ち。Inventory の「Alpha」は `slice(-1)` で参照するため、順序ズレがあると最新日ではない値が表示される。
 */

function asCategory(raw: string): HoldingCategory {
  return raw === "Core" ? "Core" : "Satellite";
}

function parseJsonTextArray(raw: unknown): string[] {
  if (raw == null) return [];
  const s = String(raw).trim();
  if (s.length === 0) return [];
  try {
    const v = JSON.parse(s) as unknown;
    if (!Array.isArray(v)) return [];
    return v.map((x) => String(x)).map((x) => x.trim()).filter((x) => x.length > 0);
  } catch {
    return [];
  }
}

async function fetchAlphaHistoryRowsForTickers(
  db: Client,
  userId: string,
  tickers: string[],
): Promise<Record<string, unknown>[]> {
  const unique = [...new Set(tickers.map((t) => String(t).trim()).filter((t) => t.length > 0))];
  if (unique.length === 0) return [];

  const byBench = new Map<string, string[]>();
  for (const t of unique) {
    const bench = defaultBenchmarkTickerForTicker(t);
    const arr = byBench.get(bench) ?? [];
    arr.push(t);
    byBench.set(bench, arr);
  }

  const allRows: Record<string, unknown>[] = [];
  for (const [bench, ts] of byBench) {
    const placeholders = ts.map(() => "?").join(",");
    const rs = await db.execute({
      sql: `SELECT ticker, alpha_value, recorded_at, close_price, benchmark_ticker FROM alpha_history
            WHERE user_id = ? AND benchmark_ticker = ? AND ticker IN (${placeholders})
            ORDER BY ticker ASC, recorded_at ASC`,
      args: [userId, bench, ...ts],
    });
    allRows.push(...(rs.rows as Record<string, unknown>[]));
  }

  return filterAlphaHistoryRowsToDefaultBenchmark(allRows);
}

/** 同一暦日に複数ベンチの行が残っている DB でも、銘柄種別の既定ベンチのみを採用（合算・後勝ち混線を防ぐ）。 */
function filterAlphaHistoryRowsToDefaultBenchmark(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const row of rows) {
    const tk = String(row["ticker"] ?? "").trim();
    if (tk.length === 0) continue;
    const rawBench = row["benchmark_ticker"];
    if (rawBench == null || String(rawBench).trim().length === 0) {
      out.push(row);
      continue;
    }
    const bench = String(rawBench).trim();
    if (bench === defaultBenchmarkTickerForTicker(tk)) out.push(row);
  }
  return out;
}

function parseJsonIntArray(raw: unknown): number[] {
  if (raw == null) return [];
  const s = String(raw).trim();
  if (s.length === 0) return [];
  try {
    const v = JSON.parse(s) as unknown;
    if (!Array.isArray(v)) return [];
    const out: number[] = [];
    for (const x of v) {
      const n = Number(x);
      if (Number.isFinite(n) && n >= 1 && n <= 12) out.push(Math.trunc(n));
    }
    return [...new Set(out)].sort((a, b) => a - b);
  } catch {
    return [];
  }
}

async function fetchAllInvestmentThemes(db: Client, userId: string): Promise<InvestmentThemeRecord[]> {
  try {
    const rs = await db.execute({
      sql: `SELECT id, user_id, name, description, goal, created_at
            FROM investment_themes
            WHERE user_id = ?
            ORDER BY created_at DESC, name ASC`,
      args: [userId],
    });
    return rs.rows.map((row) => ({
      id: String(row.id),
      userId: String(row.user_id),
      name: String(row.name),
      description: row.description != null ? String(row.description) : null,
      goal: row.goal != null ? String(row.goal) : null,
      createdAt: String(row.created_at),
    }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("no such table") || msg.toLowerCase().includes("investment_themes")) {
      return [];
    }
    throw e;
  }
}

function latestCloseFromSeries(series: AlphaPoint[]): number | null {
  for (let i = series.length - 1; i >= 0; i--) {
    const c = series[i]!.close;
    if (c != null && Number.isFinite(c) && c > 0) return c;
  }
  return null;
}

/** Latest and previous valid closes (chronological: prev then latest) for day-over-day %. */
function lastTwoClosesFromSeries(series: AlphaPoint[]): { prevClose: number; latestClose: number } | null {
  const found: number[] = [];
  for (let i = series.length - 1; i >= 0 && found.length < 2; i--) {
    const c = series[i]!.close;
    if (c != null && Number.isFinite(c) && c > 0) found.push(c);
  }
  if (found.length < 2) return null;
  return { prevClose: found[1]!, latestClose: found[0]! };
}

/** ライブ株価と（取得できれば）当日の前日比%から前日終値を推定。 */
function derivePreviousCloseForLiveAlpha(input: {
  currentPrice: number | null;
  hybridChangePct: number | null;
  series: AlphaPoint[];
}): number | null {
  const { currentPrice, hybridChangePct, series } = input;
  if (
    currentPrice != null &&
    hybridChangePct != null &&
    Number.isFinite(hybridChangePct) &&
    currentPrice > 0
  ) {
    const denom = 1 + hybridChangePct / 100;
    if (Number.isFinite(denom) && Math.abs(denom) > 1e-12) {
      const prev = currentPrice / denom;
      if (Number.isFinite(prev) && prev > 0) return prev;
    }
  }
  const two = lastTwoClosesFromSeries(series);
  return two?.prevClose ?? null;
}

function parseAvgAcquisitionPrice(raw: unknown): number | null {
  if (raw == null) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function parseSector(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  return s.length > 0 ? s : null;
}

function quoteCurrencyForInstrument(kind: TickerInstrumentKind): "JPY" | "USD" {
  return kind === "US_EQUITY" ? "USD" : "JPY";
}

/**
 * 含み損益（現地通貨ベースの名目）。
 * - 米株: USD で (現在株価 − 平均取得単価) × 数量 × valuation_factor（円換算は別途 `fxUsdJpy` を掛ける）。
 * - 投信等: JPY で同式。
 */
function computeUnrealizedPnlLocal(
  currentPrice: number | null,
  avgAcquisition: number | null,
  quantity: number,
  valuationFactor: number,
): { local: number; percent: number } {
  if (currentPrice == null || !Number.isFinite(currentPrice) || currentPrice <= 0) {
    return { local: 0, percent: 0 };
  }
  if (avgAcquisition == null) return { local: 0, percent: 0 };
  if (!Number.isFinite(quantity) || quantity <= 0) return { local: 0, percent: 0 };
  const f = Number.isFinite(valuationFactor) && valuationFactor > 0 ? valuationFactor : 1;
  const local = (currentPrice - avgAcquisition) * quantity * f;
  const pct = ((currentPrice - avgAcquisition) / avgAcquisition) * 100;
  return {
    local: Number.isFinite(local) ? local : 0,
    percent: Number.isFinite(pct) ? roundAlphaMetric(pct) : 0,
  };
}

/**
 * Market value in JPY for weights:
 * `quantity × latest_close × valuation_factor × (fxUsdJpy if quote is USD, else 1)`.
 */
export function normalizedHoldingValueJpy(input: {
  ticker: string;
  quantity: number;
  currentPrice: number | null;
  valuationFactor: number;
  fxUsdJpy: number;
}): number {
  const { ticker, quantity, currentPrice, valuationFactor, fxUsdJpy } = input;
  if (currentPrice == null || !Number.isFinite(currentPrice) || currentPrice <= 0) return 0;
  if (!Number.isFinite(quantity) || quantity <= 0) return 0;
  const f = Number.isFinite(valuationFactor) && valuationFactor > 0 ? valuationFactor : 1;
  const base = quantity * currentPrice * f;
  const ccy = quoteCurrencyForDashboardWeights(ticker);
  return convertValueToJpy(base, ccy, fxUsdJpy);
}

function normalizedHoldingValueJpyWithFx(input: {
  ticker: string;
  quantity: number;
  currentPrice: number | null;
  valuationFactor: number;
  fxUsdJpy: number;
}): number {
  const { ticker, quantity, currentPrice, valuationFactor, fxUsdJpy } = input;
  if (currentPrice == null || !Number.isFinite(currentPrice) || currentPrice <= 0) return 0;
  if (!Number.isFinite(quantity) || quantity <= 0) return 0;
  const f = Number.isFinite(valuationFactor) && valuationFactor > 0 ? valuationFactor : 1;
  const base = quantity * currentPrice * f;
  const ccy = quoteCurrencyForDashboardWeights(ticker);
  if (ccy === "JPY") return base;
  return base * fxUsdJpy;
}

function computeCoreSatellite(stocks: Stock[]): CoreSatelliteBreakdown {
  let coreV = 0;
  let satV = 0;
  for (const s of stocks) {
    if (s.category === "Core") coreV += s.marketValue;
    else satV += s.marketValue;
  }
  const t = coreV + satV;
  const coreWeightPercent = t > 0 ? Math.round((coreV / t) * 10000) / 100 : 0;
  const satelliteWeightPercent = t > 0 ? Math.round((satV / t) * 10000) / 100 : 0;
  return {
    coreWeightPercent,
    satelliteWeightPercent,
    targetCorePercent: TARGET_CORE_PERCENT,
    coreGapVsTarget: Math.round((coreWeightPercent - TARGET_CORE_PERCENT) * 100) / 100,
  };
}

export type PortfolioAverageAlphaSummary = {
  average: number;
  stalestLatestObservationYmd: string | null;
  freshestLatestObservationYmd: string | null;
};

/**
 * 各保有の「最新日次 α」の単純平均に加え、観測日の鮮度（最古/最新）を返す。
 */
function computePortfolioAverageAlphaSummary(stocks: Stock[]): PortfolioAverageAlphaSummary {
  const values: number[] = [];
  let stalest: string | null = null;
  let freshest: string | null = null;
  for (const s of stocks) {
    if (s.alphaHistory.length === 0) continue;
    const a = s.alphaHistory[s.alphaHistory.length - 1]!;
    if (!Number.isFinite(a)) continue;
    values.push(a);
    const y = s.latestAlphaObservationYmd;
    if (y != null && y.length === 10) {
      if (stalest == null || y < stalest) stalest = y;
      if (freshest == null || y > freshest) freshest = y;
    }
  }
  if (values.length === 0) {
    return { average: 0, stalestLatestObservationYmd: null, freshestLatestObservationYmd: null };
  }
  const sum = values.reduce((x, y) => x + y, 0);
  return {
    average: roundAlphaMetric(sum / values.length),
    stalestLatestObservationYmd: stalest,
    freshestLatestObservationYmd: freshest,
  };
}

type BenchmarkSnapshot = {
  close: number;
  changePct: number | null;
  priceSource: "live" | "close";
  asOf: string | null;
};

type LiveAlphaBenchmarkContext = {
  usBenchmarkChangePct: number | null;
  jpBenchmarkChangePct: number | null;
  usBenchmarkTicker: string;
  jpBenchmarkTicker: string;
};

type LiveBenchSnap = { changePct: number | null; ticker: string };

async function resolveLiveAlphaUsBenchmark(): Promise<LiveBenchSnap> {
  const t = LIVE_ALPHA_US_BENCHMARK_TICKER;
  try {
    const live = await fetchLiveQuoteSnapshot(t, null);
    if (live != null && live.changePct != null && Number.isFinite(live.changePct)) {
      return { changePct: roundAlphaMetric(live.changePct), ticker: t };
    }
    const snap = await fetchLatestPriceWithChangePct(t, null);
    if (snap.changePct != null && Number.isFinite(snap.changePct) && snap.close > 0) {
      return { changePct: snap.changePct, ticker: t };
    }
  } catch {
    /* Yahoo 等の失敗は null */
  }
  return { changePct: null, ticker: t };
}

/** ^TPX が取得できない環境では TOPIX ETF（既定ベンチ）へフォールバック。 */
async function resolveLiveAlphaJpBenchmark(): Promise<LiveBenchSnap> {
  const primary = LIVE_ALPHA_JP_BENCHMARK_TICKER;
  try {
    const live = await fetchLiveQuoteSnapshot(primary, null);
    if (live != null && live.changePct != null && Number.isFinite(live.changePct)) {
      return { changePct: roundAlphaMetric(live.changePct), ticker: primary };
    }
    const snap = await fetchLatestPriceWithChangePct(primary, null);
    if (snap.changePct != null && Number.isFinite(snap.changePct) && snap.close > 0) {
      return { changePct: snap.changePct, ticker: primary };
    }
  } catch {
    /* continue */
  }
  const fb = TOPIX_ETF_BENCHMARK_TICKER;
  try {
    const live = await fetchLiveQuoteSnapshot(fb, null);
    if (live != null && live.changePct != null && Number.isFinite(live.changePct)) {
      return { changePct: roundAlphaMetric(live.changePct), ticker: fb };
    }
    const snap = await fetchLatestPriceWithChangePct(fb, null);
    if (snap.changePct != null && Number.isFinite(snap.changePct) && snap.close > 0) {
      return { changePct: snap.changePct, ticker: fb };
    }
  } catch {
    /* */
  }
  return { changePct: null, ticker: primary };
}

export async function resolveLiveAlphaBenchmarkContext(): Promise<LiveAlphaBenchmarkContext> {
  const [us, jp] = await Promise.all([resolveLiveAlphaUsBenchmark(), resolveLiveAlphaJpBenchmark()]);
  return {
    usBenchmarkChangePct: us.changePct,
    jpBenchmarkChangePct: jp.changePct,
    usBenchmarkTicker: us.ticker,
    jpBenchmarkTicker: jp.ticker,
  };
}

type PortfolioSnapshotReturnRow = {
  snapshotDate: string;
  portfolioReturnVsPrevPct: number | null;
  benchmarkReturnVsPrevPct: number | null;
  alphaVsPrevPct: number | null;
};

function isSqliteMissingColumn(e: unknown, col: string): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  const lower = msg.toLowerCase();
  return lower.includes("no such column") && lower.includes(col.toLowerCase());
}

async function fetchPortfolioSnapshotReturnRows(
  db: Client,
  userId: string,
  cap = 420,
): Promise<PortfolioSnapshotReturnRow[]> {
  try {
    let rs;
    try {
      rs = await db.execute({
        sql: `SELECT snapshot_date, portfolio_return_vs_prev_pct, benchmark_return_vs_prev_pct, alpha_vs_prev_pct
              FROM portfolio_daily_snapshots
              WHERE user_id = ?
              ORDER BY snapshot_date ASC
              LIMIT ?`,
        args: [userId, cap],
      });
    } catch (eAlpha) {
      if (!isSqliteMissingColumn(eAlpha, "alpha_vs_prev_pct")) throw eAlpha;
      rs = await db.execute({
        sql: `SELECT snapshot_date, portfolio_return_vs_prev_pct, benchmark_return_vs_prev_pct
              FROM portfolio_daily_snapshots
              WHERE user_id = ?
              ORDER BY snapshot_date ASC
              LIMIT ?`,
        args: [userId, cap],
      });
    }
    return (rs.rows as Record<string, unknown>[]).map((r) => ({
      snapshotDate: String(r["snapshot_date"] ?? ""),
      portfolioReturnVsPrevPct:
        r["portfolio_return_vs_prev_pct"] != null && Number.isFinite(Number(r["portfolio_return_vs_prev_pct"]))
          ? Number(r["portfolio_return_vs_prev_pct"])
          : null,
      benchmarkReturnVsPrevPct:
        r["benchmark_return_vs_prev_pct"] != null && Number.isFinite(Number(r["benchmark_return_vs_prev_pct"]))
          ? Number(r["benchmark_return_vs_prev_pct"])
          : null,
      alphaVsPrevPct:
        r["alpha_vs_prev_pct"] != null && Number.isFinite(Number(r["alpha_vs_prev_pct"]))
          ? Number(r["alpha_vs_prev_pct"])
          : null,
    }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const lower = msg.toLowerCase();
    if (lower.includes("no such table") && lower.includes("portfolio_daily_snapshots")) return [];
    if (
      isSqliteMissingColumn(e, "portfolio_return_vs_prev_pct") ||
      isSqliteMissingColumn(e, "benchmark_return_vs_prev_pct")
    ) {
      return [];
    }
    throw e;
  }
}

function computeAverageDailyAlphaPctFromSnapshots(rows: PortfolioSnapshotReturnRow[]): number | null {
  if (rows.length < 2) return null;
  let sum = 0;
  let n = 0;
  for (const r of rows) {
    const direct = r.alphaVsPrevPct;
    if (direct != null && Number.isFinite(direct)) {
      sum += direct;
      n += 1;
      continue;
    }
    const pr = r.portfolioReturnVsPrevPct;
    const br = r.benchmarkReturnVsPrevPct;
    if (pr == null || br == null || !Number.isFinite(pr) || !Number.isFinite(br)) continue;
    sum += pr - br;
    n += 1;
  }
  if (n === 0) return null;
  return roundAlphaMetric(sum / n);
}

function computePortfolioTotalLiveAlphaPctWeighted(stocks: Stock[]): number | null {
  let num = 0;
  let den = 0;
  for (const s of stocks) {
    const mv = Number.isFinite(s.marketValue) && s.marketValue > 0 ? s.marketValue : 0;
    if (mv <= 0) continue;
    const a = computeLiveAlphaDayPercent({
      livePrice: s.currentPrice,
      previousClose: s.previousClose,
      benchmarkDayChangePercent: s.benchmarkDayChangePercent,
    });
    if (a == null || !Number.isFinite(a)) continue;
    num += a * mv;
    den += mv;
  }
  if (den <= 0) return null;
  return roundAlphaMetric(num / den);
}

/** VOO: ライブ `quote` 最優先、次に日足 chart（保有銘柄のハイブリッドと同方針）。 */
async function resolveBenchmarkSnapshot(): Promise<BenchmarkSnapshot> {
  const empty: BenchmarkSnapshot = { close: 0, changePct: null, priceSource: "close", asOf: null };
  try {
    const live = await fetchLiveQuoteSnapshot(SIGNAL_BENCHMARK_TICKER, null);
    if (live != null && Number.isFinite(live.price) && live.price > 0) {
      return {
        close: live.price,
        changePct: live.changePct,
        priceSource: "live",
        asOf: live.asOf,
      };
    }
    const snap = await fetchLatestPriceWithChangePct(SIGNAL_BENCHMARK_TICKER, null);
    if (snap.close != null && Number.isFinite(snap.close) && snap.close > 0) {
      return {
        close: snap.close,
        changePct: snap.changePct,
        priceSource: "close",
        asOf: snap.date.length >= 10 ? `${snap.date.slice(0, 10)}T00:00:00.000Z` : null,
      };
    }
  } catch {
    /* Yahoo 失敗時は 0（UI は —） */
  }
  return empty;
}

async function resolveFxUsdJpyRate(): Promise<number | null> {
  try {
    const snap = await fetchUsdJpyRate();
    return snap?.rate ?? null;
  } catch {
    return null;
  }
}

/** `trade_history` の累計確定損益（円）。テーブル未作成時は 0。 */
async function fetchTotalRealizedPnlJpy(db: Client, userId: string): Promise<number> {
  try {
    const rs = await db.execute({
      sql: `SELECT COALESCE(SUM(realized_pnl_jpy), 0) AS s FROM trade_history WHERE user_id = ?`,
      args: [userId],
    });
    const v = rs.rows[0]?.s;
    return v != null && Number.isFinite(Number(v)) ? Number(v) : 0;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("no such table") || msg.toLowerCase().includes("trade_history")) {
      return 0;
    }
    throw e;
  }
}

function computeFinancialTotals(
  stocks: Stock[],
  totalRealizedPnlJpy: number,
): Pick<
  DashboardData["summary"],
  | "totalCostBasisJpy"
  | "totalRealizedPnlJpy"
  | "totalUnrealizedPnlJpy"
  | "totalProfitJpy"
  | "totalReturnPct"
> {
  let totalUnrealizedPnlJpy = 0;
  let totalCostBasisJpy = 0;
  for (const s of stocks) {
    const mv = sanitizeMarketValueForAggregation(s.marketValue);
    const uj = Number.isFinite(s.unrealizedPnlJpy) ? s.unrealizedPnlJpy : 0;
    totalUnrealizedPnlJpy += uj;
    totalCostBasisJpy += mv - uj;
  }
  const realized = Number.isFinite(totalRealizedPnlJpy) ? totalRealizedPnlJpy : 0;
  const totalProfitJpy = totalUnrealizedPnlJpy + realized;
  const totalReturnPct =
    totalCostBasisJpy > 0 && Number.isFinite(totalProfitJpy)
      ? roundAlphaMetric((totalProfitJpy / totalCostBasisJpy) * 100)
      : 0;
  return {
    totalCostBasisJpy,
    totalRealizedPnlJpy: realized,
    totalUnrealizedPnlJpy,
    totalProfitJpy,
    totalReturnPct,
  };
}

/** 保有の前日比 %（算出できた銘柄の算術平均）。Holdings 明細フッターと同じ。 */
function computePortfolioAvgDayChangePct(stocks: Stock[]): number | null {
  const vals = stocks
    .map((s) => s.dayChangePercent)
    .filter((x): x is number => x != null && Number.isFinite(x));
  if (vals.length === 0) return null;
  return roundAlphaMetric(vals.reduce((a, b) => a + b, 0) / vals.length);
}

type HoldingQueryRow = {
  id: unknown;
  ticker: unknown;
  name: unknown;
  quantity: unknown;
  avg_acquisition_price: unknown;
  structure_tags: unknown;
  sector: unknown;
  category: unknown;
  account_type: unknown;
  provider_symbol: unknown;
  valuation_factor: unknown;
  expectation_category?: unknown;
  earnings_summary_note?: unknown;
  listing_date?: unknown;
  /** 旧マイグレーションのみ */
  founded_date?: unknown;
  market_cap?: unknown;
  listing_price?: unknown;
  next_earnings_date?: unknown;
  memo?: unknown;
  is_bookmarked?: unknown;
  instrument_meta_synced_at?: unknown;
  stop_loss_pct?: unknown;
  target_profit_pct?: unknown;
  trade_deadline?: unknown;
  exit_rule_enabled?: unknown;
};

function parseEarningsSummaryNote(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw);
  if (s.trim().length === 0) return null;
  return s;
}

function parseOptionalIsoDatePrefix(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  return s.length >= 10 ? s.slice(0, 10) : null;
}

function parseOptionalFiniteNumberMeta(raw: unknown): number | null {
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseBookmarkFlag(raw: unknown): boolean {
  return raw != null && String(raw).trim() !== "" ? Number(raw) === 1 : false;
}

function parseShortTermExitRulePercents(row: HoldingQueryRow): {
  stopLossPct: number | null;
  targetProfitPct: number | null;
  tradeDeadline: string | null;
  exitRuleEnabled: boolean;
} {
  const exitRuleEnabled = row.exit_rule_enabled != null && Number(row.exit_rule_enabled) === 1;
  const slp = row.stop_loss_pct;
  const tpp = row.target_profit_pct;
  const stopLossPct =
    slp != null && Number.isFinite(Number(slp)) && Number(slp) > 0 ? Number(slp) : null;
  const targetProfitPct =
    tpp != null && Number.isFinite(Number(tpp)) && Number(tpp) > 0 ? Number(tpp) : null;
  const tradeDeadline = parseOptionalIsoDatePrefix(row.trade_deadline);
  return { stopLossPct, targetProfitPct, tradeDeadline, exitRuleEnabled };
}

/** Calendar-day gap (UTC midnight) until `nextYmd` (YYYY-MM-DD). */
function computeUtcCalendarDaysUntil(nextYmd: string | null): number | null {
  if (nextYmd == null || nextYmd.length < 10) return null;
  const d = new Date(`${nextYmd}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return Math.round((d.getTime() - todayUtc.getTime()) / (24 * 60 * 60 * 1000));
}

function computePerformanceSinceFoundationPercent(
  currentPrice: number | null,
  listingPrice: number | null,
): number | null {
  if (currentPrice == null || listingPrice == null) return null;
  const lp = Number(listingPrice);
  const cp = Number(currentPrice);
  if (!Number.isFinite(lp) || !Number.isFinite(cp) || lp <= 0) return null;
  return roundAlphaMetric((cp / lp - 1) * 100);
}

async function fetchHoldingsRowsWithInvestmentMeta(db: Client, userId: string) {
  const core = `SELECT id, ticker, name, quantity, avg_acquisition_price, structure_tags, sector, category, account_type, provider_symbol, valuation_factor, expectation_category, earnings_summary_note`;
  const meta = `, listing_date, market_cap, listing_price, next_earnings_date, memo, is_bookmarked, instrument_meta_synced_at`;
  const shortTerm = `, stop_loss_pct, target_profit_pct, trade_deadline, exit_rule_enabled`;
  const from = ` FROM holdings WHERE user_id = ? AND quantity > 0 ORDER BY ticker`;
  const run = (frag: string) => db.execute({ sql: `${frag}${from}`, args: [userId] });

  try {
    return await run(`${core}${meta}${shortTerm}`);
  } catch (e) {
    if (holdingsMissingShortTermRulesColumns(e)) {
      try {
        return await run(`${core}${meta}`);
      } catch (e2) {
        if (!holdingsMissingInvestmentMeta(e2)) throw e2;
        return await run(`${core}`);
      }
    }
    if (holdingsMissingInvestmentMeta(e)) {
      try {
        return await run(`${core}${shortTerm}`);
      } catch (e2) {
        if (holdingsMissingShortTermRulesColumns(e2)) {
          return await run(`${core}`);
        }
        throw e2;
      }
    }
    throw e;
  }
}

type StockDraft = Omit<Stock, "weight"> & { structureTagsJson: string };

/** Loaded from `ticker_efficiency_metrics` for Rule of 40 / dynamic FCF Yield. */
export type TickerEfficiencyBundle = {
  revenueGrowth: number;
  fcfMargin: number;
  /** DB column `fcf_yield`（静的・手入力フォールバック） */
  fcfYieldStatic: number;
  ruleOf40: number;
  annualFcf: number | null;
  sharesOutstanding: number | null;
  /** 前期比較用（ACCUMULATE など）。未記録は null */
  priorRuleOf40: number | null;
};

type EcosystemEfficiencyRow = {
  ticker: unknown;
  revenue_growth?: unknown;
  fcf_margin?: unknown;
  fcf_yield?: unknown;
  fcf?: unknown;
  annual_fcf?: unknown;
  shares_outstanding?: unknown;
  rule_of_40?: unknown;
  prior_rule_of_40?: unknown;
};

function parsePercentOrNaN(raw: unknown): number {
  if (raw == null) return Number.NaN;
  const n = Number(raw);
  return Number.isFinite(n) ? n : Number.NaN;
}

function parseMoneyOrNaN(raw: unknown): number {
  if (raw == null) return Number.NaN;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : Number.NaN;
}

function computeRuleOf40(revenueGrowth: number, fcfMargin: number): number {
  if (!Number.isFinite(revenueGrowth) || !Number.isFinite(fcfMargin)) return Number.NaN;
  return revenueGrowth + fcfMargin;
}

/**
 * エコシステム行の財務指標: **`ticker_efficiency_metrics`（eff）を最優先**し、
 * 中央テーブルに行が無い・列が欠ける場合のみ `theme_ecosystem_members` のレガシー列を参照する。
 */
function ecosystemEfficiencyFromCentralThenMemberRow(
  eff: TickerEfficiencyBundle | null,
  row: Record<string, unknown>,
): {
  revenueGrowth: number;
  fcfMargin: number;
  storedFcfYieldPercent: number;
  ruleOf40: number;
  annualFcf: number | null;
  sharesOutstanding: number | null;
  priorRuleOf40: number | null;
} {
  const rgRow = parsePercentOrNaN(row["revenue_growth"]);
  const fmRow = parsePercentOrNaN(row["fcf_margin"]);
  const fyRow = parsePercentOrNaN(row["fcf_yield"]);
  const ruleRow = parsePercentOrNaN(row["rule_of_40"]);
  const priorRaw = row["prior_rule_of_40"];
  const priorRow =
    priorRaw != null && Number.isFinite(Number(priorRaw)) ? Number(priorRaw) : null;

  if (eff == null) {
    const rc = computeRuleOf40(rgRow, fmRow);
    const r40 = Number.isFinite(ruleRow) ? ruleRow : rc;
    return {
      revenueGrowth: rgRow,
      fcfMargin: fmRow,
      storedFcfYieldPercent: fyRow,
      ruleOf40: r40,
      annualFcf: null,
      sharesOutstanding: null,
      priorRuleOf40: priorRow,
    };
  }

  const revenueGrowth = Number.isFinite(eff.revenueGrowth) ? eff.revenueGrowth : rgRow;
  const fcfMargin = Number.isFinite(eff.fcfMargin) ? eff.fcfMargin : fmRow;
  const storedFcfYieldPercent = Number.isFinite(eff.fcfYieldStatic) ? eff.fcfYieldStatic : fyRow;
  const rc = computeRuleOf40(revenueGrowth, fcfMargin);
  const ruleOf40 = Number.isFinite(eff.ruleOf40)
    ? eff.ruleOf40
    : Number.isFinite(rc)
      ? rc
      : Number.isFinite(ruleRow)
        ? ruleRow
        : Number.NaN;

  const priorRuleOf40 =
    eff.priorRuleOf40 != null && Number.isFinite(eff.priorRuleOf40)
      ? eff.priorRuleOf40
      : priorRow;

  return {
    revenueGrowth,
    fcfMargin,
    storedFcfYieldPercent,
    ruleOf40,
    annualFcf: eff.annualFcf,
    sharesOutstanding: eff.sharesOutstanding,
    priorRuleOf40,
  };
}

/**
 * FCF Yield（%）≈ annual_fcf / (livePrice × diluted shares)。
 * 米国・日本の上場株で動的算出し、それ以外・欠損時は DB の静的 `fcf_yield` を返す。
 * 年次 FCF が負でも（マイナス Yield として）算出する。
 */
export function computeDynamicFcfYieldPercent(opts: {
  instrumentKind: TickerInstrumentKind;
  annualFcf: number | null | undefined;
  sharesOutstanding: number | null | undefined;
  livePrice: number | null | undefined;
  storedFcfYieldPercent: number;
}): number {
  const { instrumentKind, annualFcf, sharesOutstanding, livePrice, storedFcfYieldPercent } = opts;
  const dynamicKinds: TickerInstrumentKind[] = ["US_EQUITY", "JP_LISTED_EQUITY", "JP_INVESTMENT_TRUST"];
  if (dynamicKinds.includes(instrumentKind)) {
    const af = annualFcf != null ? Number(annualFcf) : Number.NaN;
    const sh = sharesOutstanding != null ? Number(sharesOutstanding) : Number.NaN;
    const px = livePrice != null ? Number(livePrice) : Number.NaN;
    if (Number.isFinite(af) && Number.isFinite(sh) && Number.isFinite(px) && sh > 0 && px > 0) {
      return (af / (px * sh)) * 100;
    }
  }
  return Number.isFinite(storedFcfYieldPercent) ? storedFcfYieldPercent : Number.NaN;
}

function tickerEfficiencyMissingPriorRuleColumn(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  const lower = msg.toLowerCase();
  return lower.includes("no such column") && lower.includes("prior_rule_of_40");
}

function tickerEfficiencyMissingExtendedColumns(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  const lower = msg.toLowerCase();
  if (!lower.includes("no such column")) return false;
  return (
    lower.includes("annual_fcf") ||
    lower.includes("shares_outstanding") ||
    lower.includes("rule_of_40") ||
    lower.includes("last_updated_at") ||
    lower.includes("source")
  );
}

function ecosystemMissingEfficiencyColumns(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  const lower = msg.toLowerCase();
  return (
    lower.includes("no such column") &&
    (lower.includes("revenue_growth") || lower.includes("fcf_margin") || lower.includes("fcf_yield"))
  );
}

function holdingsMissingInvestmentMeta(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  const lower = msg.toLowerCase();
  return lower.includes("no such column") && lower.includes("listing_date");
}

function holdingsMissingShortTermRulesColumns(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  const lower = msg.toLowerCase();
  return lower.includes("no such column") && lower.includes("stop_loss_pct");
}

function ecosystemMissingInvestmentMetaColumns(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  const lower = msg.toLowerCase();
  return lower.includes("no such column") && lower.includes("listing_date");
}

async function fetchEcosystemEfficiencyByTickerUpper(
  db: Client,
  tickers: string[],
): Promise<Map<string, TickerEfficiencyBundle>> {
  const out = new Map<string, TickerEfficiencyBundle>();
  const unique = [...new Set(tickers.map((t) => String(t ?? "").trim()).filter((t) => t.length > 0))];
  if (unique.length === 0) return out;
  try {
    const ph = unique.map(() => "?").join(",");
    // Prefer ticker-level table (shared across holdings + ecosystem).
    let rs;
    try {
      const sqlExtendedNoPrior = `SELECT ticker, revenue_growth, fcf_margin, fcf_yield, fcf,
                       annual_fcf, shares_outstanding, rule_of_40
                FROM ticker_efficiency_metrics
                WHERE ticker IN (${ph})`;
      const sqlMinimal = `SELECT ticker, revenue_growth, fcf_margin, fcf_yield, fcf
                FROM ticker_efficiency_metrics
                WHERE ticker IN (${ph})`;
      try {
        rs = await db.execute({
          sql: `SELECT ticker, revenue_growth, fcf_margin, fcf_yield, fcf,
                       annual_fcf, shares_outstanding, rule_of_40, prior_rule_of_40
                FROM ticker_efficiency_metrics
                WHERE ticker IN (${ph})`,
          args: unique,
        });
      } catch (e1) {
        if (tickerEfficiencyMissingPriorRuleColumn(e1)) {
          try {
            rs = await db.execute({ sql: sqlExtendedNoPrior, args: unique });
          } catch (e2) {
            if (!tickerEfficiencyMissingExtendedColumns(e2)) throw e2;
            rs = await db.execute({ sql: sqlMinimal, args: unique });
          }
        } else if (tickerEfficiencyMissingExtendedColumns(e1)) {
          rs = await db.execute({ sql: sqlMinimal, args: unique });
        } else {
          throw e1;
        }
      }
    } catch (eTickerTable) {
      // Fallback for older DBs: use theme_ecosystem_members columns when available.
      try {
        rs = await db.execute({
          sql: `SELECT ticker, revenue_growth, fcf_margin, fcf_yield, fcf
              , listing_date, market_cap, listing_price, next_earnings_date, memo, is_bookmarked, instrument_meta_synced_at FROM theme_ecosystem_members
              WHERE ticker IN (${ph})`,
          args: unique,
        });
      } catch (eEco) {
        if (!ecosystemMissingInvestmentMetaColumns(eEco)) throw eEco;
        rs = await db.execute({
          sql: `SELECT ticker, revenue_growth, fcf_margin, fcf_yield, fcf
              FROM theme_ecosystem_members
              WHERE ticker IN (${ph})`,
          args: unique,
        });
      }
    }
    for (const row of rs.rows as unknown as EcosystemEfficiencyRow[]) {
      const tk = String(row.ticker ?? "").trim();
      if (tk.length === 0) continue;
      const revenueGrowth = parsePercentOrNaN(row.revenue_growth);
      const fcfMargin = parsePercentOrNaN(row.fcf_margin);
      const fcfYieldStatic = parsePercentOrNaN(row.fcf_yield);
      const storedRule40 = parsePercentOrNaN(row.rule_of_40);
      const ruleFromParts = computeRuleOf40(revenueGrowth, fcfMargin);
      const ruleOf40 = Number.isFinite(storedRule40) ? storedRule40 : ruleFromParts;

      let annualFcf: number | null = null;
      const rawAf = row.annual_fcf;
      if (rawAf != null) {
        const n = Number(rawAf);
        if (Number.isFinite(n)) annualFcf = n;
      }

      let sharesOutstanding: number | null = null;
      const rawSh = row.shares_outstanding;
      if (rawSh != null) {
        const n = Number(rawSh);
        if (Number.isFinite(n) && n > 0) sharesOutstanding = n;
      }

      let priorRuleOf40: number | null = null;
      const rawPr = row.prior_rule_of_40;
      if (rawPr != null) {
        const n = Number(rawPr);
        if (Number.isFinite(n)) priorRuleOf40 = n;
      }

      out.set(tk.toUpperCase(), {
        revenueGrowth,
        fcfMargin,
        fcfYieldStatic,
        ruleOf40,
        annualFcf,
        sharesOutstanding,
        priorRuleOf40,
      });
    }
    return out;
  } catch (e) {
    if (ecosystemMissingEfficiencyColumns(e)) return out;
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("no such table") || msg.toLowerCase().includes("theme_ecosystem_members")) return out;
    throw e;
  }
}

/**
 * Parse human-ish valuation text into number (USD).
 * Examples:
 * - "$10B" / "10B" / "10 b" -> 10_000_000_000
 * - "$750M" -> 750_000_000
 * - "1.2T" -> 1_200_000_000_000
 * Returns NaN when unknown.
 */
function parseEstimatedValuationTextToNumber(raw: string | null): number {
  if (!raw) return Number.NaN;
  const s = raw.trim();
  if (s.length === 0) return Number.NaN;
  const m = s.replace(/,/g, "").match(/(-?\d+(?:\.\d+)?)\s*([KMBT])?/i);
  if (!m) return Number.NaN;
  const base = Number(m[1]);
  if (!Number.isFinite(base) || base <= 0) return Number.NaN;
  const suf = (m[2] ?? "").toUpperCase();
  const mult =
    suf === "K"
      ? 1_000
      : suf === "M"
        ? 1_000_000
        : suf === "B"
          ? 1_000_000_000
          : suf === "T"
            ? 1_000_000_000_000
            : 1;
  return base * mult;
}

function estimateFcfYieldPercent(input: { fcf: number; valuation: number }): number {
  const { fcf, valuation } = input;
  if (!Number.isFinite(fcf) || !Number.isFinite(valuation) || valuation <= 0) return Number.NaN;
  return (fcf / valuation) * 100;
}

function buildByTickerFromAlphaRows(rows: Iterable<Record<string, unknown>>): Map<string, AlphaPoint[]> {
  const byTickerDay = new Map<string, Map<string, AlphaPoint>>();
  for (const row of rows) {
    const tk = String(row["ticker"]).trim();
    if (tk.length === 0) continue;
    const ra = row["recorded_at"];
    if (ra == null) continue;
    const ymd = toYmd(String(ra));
    if (ymd.length !== 10) continue;
    const cp = row["close_price"];
    const pt: AlphaPoint = {
      alpha: Number(row["alpha_value"]),
      close: cp != null && Number.isFinite(Number(cp)) ? Number(cp) : null,
      observationYmd: ymd,
    };
    if (!byTickerDay.has(tk)) byTickerDay.set(tk, new Map());
    byTickerDay.get(tk)!.set(ymd, pt);
  }
  const out = new Map<string, AlphaPoint[]>();
  for (const [tk, dayMap] of byTickerDay) {
    const arr = [...dayMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, p]) => p);
    out.set(tk, arr);
  }
  return out;
}

/** 同一日複数行は後勝ち。日付昇順の `DatedAlphaRow[]` をティッカー別に構築。 */
function buildByTickerDatedAlphaRows(rows: Iterable<Record<string, unknown>>): Map<string, DatedAlphaRow[]> {
  const byDay = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const tk = String(row["ticker"]);
    const ra = row["recorded_at"];
    if (ra == null) continue;
    const ymd = String(ra).trim().slice(0, 10);
    if (ymd.length !== 10) continue;
    const alpha = Number(row["alpha_value"]);
    if (!byDay.has(tk)) byDay.set(tk, new Map());
    byDay.get(tk)!.set(ymd, alpha);
  }
  const out = new Map<string, DatedAlphaRow[]>();
  for (const [tk, m] of byDay) {
    const arr = [...m.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([ymd, alphaValue]) => ({ recordedAt: ymd, alphaValue }));
    out.set(tk, arr);
  }
  return out;
}

/** 保有ごとに、日足の初日〜末日（adj または close のペア）に基づく長期変化率を事前取得。`fast` では空。 */
async function prefetchChartListedTotalReturnByHoldingKey(
  rows: HoldingQueryRow[],
  options?: { fast?: boolean },
): Promise<Map<string, number | null>> {
  const map = new Map<string, number | null>();
  if (options?.fast === true || rows.length === 0) return map;
  const seen = new Set<string>();
  const jobs: { key: string; ticker: string; provider: string | null }[] = [];
  for (const row of rows) {
    const ticker = String(row.ticker ?? "").trim();
    if (!ticker) continue;
    const provider =
      row.provider_symbol != null && String(row.provider_symbol).length > 0 ? String(row.provider_symbol) : null;
    const key = holdingLivePriceKey(ticker, provider);
    if (seen.has(key)) continue;
    seen.add(key);
    jobs.push({ key, ticker, provider });
  }
  const settled = await Promise.allSettled(
    jobs.map(({ key, ticker, provider }) =>
      fetchChartTotalReturnPercentSinceFirstDailyBar(ticker, provider).then((pct) => ({ key, pct })),
    ),
  );
  for (const r of settled) {
    if (r.status !== "fulfilled") continue;
    map.set(r.value.key, r.value.pct);
  }
  return map;
}

function buildDraftsFromHoldingRows(
  rows: HoldingQueryRow[],
  byTicker: Map<string, AlphaPoint[]>,
  researchByTicker: Map<
    string,
    {
      nextEarningsDate: string | null;
      exDividendDate: string | null;
      recordDate: string | null;
      annualDividendRate: number | null;
      dividendYieldPercent: number | null;
      trailingPe: number | null;
      forwardPe: number | null;
      trailingEps: number | null;
      forwardEps: number | null;
    }
  >,
  fxUsdJpy: number,
  hybridPriceByHoldingKey: Map<string, HybridHoldingPriceSnapshot>,
  efficiencyByTickerUpper: Map<string, TickerEfficiencyBundle>,
  liveAlphaCtx: LiveAlphaBenchmarkContext,
  chartListedReturnPctByHoldingKey: Map<string, number | null>,
): StockDraft[] {
  return rows.map((row) => {
    const id = String(row.id);
    const ticker = String(row.ticker);
    const series = byTicker.get(ticker) ?? [];
    const alphaHistory = series.map((p) => p.alpha);
    const latestAlphaObservationYmd =
      series.length > 0 ? series[series.length - 1]!.observationYmd : null;
    const closesForDrawdown = series.map((p) => p.close);
    const seriesClose = latestCloseFromSeries(series);
    const providerSymbol =
      row.provider_symbol != null && String(row.provider_symbol).length > 0 ? String(row.provider_symbol) : null;
    const liveKey = holdingLivePriceKey(ticker, providerSymbol);
    const hybrid = hybridPriceByHoldingKey.get(liveKey);
    const fromHybrid =
      hybrid != null && Number.isFinite(hybrid.price) && hybrid.price > 0 ? hybrid : null;
    const currentPrice =
      fromHybrid != null ? fromHybrid.price : seriesClose;
    const alphaDeviationZ = computeAlphaDeviationZScore(alphaHistory);
    const drawdownFromHigh90dPct = computePriceDrawdownFromHighPercent(closesForDrawdown, currentPrice);
    const priceSource: "live" | "close" = fromHybrid != null ? fromHybrid.source : "close";
    const lastUpdatedAt: string | null = fromHybrid != null ? fromHybrid.asOf : null;
    const qty = Number(row.quantity);
    const accountTypeRaw = row.account_type != null ? String(row.account_type).trim() : "";
    const accountType = accountTypeRaw === "NISA" ? "NISA" : accountTypeRaw === "特定" ? "特定" : null;
    const valuationFactor =
      row.valuation_factor != null && Number.isFinite(Number(row.valuation_factor))
        ? Number(row.valuation_factor)
        : 1;
    const marketValue = normalizedHoldingValueJpyWithFx({
      ticker,
      quantity: qty,
      currentPrice,
      valuationFactor,
      fxUsdJpy,
    });
    const rawStructureTags = row.structure_tags;
    const tagsJson = rawStructureTags == null ? "[]" : String(rawStructureTags);
    const sector = parseSector(row.sector);
    const instrumentKind = classifyTickerInstrument(ticker);
    const countryName = instrumentKind === "US_EQUITY" ? "米国" : "日本";
    const previousClose = derivePreviousCloseForLiveAlpha({
      currentPrice,
      hybridChangePct: fromHybrid != null && fromHybrid.changePct != null ? fromHybrid.changePct : null,
      series,
    });
    const benchmarkDayChangePercent =
      instrumentKind === "US_EQUITY" ? liveAlphaCtx.usBenchmarkChangePct : liveAlphaCtx.jpBenchmarkChangePct;
    const liveAlphaBenchmarkTicker =
      instrumentKind === "US_EQUITY" ? liveAlphaCtx.usBenchmarkTicker : liveAlphaCtx.jpBenchmarkTicker;
    const listingDate = parseOptionalIsoDatePrefix(row.listing_date ?? row.founded_date);
    const marketCap = parseOptionalFiniteNumberMeta(row.market_cap);
    const listingPriceDb = parseOptionalFiniteNumberMeta(row.listing_price);
    const memoDb = row.memo != null && String(row.memo).trim().length > 0 ? String(row.memo) : null;
    const isBookmarked = parseBookmarkFlag(row.is_bookmarked);
    const dbNextEarnings = parseOptionalIsoDatePrefix(row.next_earnings_date);

    const research = researchByTicker.get(ticker.toUpperCase()) ?? null;
    const nextEarningsDate = dbNextEarnings ?? research?.nextEarningsDate ?? null;
    const exDividendDate = research?.exDividendDate ?? null;
    const recordDate = research?.recordDate ?? null;
    const annualDividendRate = research?.annualDividendRate ?? null;
    const dividendYieldPercent = research?.dividendYieldPercent ?? null;
    const trailingPe = research?.trailingPe ?? null;
    const forwardPe = research?.forwardPe ?? null;
    const trailingEps = research?.trailingEps ?? null;
    const forwardEps = research?.forwardEps ?? null;
    const daysToEarnings = computeUtcCalendarDaysUntil(nextEarningsDate);
    const daysToExDividend = exDividendDate != null ? (() => {
      const d = new Date(`${exDividendDate}T00:00:00.000Z`);
      if (Number.isNaN(d.getTime())) return null;
      const now = new Date();
      const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      return Math.round((d.getTime() - todayUtc.getTime()) / (24 * 60 * 60 * 1000));
    })() : null;
    const daysToRecordDate = recordDate != null ? (() => {
      const d = new Date(`${recordDate}T00:00:00.000Z`);
      if (Number.isNaN(d.getTime())) return null;
      const now = new Date();
      const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      return Math.round((d.getTime() - todayUtc.getTime()) / (24 * 60 * 60 * 1000));
    })() : null;
    const avgAcquisitionPrice = parseAvgAcquisitionPrice(row.avg_acquisition_price);
    const { local: unrealizedPnlLocal, percent: unrealizedPnlPercent } = computeUnrealizedPnlLocal(
      currentPrice,
      avgAcquisitionPrice,
      qty,
      valuationFactor,
    );
    const unrealizedPnlJpy =
      quoteCurrencyForInstrument(instrumentKind) === "JPY" ? unrealizedPnlLocal : unrealizedPnlLocal * fxUsdJpy;
    const dayChangePercent =
      fromHybrid != null && fromHybrid.changePct != null && Number.isFinite(fromHybrid.changePct)
        ? fromHybrid.changePct
        : (() => {
            const two = lastTwoClosesFromSeries(series);
            const dayChangeRaw = two != null ? dailyReturnPercent(two.prevClose, two.latestClose) : null;
            return dayChangeRaw != null && Number.isFinite(dayChangeRaw) ? roundAlphaMetric(dayChangeRaw) : null;
          })();

    const eff = efficiencyByTickerUpper.get(ticker.trim().toUpperCase()) ?? null;
    const revenueGrowth = eff?.revenueGrowth ?? Number.NaN;
    const fcfMargin = eff?.fcfMargin ?? Number.NaN;
    const ruleOf40 = eff?.ruleOf40 ?? computeRuleOf40(revenueGrowth, fcfMargin);
    const storedYield = eff?.fcfYieldStatic ?? Number.NaN;
    const fcfYield = computeDynamicFcfYieldPercent({
      instrumentKind,
      annualFcf: eff?.annualFcf ?? null,
      sharesOutstanding: eff?.sharesOutstanding ?? null,
      livePrice: currentPrice,
      storedFcfYieldPercent: storedYield,
    });

    const expectationCategory = parseExpectationCategory(row.expectation_category);
    const judgment = computeInvestmentJudgment({
      ruleOf40,
      fcfYield,
      narrative: expectationCategoryToInvestmentNarrative(expectationCategory),
      priorRuleOf40: eff?.priorRuleOf40 ?? null,
      revenueGrowth: Number.isFinite(revenueGrowth) ? revenueGrowth : null,
    });

    const chartListedPct = chartListedReturnPctByHoldingKey.get(liveKey) ?? null;
    const performanceSinceFoundation =
      chartListedPct != null && Number.isFinite(chartListedPct)
        ? chartListedPct
        : computePerformanceSinceFoundationPercent(currentPrice, listingPriceDb);

    const shortTermExit = parseShortTermExitRulePercents(row);

    return {
      id,
      ticker,
      name: row.name != null ? String(row.name) : "",
      priceSource,
      lastUpdatedAt,
      accountType,
      countryName,
      listingDate,
      marketCap,
      listingPrice: listingPriceDb,
      memo: memoDb,
      isBookmarked,
      stopLossPct: shortTermExit.stopLossPct,
      targetProfitPct: shortTermExit.targetProfitPct,
      tradeDeadline: shortTermExit.tradeDeadline,
      exitRuleEnabled: shortTermExit.exitRuleEnabled,
      performanceSinceFoundation,
      nextEarningsDate,
      daysToEarnings,
      exDividendDate,
      daysToExDividend,
      recordDate,
      daysToRecordDate,
      annualDividendRate,
      dividendYieldPercent,
      trailingPe,
      forwardPe,
      trailingEps,
      forwardEps,
      tag: rawStructureTags == null ? "" : themeFromStructureTags(tagsJson),
      alphaHistory,
      latestAlphaObservationYmd,
      alphaDeviationZ,
      drawdownFromHigh90dPct,
      quantity: qty,
      category: asCategory(String(row.category)),
      avgAcquisitionPrice,
      unrealizedPnlLocal,
      unrealizedPnlJpy,
      unrealizedPnlPercent,
      dayChangePercent,
      instrumentKind,
      secondaryTag: sectorFromStructureTags(tagsJson),
      sector,
      currentPrice,
      marketValue,
      valuationFactor,
      providerSymbol,
      structureTagsJson: tagsJson,
      expectationCategory,
      earningsSummaryNote: parseEarningsSummaryNote(row.earnings_summary_note),
      revenueGrowth,
      fcfMargin,
      fcfYield,
      ruleOf40,
      judgmentStatus: judgment.status,
      judgmentReason: judgment.reason,
      previousClose,
      benchmarkDayChangePercent,
      liveAlphaBenchmarkTicker,
    };
  });
}

function finalizeStocksFromDrafts(drafts: StockDraft[], totalMarketValue: number): Stock[] {
  return drafts.map((d) => {
    const mv = sanitizeMarketValueForAggregation(d.marketValue);
    const { structureTagsJson: _s, ...rest } = d;
    return {
      ...rest,
      marketValue: mv,
      weight: totalMarketValue > 0 ? Math.round((mv / totalMarketValue) * 10000) / 100 : 0,
    };
  });
}

function datedAlphaRowsByTickerUpper(byTickerDated: Map<string, DatedAlphaRow[]>): Map<string, DatedAlphaRow[]> {
  const byUpper = new Map<string, DatedAlphaRow[]>();
  for (const [k, v] of byTickerDated) {
    byUpper.set(k.toUpperCase(), v);
  }
  return byUpper;
}

function effectiveTickerFromEcoSparklineRow(row: Record<string, unknown>): string {
  const isUnlisted = Number(row["is_unlisted"]) === 1;
  const t = String(row["ticker"] ?? "").trim();
  const proxy = row["proxy_ticker"] != null ? String(row["proxy_ticker"]).trim() : "";
  if (isUnlisted && proxy.length > 0) return proxy;
  return t;
}

async function fetchEcosystemSparklineRowsByThemeIds(
  db: Client,
  themeIds: string[],
): Promise<Map<string, Record<string, unknown>[]>> {
  const out = new Map<string, Record<string, unknown>[]>();
  if (themeIds.length === 0) return out;
  try {
    const ph = themeIds.map(() => "?").join(",");
    let rs;
    try {
      rs = await db.execute({
        sql: `SELECT theme_id, ticker, is_unlisted, proxy_ticker, is_major_player
            , listing_date, market_cap, listing_price, next_earnings_date, memo, is_bookmarked, instrument_meta_synced_at FROM theme_ecosystem_members
            WHERE theme_id IN (${ph})
            ORDER BY theme_id ASC, field ASC, ticker ASC`,
        args: themeIds,
      });
    } catch (eSpark) {
      if (!ecosystemMissingInvestmentMetaColumns(eSpark)) throw eSpark;
      rs = await db.execute({
        sql: `SELECT theme_id, ticker, is_unlisted, proxy_ticker, is_major_player
            FROM theme_ecosystem_members
            WHERE theme_id IN (${ph})
            ORDER BY theme_id ASC, field ASC, ticker ASC`,
        args: themeIds,
      });
    }
    for (const row of rs.rows as Record<string, unknown>[]) {
      const tid = String(row["theme_id"] ?? "");
      if (tid.length === 0) continue;
      const arr = out.get(tid) ?? [];
      arr.push(row);
      out.set(tid, arr);
    }
    return out;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("no such table") || msg.toLowerCase().includes("theme_ecosystem_members")) {
      return out;
    }
    throw e;
  }
}

/**
 * ダッシュボードのテーマカード用に、保有またはエコシステム加重の「構造トレンド」累積系列（~90 日）を一括算出する。
 */
async function computeThemeStructuralSparklinesForDashboard(
  db: Client,
  userId: string,
  allThemes: InvestmentThemeRecord[],
  drafts: StockDraft[],
): Promise<ThemeStructuralSparklineEntry[]> {
  if (allThemes.length === 0) return [];

  const windowStartYmd = ymdDaysAgoUtc(THEME_STRUCTURAL_TREND_LOOKBACK_DAYS);
  const themeIds = [...new Set(allThemes.map((t) => String(t.id).trim()).filter((id) => id.length > 0))];
  const ecoByTheme = await fetchEcosystemSparklineRowsByThemeIds(db, themeIds);

  const tickers = new Set<string>();
  for (const d of drafts) {
    const tk = String(d.ticker ?? "").trim();
    if (tk.length > 0) tickers.add(tk);
  }
  for (const rows of ecoByTheme.values()) {
    for (const row of rows) {
      const eff = effectiveTickerFromEcoSparklineRow(row);
      if (eff.length > 0) tickers.add(eff);
    }
  }

  const alphaRows =
    tickers.size > 0 ? await fetchAlphaHistoryRowsForTickers(db, userId, [...tickers]) : [];
  const byTickerDated = buildByTickerDatedAlphaRows(alphaRows);
  const byTickerUpper = datedAlphaRowsByTickerUpper(byTickerDated);

  const out: ThemeStructuralSparklineEntry[] = [];

  for (const theme of allThemes) {
    const matchingDrafts = drafts.filter((d) =>
      portfolioThemeTagMatchesThemePage(themeFromStructureTags(d.structureTagsJson), theme.name),
    );

    const structuralTrendInputs: { weight: number; dailyAlphaByYmd: Map<string, number> }[] = [];

    if (matchingDrafts.length > 0) {
      const mergedByTickerUpper = new Map<
        string,
        { weight: number; tickerKey: string }
      >();
      for (const d of matchingDrafts) {
        const tk = String(d.ticker ?? "").trim();
        if (tk.length === 0) continue;
        const u = tk.toUpperCase();
        const w = sanitizeMarketValueForAggregation(d.marketValue);
        const prev = mergedByTickerUpper.get(u);
        mergedByTickerUpper.set(u, {
          weight: (prev?.weight ?? 0) + w,
          tickerKey: tk,
        });
      }
      for (const { weight, tickerKey } of mergedByTickerUpper.values()) {
        if (weight <= 0) continue;
        const dated = byTickerDated.get(tickerKey) ?? byTickerUpper.get(tickerKey.toUpperCase()) ?? [];
        const filtered = dated.filter((r) => toYmd(r.recordedAt) >= windowStartYmd);
        if (filtered.length === 0) continue;
        const dailyAlphaByYmd = new Map<string, number>();
        for (const r of filtered) {
          dailyAlphaByYmd.set(toYmd(r.recordedAt), r.alphaValue);
        }
        structuralTrendInputs.push({ weight, dailyAlphaByYmd });
      }
    } else {
      const ecoRows = ecoByTheme.get(theme.id) ?? [];
      const tickerWeights = new Map<string, number>();
      const tickerSqlByUpper = new Map<string, string>();
      for (const raw of ecoRows) {
        const eff = effectiveTickerFromEcoSparklineRow(raw);
        if (eff.length === 0) continue;
        const u = eff.toUpperCase();
        if (!tickerSqlByUpper.has(u)) tickerSqlByUpper.set(u, eff);
        const w = Number(raw["is_major_player"]) === 1 ? 2 : 1;
        tickerWeights.set(u, (tickerWeights.get(u) ?? 0) + w);
      }
      for (const [u, weight] of tickerWeights) {
        const sqlTk = tickerSqlByUpper.get(u) ?? u;
        const dated = byTickerDated.get(sqlTk) ?? byTickerUpper.get(u) ?? [];
        const filtered = dated.filter((r) => toYmd(r.recordedAt) >= windowStartYmd);
        if (filtered.length === 0) continue;
        if (weight <= 0) continue;
        const dailyAlphaByYmd = new Map<string, number>();
        for (const r of filtered) {
          dailyAlphaByYmd.set(toYmd(r.recordedAt), r.alphaValue);
        }
        structuralTrendInputs.push({ weight, dailyAlphaByYmd });
      }
    }

    const series = computeThemeStructuralTrendCumulativeFromWeightedDailyAlphas(
      structuralTrendInputs,
      windowStartYmd,
    );
    out.push({
      themeId: theme.id,
      cumulativeValues: series.map((p) => p.cumulative),
    });
  }

  return out;
}

function computeThemeAverageUnrealizedPnlPercent(stocks: Stock[]): number {
  const withBasis = stocks.filter(
    (s) => s.avgAcquisitionPrice != null && s.avgAcquisitionPrice > 0 && s.quantity > 0,
  );
  if (withBasis.length === 0) return 0;
  const sum = withBasis.reduce((a, s) => a + s.unrealizedPnlPercent, 0);
  return roundAlphaMetric(sum / withBasis.length);
}

/**
 * `investment_themes` からテーマ行を取得（テーブル未作成時は null）。
 */
export async function fetchInvestmentThemeRecord(
  db: Client,
  userId: string,
  themeName: string,
): Promise<InvestmentThemeRecord | null> {
  try {
    const rs = await db.execute({
      sql: `SELECT id, user_id, name, description, goal, created_at
            FROM investment_themes
            WHERE user_id = ? AND name = ?
            LIMIT 1`,
      args: [userId, themeName],
    });
    if (rs.rows.length === 0) return null;
    const row = rs.rows[0]!;
    return {
      id: String(row.id),
      userId: String(row.user_id),
      name: String(row.name),
      description: row.description != null ? String(row.description) : null,
      goal: row.goal != null ? String(row.goal) : null,
      createdAt: String(row.created_at),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("no such table") || msg.toLowerCase().includes("investment_themes")) {
      return null;
    }
    throw e;
  }
}

async function enrichEcosystemMemberRow(
  db: Client,
  userId: string,
  row: Record<string, unknown>,
  portfolioTickerSet: Set<string>,
  themeCreatedAt: string | null,
  researchByTicker: Map<
    string,
    {
      nextEarningsDate: string | null;
      exDividendDate: string | null;
      recordDate: string | null;
      annualDividendRate: number | null;
      dividendYieldPercent: number | null;
      trailingPe: number | null;
      forwardPe: number | null;
      trailingEps: number | null;
      forwardEps: number | null;
    }
  >,
  efficiencyByTickerUpper: Map<string, TickerEfficiencyBundle>,
  options?: { fast?: boolean },
): Promise<ThemeEcosystemWatchItem> {
  const id = String(row["id"]);
  const themeId = String(row["theme_id"]);
  const ticker = String(row["ticker"]).trim();
  const isUnlisted = Number(row["is_unlisted"]) === 1;
  const proxyTickerRaw = row["proxy_ticker"] != null ? String(row["proxy_ticker"]).trim() : "";
  const proxyTicker = proxyTickerRaw.length > 0 ? proxyTickerRaw : null;
  const estimatedIpoDate =
    row["estimated_ipo_date"] != null && String(row["estimated_ipo_date"]).trim().length > 0
      ? String(row["estimated_ipo_date"]).trim()
      : null;
  const estimatedValuation =
    row["estimated_valuation"] != null && String(row["estimated_valuation"]).trim().length > 0
      ? String(row["estimated_valuation"]).trim()
      : null;
  const lastRoundValuationRaw = row["last_round_valuation"];
  const lastRoundValuation =
    lastRoundValuationRaw != null && Number.isFinite(Number(lastRoundValuationRaw)) && Number(lastRoundValuationRaw) > 0
      ? Number(lastRoundValuationRaw)
      : null;
  const privateCreditBacking =
    row["private_credit_backing"] != null && String(row["private_credit_backing"]).trim().length > 0
      ? String(row["private_credit_backing"]).trim()
      : null;
  const observationNotes =
    row["observation_notes"] != null && String(row["observation_notes"]).trim().length > 0
      ? String(row["observation_notes"]).trim()
      : null;
  const adoptionStage = parseAdoptionStage(row["adoption_stage"]);
  const adoptionStageRationale =
    row["adoption_stage_rationale"] != null && String(row["adoption_stage_rationale"]).trim().length > 0
      ? String(row["adoption_stage_rationale"]).trim()
      : null;

  const holderTags = parseJsonTextArray(row["holder_tags"]);
  const dividendMonths = parseJsonIntArray(row["dividend_months"]);
  const defensiveStrength =
    row["defensive_strength"] != null && String(row["defensive_strength"]).trim().length > 0
      ? String(row["defensive_strength"]).trim()
      : null;

  const listingDateEco = parseOptionalIsoDatePrefix(row["listing_date"] ?? row["founded_date"]);
  const marketCapEco = parseOptionalFiniteNumberMeta(row["market_cap"]);
  const listingPriceEco = parseOptionalFiniteNumberMeta(row["listing_price"]);
  const memoEco =
    row["memo"] != null && String(row["memo"]).trim().length > 0 ? String(row["memo"]).trim() : null;
  const isBookmarkedEco = parseBookmarkFlag(row["is_bookmarked"]);
  const dbNextEarningsEco = parseOptionalIsoDatePrefix(row["next_earnings_date"]);

  const effectiveTicker = isUnlisted ? (proxyTicker ?? "") : ticker;
  const companyName = row["company_name"] != null ? String(row["company_name"]) : ticker;
  const field = row["field"] != null ? String(row["field"]) : "";
  const role = row["role"] != null ? String(row["role"]) : "";
  const isMajorPlayer = Number(row["is_major_player"]) === 1;
  const inPortfolio = effectiveTicker.length > 0 ? portfolioTickerSet.has(effectiveTicker.toUpperCase()) : false;
  const fast = options?.fast === true;
  const rawObs = row["observation_started_at"];
  const observationStartedAt =
    rawObs != null && String(rawObs).trim().length >= 10 ? String(rawObs).trim().slice(0, 10) : null;

  const instrumentKind = classifyTickerInstrument(effectiveTicker.length > 0 ? effectiveTicker : ticker);
  const countryName = instrumentKind === "US_EQUITY" ? "米国" : "日本";
  const researchKey = effectiveTicker.length > 0 ? effectiveTicker.toUpperCase() : ticker.toUpperCase();
  const research = researchByTicker.get(researchKey) ?? null;
  const nextEarningsDate = dbNextEarningsEco ?? research?.nextEarningsDate ?? null;
  const exDividendDate = research?.exDividendDate ?? null;
  const recordDate = research?.recordDate ?? null;
  const annualDividendRate = research?.annualDividendRate ?? null;
  const dividendYieldPercent = research?.dividendYieldPercent ?? null;
  const trailingPe = research?.trailingPe ?? null;
  const forwardPe = research?.forwardPe ?? null;
  const trailingEps = research?.trailingEps ?? null;
  const forwardEps = research?.forwardEps ?? null;
  const daysToEarnings = computeUtcCalendarDaysUntil(nextEarningsDate);
  const daysToExDividend =
    exDividendDate != null
      ? (() => {
          const d = new Date(`${exDividendDate}T00:00:00.000Z`);
          if (Number.isNaN(d.getTime())) return null;
          const now = new Date();
          const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
          return Math.round((d.getTime() - todayUtc.getTime()) / (24 * 60 * 60 * 1000));
        })()
      : null;
  const daysToRecordDate =
    recordDate != null
      ? (() => {
          const d = new Date(`${recordDate}T00:00:00.000Z`);
          if (Number.isNaN(d.getTime())) return null;
          const now = new Date();
          const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
          return Math.round((d.getTime() - todayUtc.getTime()) / (24 * 60 * 60 * 1000));
        })()
      : null;

  const histRs =
    effectiveTicker.length > 0
      ? await db.execute({
          sql: `SELECT alpha_value, close_price, recorded_at FROM alpha_history
                WHERE user_id = ? AND ticker = ? AND benchmark_ticker = ?
                ORDER BY recorded_at ASC`,
          args: [userId, effectiveTicker, defaultBenchmarkTickerForTicker(effectiveTicker)],
        })
      : { rows: [] as Record<string, unknown>[] };

  const byDay = new Map<string, number>();
  for (const r of histRs.rows) {
    const ra = r["recorded_at"];
    if (ra == null) continue;
    const ymd = String(ra).trim().slice(0, 10);
    if (ymd.length !== 10) continue;
    const av = Number(r["alpha_value"]);
    byDay.set(ymd, av);
  }
  let datedRows: DatedAlphaRow[] = [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([recordedAt, alphaValue]) => ({ recordedAt, alphaValue }));

  let lastClose: number | null = null;
  const lastHist = histRs.rows[histRs.rows.length - 1];
  if (lastHist?.close_price != null && Number.isFinite(Number(lastHist.close_price))) {
    lastClose = Number(lastHist.close_price);
  }

  if (datedRows.length < 2) {
    if (effectiveTicker.length > 0) {
      if (!(fast && !inPortfolio)) {
        const bench = defaultBenchmarkTickerForTicker(effectiveTicker);
        const live = await fetchRecentDatedDailyAlphasVsBenchmark(effectiveTicker, 120, bench, null);
        if (live.rows.length >= 2) {
          datedRows = live.rows;
          if (live.lastClose != null && Number.isFinite(live.lastClose) && live.lastClose > 0) {
            lastClose = live.lastClose;
          }
        } else if (live.rows.length > 0 && datedRows.length === 0) {
          datedRows = live.rows;
          if (live.lastClose != null && Number.isFinite(live.lastClose) && live.lastClose > 0) {
            lastClose = live.lastClose;
          }
        }
      }
    }
  }

  const startDate =
    observationStartedAt != null && observationStartedAt.length === 10
      ? observationStartedAt
      : themeCreatedAt != null && themeCreatedAt.trim().length > 0
        ? themeCreatedAt.trim()
        : datedRows[0] != null
          ? datedRows[0]!.recordedAt.slice(0, 10)
          : "1970-01-01";

  const cumPoints = calculateCumulativeAlpha(datedRows, startDate);
  const alphaHistory = cumPoints.map((p) => p.cumulative);
  const latestAlpha = alphaHistory.length > 0 ? alphaHistory[alphaHistory.length - 1]! : null;
  const alphaObservationStartDate = cumPoints[0]?.date ?? null;

  /**
   * Last 列: エコシステム銘柄も保有と同様、ライブ quote を優先し、失敗時は直近日足終値へフォールバック。
   * fast スケルトンでは外部 I/O を避け、DB/既存 Alpha 由来の lastClose のみ（大量ティッカーでタイムアウトしにくくする）。
   */
  let displayPrice: number | null = lastClose;
  if (effectiveTicker.length > 0 && !fast) {
    const ql = await fetchLiveQuoteSnapshot(effectiveTicker, null);
    if (ql != null && Number.isFinite(ql.price) && ql.price > 0) {
      displayPrice = ql.price;
    } else {
      const day = await fetchLatestPrice(effectiveTicker, null);
      if (day != null && Number.isFinite(day.close) && day.close > 0) {
        displayPrice = day.close;
      }
    }
  }

  const dailyAlphas = datedRows.map((d) => d.alphaValue);
  const alphaDeviationZ = computeAlphaDeviationZScore(dailyAlphas);

  const closeSeriesFromDb: number[] = [];
  for (const r of histRs.rows) {
    const cp = r["close_price"];
    const n = cp != null ? Number(cp) : NaN;
    if (Number.isFinite(n) && n > 0) closeSeriesFromDb.push(n);
  }
  let closesForDrawdown: (number | null)[] = closeSeriesFromDb;
  if (!fast && closeSeriesFromDb.length < 25 && effectiveTicker.length > 0) {
    try {
      const bars = await fetchPriceHistory(effectiveTicker, 110, null);
      if (bars.length >= 8) {
        closesForDrawdown = bars.map((b) => b.close);
      }
    } catch {
      /* keep DB closes */
    }
  }
  const drawdownFromHigh90dPct = computePriceDrawdownFromHighPercent(closesForDrawdown, displayPrice);

  const rawKept = row["is_kept"];
  const isKept =
    rawKept != null && String(rawKept).trim() !== "" ? Number(rawKept) === 1 : false;

  const effListedKey = ticker.trim().toUpperCase();
  const eff = !isUnlisted ? efficiencyByTickerUpper.get(effListedKey) ?? null : null;
  const fcf = parseMoneyOrNaN(row["fcf"]);

  let revenueGrowth: number;
  let fcfMargin: number;
  let storedFcfYield: number;
  let ruleOf40: number;
  let annualFcfForDynamic: number | null;
  let sharesForDynamic: number | null;
  let priorRuleOf40: number | null;

  if (isUnlisted) {
    revenueGrowth = parsePercentOrNaN(row["revenue_growth"]);
    fcfMargin = parsePercentOrNaN(row["fcf_margin"]);
    storedFcfYield = parsePercentOrNaN(row["fcf_yield"]);
    const ruleRow = parsePercentOrNaN(row["rule_of_40"]);
    const rc = computeRuleOf40(revenueGrowth, fcfMargin);
    ruleOf40 = Number.isFinite(ruleRow) ? ruleRow : rc;
    annualFcfForDynamic = null;
    sharesForDynamic = null;
    priorRuleOf40 = null;
  } else {
    const merged = ecosystemEfficiencyFromCentralThenMemberRow(eff, row as Record<string, unknown>);
    revenueGrowth = merged.revenueGrowth;
    fcfMargin = merged.fcfMargin;
    storedFcfYield = merged.storedFcfYieldPercent;
    ruleOf40 = merged.ruleOf40;
    annualFcfForDynamic = merged.annualFcf;
    sharesForDynamic = merged.sharesOutstanding;
    priorRuleOf40 = merged.priorRuleOf40;
  }

  const valuationForUnlisted = (() => {
    if (!isUnlisted) return Number.NaN;
    if (lastRoundValuation != null && Number.isFinite(lastRoundValuation) && lastRoundValuation > 0) return lastRoundValuation;
    return parseEstimatedValuationTextToNumber(estimatedValuation);
  })();
  const estimatedFcfYield = estimateFcfYieldPercent({ fcf, valuation: valuationForUnlisted });
  const fcfYield = isUnlisted
    ? Number.isFinite(storedFcfYield)
      ? storedFcfYield
      : estimatedFcfYield
    : computeDynamicFcfYieldPercent({
        instrumentKind,
        annualFcf: annualFcfForDynamic,
        sharesOutstanding: sharesForDynamic,
        livePrice: displayPrice,
        storedFcfYieldPercent: storedFcfYield,
      });

  const expectationCategoryEco = parseExpectationCategory(row["expectation_category"]);
  const judgmentEco = computeInvestmentJudgment({
    ruleOf40,
    fcfYield,
    narrative: expectationCategoryToInvestmentNarrative(expectationCategoryEco),
    priorRuleOf40,
    revenueGrowth: Number.isFinite(revenueGrowth) ? revenueGrowth : null,
  });

  let performanceSinceFoundation: number | null = null;
  if (!fast && !isUnlisted && effectiveTicker.length > 0) {
    const chartPct = await fetchChartTotalReturnPercentSinceFirstDailyBar(effectiveTicker, null);
    if (chartPct != null && Number.isFinite(chartPct)) {
      performanceSinceFoundation = chartPct;
    }
  }
  if (performanceSinceFoundation == null) {
    performanceSinceFoundation = computePerformanceSinceFoundationPercent(displayPrice, listingPriceEco);
  }

  return {
    id,
    themeId,
    ticker,
    isUnlisted,
    proxyTicker,
    estimatedIpoDate,
    estimatedValuation,
    lastRoundValuation,
    privateCreditBacking,
    observationNotes,
    companyName,
    field,
    role,
    isMajorPlayer,
    inPortfolio,
    countryName,
    instrumentKind,
    listingDate: listingDateEco,
    marketCap: marketCapEco,
    listingPrice: listingPriceEco,
    memo: memoEco,
    isBookmarked: isBookmarkedEco,
    performanceSinceFoundation,
    nextEarningsDate,
    daysToEarnings,
    exDividendDate,
    daysToExDividend,
    recordDate,
    daysToRecordDate,
    annualDividendRate,
    dividendYieldPercent,
    trailingPe,
    forwardPe,
    trailingEps,
    forwardEps,
    observationStartedAt,
    alphaHistory,
    alphaDailyHistory: dailyAlphas,
    currentPrice: displayPrice,
    latestAlpha,
    alphaObservationStartDate,
    alphaDeviationZ,
    drawdownFromHigh90dPct,
    adoptionStage,
    adoptionStageRationale,
    expectationCategory: expectationCategoryEco,
    holderTags,
    dividendMonths,
    defensiveStrength,
    isKept,
    revenueGrowth,
    fcfMargin,
    fcfYield,
    ruleOf40,
    judgmentStatus: judgmentEco.status,
    judgmentReason: judgmentEco.reason,
  };
}

function ecosystemMissingAdoptionColumns(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  const lower = msg.toLowerCase();
  return (
    lower.includes("no such column") &&
    (lower.includes("adoption_stage") || lower.includes("adoption_stage_rationale"))
  );
}

function ecosystemMissingExpectationCategoryColumn(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  const lower = msg.toLowerCase();
  return lower.includes("no such column") && lower.includes("expectation_category");
}

function ecosystemMissingUnicornColumns(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  const lower = msg.toLowerCase();
  return (
    lower.includes("no such column") &&
    (lower.includes("last_round_valuation") || lower.includes("private_credit_backing"))
  );
}

function ecosystemMissingIsKeptColumn(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  const lower = msg.toLowerCase();
  return lower.includes("no such column") && lower.includes("is_kept");
}

async function fetchEnrichedThemeEcosystem(
  db: Client,
  userId: string,
  themeId: string,
  portfolioTickerSet: Set<string>,
  themeCreatedAt: string | null,
  perf?: { enabled: boolean; requestId?: string | null },
  options?: { fast?: boolean },
): Promise<ThemeEcosystemWatchItem[]> {
  try {
    let rows: Record<string, unknown>[];
    try {
      try {
        try {
          const rs = await db.execute({
            sql: `SELECT id, theme_id, ticker, is_unlisted, proxy_ticker, estimated_ipo_date, estimated_valuation,
                         last_round_valuation, private_credit_backing, observation_notes,
                         company_name, field, role, is_major_player, observation_started_at,
                         adoption_stage, adoption_stage_rationale, expectation_category,
                         holder_tags, dividend_months, defensive_strength, is_kept,
                         revenue_growth, fcf_margin, fcf, fcf_yield
                  , listing_date, market_cap, listing_price, next_earnings_date, memo, is_bookmarked, instrument_meta_synced_at FROM theme_ecosystem_members
                  WHERE theme_id = ?
                  ORDER BY field ASC, ticker ASC`,
            args: [themeId],
          });
          rows = rs.rows as unknown as Record<string, unknown>[];
        } catch (eEff) {
          if (!ecosystemMissingEfficiencyColumns(eEff)) throw eEff;
          const rs = await db.execute({
            sql: `SELECT id, theme_id, ticker, is_unlisted, proxy_ticker, estimated_ipo_date, estimated_valuation,
                         last_round_valuation, private_credit_backing, observation_notes,
                         company_name, field, role, is_major_player, observation_started_at,
                         adoption_stage, adoption_stage_rationale, expectation_category,
                         holder_tags, dividend_months, defensive_strength, is_kept
                  , listing_date, market_cap, listing_price, next_earnings_date, memo, is_bookmarked, instrument_meta_synced_at FROM theme_ecosystem_members
                  WHERE theme_id = ?
                  ORDER BY field ASC, ticker ASC`,
            args: [themeId],
          });
          rows = (rs.rows as unknown as Record<string, unknown>[]).map((r) => ({
            ...r,
            revenue_growth: null,
            fcf_margin: null,
            fcf: null,
            fcf_yield: null,
          }));
        }
      } catch (err) {
        if (!ecosystemMissingIsKeptColumn(err)) throw err;
        try {
          const rs = await db.execute({
            sql: `SELECT id, theme_id, ticker, is_unlisted, proxy_ticker, estimated_ipo_date, estimated_valuation,
                         last_round_valuation, private_credit_backing, observation_notes,
                         company_name, field, role, is_major_player, observation_started_at,
                         adoption_stage, adoption_stage_rationale, expectation_category,
                         holder_tags, dividend_months, defensive_strength,
                         revenue_growth, fcf_margin, fcf, fcf_yield
                  , listing_date, market_cap, listing_price, next_earnings_date, memo, is_bookmarked, instrument_meta_synced_at FROM theme_ecosystem_members
                  WHERE theme_id = ?
                  ORDER BY field ASC, ticker ASC`,
            args: [themeId],
          });
          rows = (rs.rows as unknown as Record<string, unknown>[]).map((r) => ({
            ...r,
            is_kept: 0,
          }));
        } catch (eEff2) {
          if (!ecosystemMissingEfficiencyColumns(eEff2)) throw eEff2;
          const rs = await db.execute({
            sql: `SELECT id, theme_id, ticker, is_unlisted, proxy_ticker, estimated_ipo_date, estimated_valuation,
                         last_round_valuation, private_credit_backing, observation_notes,
                         company_name, field, role, is_major_player, observation_started_at,
                         adoption_stage, adoption_stage_rationale, expectation_category,
                         holder_tags, dividend_months, defensive_strength
                  , listing_date, market_cap, listing_price, next_earnings_date, memo, is_bookmarked, instrument_meta_synced_at FROM theme_ecosystem_members
                  WHERE theme_id = ?
                  ORDER BY field ASC, ticker ASC`,
            args: [themeId],
          });
          rows = (rs.rows as unknown as Record<string, unknown>[]).map((r) => ({
            ...r,
            is_kept: 0,
            revenue_growth: null,
            fcf_margin: null,
            fcf: null,
            fcf_yield: null,
          }));
        }
      }
    } catch (e) {
      if (ecosystemMissingUnicornColumns(e)) {
        // Older DB without unicorn fields: fallback and inject nulls.
        try {
          const rs = await db.execute({
            sql: `SELECT id, theme_id, ticker, is_unlisted, proxy_ticker, estimated_ipo_date, estimated_valuation, observation_notes,
                         company_name, field, role, is_major_player, observation_started_at,
                         adoption_stage, adoption_stage_rationale, expectation_category,
                         holder_tags, dividend_months, defensive_strength,
                         revenue_growth, fcf_margin, fcf, fcf_yield
                  , listing_date, market_cap, listing_price, next_earnings_date, memo, is_bookmarked, instrument_meta_synced_at FROM theme_ecosystem_members
                  WHERE theme_id = ?
                  ORDER BY field ASC, ticker ASC`,
            args: [themeId],
          });
          rows = (rs.rows as unknown as Record<string, unknown>[]).map((r) => ({
            ...r,
            last_round_valuation: null,
            private_credit_backing: null,
          }));
        } catch (eEff3) {
          if (!ecosystemMissingEfficiencyColumns(eEff3)) throw eEff3;
          const rs = await db.execute({
            sql: `SELECT id, theme_id, ticker, is_unlisted, proxy_ticker, estimated_ipo_date, estimated_valuation, observation_notes,
                         company_name, field, role, is_major_player, observation_started_at,
                         adoption_stage, adoption_stage_rationale, expectation_category,
                         holder_tags, dividend_months, defensive_strength
                  , listing_date, market_cap, listing_price, next_earnings_date, memo, is_bookmarked, instrument_meta_synced_at FROM theme_ecosystem_members
                  WHERE theme_id = ?
                  ORDER BY field ASC, ticker ASC`,
            args: [themeId],
          });
          rows = (rs.rows as unknown as Record<string, unknown>[]).map((r) => ({
            ...r,
            last_round_valuation: null,
            private_credit_backing: null,
            revenue_growth: null,
            fcf_margin: null,
            fcf: null,
            fcf_yield: null,
          }));
        }
      } else if (ecosystemMissingExpectationCategoryColumn(e)) {
        try {
          try {
            const rs = await db.execute({
              sql: `SELECT id, theme_id, ticker, is_unlisted, proxy_ticker, estimated_ipo_date, estimated_valuation,
                           last_round_valuation, private_credit_backing, observation_notes,
                           company_name, field, role, is_major_player, observation_started_at,
                           adoption_stage, adoption_stage_rationale,
                           holder_tags, dividend_months, defensive_strength,
                           revenue_growth, fcf_margin, fcf, fcf_yield
                    , listing_date, market_cap, listing_price, next_earnings_date, memo, is_bookmarked, instrument_meta_synced_at FROM theme_ecosystem_members
                    WHERE theme_id = ?
                    ORDER BY field ASC, ticker ASC`,
              args: [themeId],
            });
            rows = (rs.rows as unknown as Record<string, unknown>[]).map((r) => ({
              ...r,
              expectation_category: null,
            }));
          } catch (eEff4) {
            if (!ecosystemMissingEfficiencyColumns(eEff4)) throw eEff4;
            const rs = await db.execute({
              sql: `SELECT id, theme_id, ticker, is_unlisted, proxy_ticker, estimated_ipo_date, estimated_valuation,
                           last_round_valuation, private_credit_backing, observation_notes,
                           company_name, field, role, is_major_player, observation_started_at,
                           adoption_stage, adoption_stage_rationale,
                           holder_tags, dividend_months, defensive_strength
                    , listing_date, market_cap, listing_price, next_earnings_date, memo, is_bookmarked, instrument_meta_synced_at FROM theme_ecosystem_members
                    WHERE theme_id = ?
                    ORDER BY field ASC, ticker ASC`,
              args: [themeId],
            });
            rows = (rs.rows as unknown as Record<string, unknown>[]).map((r) => ({
              ...r,
              expectation_category: null,
              revenue_growth: null,
              fcf_margin: null,
              fcf: null,
              fcf_yield: null,
            }));
          }
        } catch (e2) {
          if (!ecosystemMissingAdoptionColumns(e2)) throw e2;
          try {
            const rs = await db.execute({
              sql: `SELECT id, theme_id, ticker, is_unlisted, proxy_ticker, estimated_ipo_date, estimated_valuation,
                           last_round_valuation, private_credit_backing, observation_notes,
                           company_name, field, role, is_major_player, observation_started_at,
                           revenue_growth, fcf_margin, fcf, fcf_yield
                    , listing_date, market_cap, listing_price, next_earnings_date, memo, is_bookmarked, instrument_meta_synced_at FROM theme_ecosystem_members
                    WHERE theme_id = ?
                    ORDER BY field ASC, ticker ASC`,
              args: [themeId],
            });
            rows = (rs.rows as unknown as Record<string, unknown>[]).map((r) => ({
              ...r,
              adoption_stage: null,
              adoption_stage_rationale: null,
              expectation_category: null,
              holder_tags: "[]",
              dividend_months: "[]",
              defensive_strength: null,
            }));
          } catch (eEff5) {
            if (!ecosystemMissingEfficiencyColumns(eEff5)) throw eEff5;
            const rs = await db.execute({
              sql: `SELECT id, theme_id, ticker, is_unlisted, proxy_ticker, estimated_ipo_date, estimated_valuation,
                           last_round_valuation, private_credit_backing, observation_notes,
                           company_name, field, role, is_major_player, observation_started_at
                    , listing_date, market_cap, listing_price, next_earnings_date, memo, is_bookmarked, instrument_meta_synced_at FROM theme_ecosystem_members
                    WHERE theme_id = ?
                    ORDER BY field ASC, ticker ASC`,
              args: [themeId],
            });
            rows = (rs.rows as unknown as Record<string, unknown>[]).map((r) => ({
              ...r,
              adoption_stage: null,
              adoption_stage_rationale: null,
              expectation_category: null,
              holder_tags: "[]",
              dividend_months: "[]",
              defensive_strength: null,
              revenue_growth: null,
              fcf_margin: null,
              fcf: null,
              fcf_yield: null,
            }));
          }
        }
      } else if (ecosystemMissingAdoptionColumns(e)) {
        try {
          const rs = await db.execute({
            sql: `SELECT id, theme_id, ticker, is_unlisted, proxy_ticker, estimated_ipo_date, estimated_valuation,
                         last_round_valuation, private_credit_backing, observation_notes,
                         company_name, field, role, is_major_player, observation_started_at,
                         revenue_growth, fcf_margin, fcf, fcf_yield
                , listing_date, market_cap, listing_price, next_earnings_date, memo, is_bookmarked, instrument_meta_synced_at FROM theme_ecosystem_members
                WHERE theme_id = ?
                ORDER BY field ASC, ticker ASC`,
            args: [themeId],
          });
          rows = (rs.rows as unknown as Record<string, unknown>[]).map((r) => ({
            ...r,
            adoption_stage: null,
            adoption_stage_rationale: null,
            expectation_category: null,
            holder_tags: "[]",
            dividend_months: "[]",
            defensive_strength: null,
          }));
        } catch (eEff6) {
          if (!ecosystemMissingEfficiencyColumns(eEff6)) throw eEff6;
          const rs = await db.execute({
            sql: `SELECT id, theme_id, ticker, is_unlisted, proxy_ticker, estimated_ipo_date, estimated_valuation,
                         last_round_valuation, private_credit_backing, observation_notes,
                         company_name, field, role, is_major_player, observation_started_at
                , listing_date, market_cap, listing_price, next_earnings_date, memo, is_bookmarked, instrument_meta_synced_at FROM theme_ecosystem_members
                WHERE theme_id = ?
                ORDER BY field ASC, ticker ASC`,
            args: [themeId],
          });
          rows = (rs.rows as unknown as Record<string, unknown>[]).map((r) => ({
            ...r,
            adoption_stage: null,
            adoption_stage_rationale: null,
            expectation_category: null,
            holder_tags: "[]",
            dividend_months: "[]",
            defensive_strength: null,
            revenue_growth: null,
            fcf_margin: null,
            fcf: null,
            fcf_yield: null,
          }));
        }
      } else {
        throw e;
      }
    }
    await prefetchThemeEcosystemInstrumentMetadata(db, userId, themeId, rows, options);
    const tResearch0 = perf?.enabled ? Date.now() : 0;
    const researchTargets = rows
      .map((r) => {
        const isUnlisted = Number(r["is_unlisted"]) === 1;
        const t = String(r["ticker"] ?? "").trim();
        const proxy = r["proxy_ticker"] != null ? String(r["proxy_ticker"]).trim() : "";
        const effective = isUnlisted ? proxy : t;
        return effective;
      })
      .filter((x) => x.length > 0);
    const fast = options?.fast === true;
    const researchByTicker = fast
      ? new Map()
      : await fetchEquityResearchSnapshots(
          [...new Set(researchTargets)].map((ticker) => ({ ticker, providerSymbol: null })),
          // Ecosystem watchlist can be large; prefer higher throughput here.
          { concurrency: 10, batchDelayMs: 25 },
        );
    if (perf?.enabled && perf.requestId) {
      console.log(
        `[perf] ${perf.requestId} ecosystem:research ms=${Date.now() - tResearch0} tickers=${new Set(researchTargets).size} skipped=${fast ? 1 : 0}`,
      );
    }

    const listedTickersForEfficiency = rows
      .filter((r) => Number(r["is_unlisted"]) !== 1)
      .map((r) => String(r["ticker"] ?? "").trim())
      .filter((t) => t.length > 0);
    const efficiencyByTickerUpper = await fetchEcosystemEfficiencyByTickerUpper(db, listedTickersForEfficiency);

    /**
     * Yahoo Finance 等の外部 I/O がボトルネックになりやすいので、適度な並列度で回す。
     * 一部失敗してもページ全体を止めない（Promise.allSettled 相当）。
     */
    const CONCURRENCY = fast ? 10 : 8;
    const results: (ThemeEcosystemWatchItem | null)[] = new Array(rows.length).fill(null);
    let nextIdx = 0;
    let failed = 0;
    const tEnrich0 = perf?.enabled ? Date.now() : 0;

    async function worker() {
      while (true) {
        const i = nextIdx;
        nextIdx += 1;
        if (i >= rows.length) return;
        const row = rows[i]!;
        try {
          results[i] = await enrichEcosystemMemberRow(
            db,
            userId,
            row,
            portfolioTickerSet,
            themeCreatedAt,
            researchByTicker,
            efficiencyByTickerUpper,
            { fast },
          );
        } catch {
          // Skip failed ticker to keep the page responsive.
          results[i] = null;
          failed += 1;
        }
      }
    }

    await Promise.allSettled(Array.from({ length: Math.min(CONCURRENCY, rows.length) }, () => worker()));

    const out = results.filter((x): x is ThemeEcosystemWatchItem => x != null);
    if (perf?.enabled && perf.requestId) {
      console.log(
        `[perf] ${perf.requestId} ecosystem:enrich ms=${Date.now() - tEnrich0} rows=${rows.length} ok=${out.length} failed=${failed} concurrency=${CONCURRENCY}`,
      );
    }
    return out;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("no such table") || msg.toLowerCase().includes("theme_ecosystem_members")) {
      return [];
    }
    throw e;
  }
}

/**
 * 指定テーマ（structure_tags 先頭一致）の保有・Alpha・テーマメタ・エコシステムを一括取得。`/themes/[theme]` 用。
 */
export async function getThemeDetailData(
  db: Client,
  userId: string,
  themeName: string,
  options?: { perf?: boolean; requestId?: string | null; fast?: boolean },
): Promise<ThemeDetailData> {
  const perf = { enabled: options?.perf === true, requestId: options?.requestId ?? null };
  const fast = options?.fast === true;
  const t0 = perf.enabled ? Date.now() : 0;
  const [theme, benchmarkSnap, fxMaybe, h, liveAlphaCtx] = await Promise.all([
    (async () => {
      const t = perf.enabled ? Date.now() : 0;
      const out = await fetchInvestmentThemeRecord(db, userId, themeName);
      if (perf.enabled && perf.requestId) console.log(`[perf] ${perf.requestId} themeRecord ms=${Date.now() - t}`);
      return out;
    })(),
    (async () => {
      const t = perf.enabled ? Date.now() : 0;
      const out = await resolveBenchmarkSnapshot();
      if (perf.enabled && perf.requestId) console.log(`[perf] ${perf.requestId} benchmarkSnap ms=${Date.now() - t}`);
      return out;
    })(),
    (async () => {
      const t = perf.enabled ? Date.now() : 0;
      const out = await resolveFxUsdJpyRate();
      if (perf.enabled && perf.requestId) console.log(`[perf] ${perf.requestId} fxUsdJpy ms=${Date.now() - t}`);
      return out;
    })(),
    (async () => {
      const t = perf.enabled ? Date.now() : 0;
      const out = await fetchHoldingsRowsWithInvestmentMeta(db, userId);
      if (perf.enabled && perf.requestId) console.log(`[perf] ${perf.requestId} holdingsQuery ms=${Date.now() - t}`);
      return out;
    })(),
    (async () => {
      const t = perf.enabled ? Date.now() : 0;
      const out = await resolveLiveAlphaBenchmarkContext();
      if (perf.enabled && perf.requestId) console.log(`[perf] ${perf.requestId} liveAlphaBenchmarks ms=${Date.now() - t}`);
      return out;
    })(),
  ]);
  const fxUsdJpy = fxMaybe != null && Number.isFinite(fxMaybe) && fxMaybe > 0 ? fxMaybe : USD_JPY_RATE_FALLBACK;

  const holdingRows = h.rows as unknown as HoldingQueryRow[];
  const portfolioTickerSet = new Set(holdingRows.map((r) => String(r.ticker).trim().toUpperCase()));

  const matching = holdingRows.filter((row) => {
    const tagsJson = row.structure_tags == null ? "[]" : String(row.structure_tags);
    return portfolioThemeTagMatchesThemePage(themeFromStructureTags(tagsJson), themeName);
  });

  const [researchByTicker, hybridPriceByHoldingKey] = await Promise.all([
    (async () => {
      const t = perf.enabled ? Date.now() : 0;
      const out = await fetchEquityResearchSnapshots(
        matching.map((r) => ({
          ticker: String(r.ticker),
          providerSymbol: r.provider_symbol != null ? String(r.provider_symbol) : null,
        })),
      );
      if (perf.enabled && perf.requestId)
        console.log(`[perf] ${perf.requestId} holdings:research ms=${Date.now() - t} tickers=${matching.length}`);
      return out;
    })(),
    (async () => {
      const t = perf.enabled ? Date.now() : 0;
      const out = await fetchHoldingsHybridPriceSnapshots(
        matching.map((r) => ({
          ticker: String(r.ticker),
          providerSymbol: r.provider_symbol != null ? String(r.provider_symbol) : null,
        })),
      );
      if (perf.enabled && perf.requestId)
        console.log(`[perf] ${perf.requestId} holdings:hybridPrices ms=${Date.now() - t} tickers=${matching.length}`);
      return out;
    })(),
  ]);

  await prefetchHoldingsInstrumentMetadata(db, userId, matching as unknown as Record<string, unknown>[], { fast });

  let ecosystem: ThemeEcosystemWatchItem[] = [];
  if (theme?.id != null) {
    ecosystem = await fetchEnrichedThemeEcosystem(
      db,
      userId,
      theme.id,
      portfolioTickerSet,
      theme.createdAt != null ? String(theme.createdAt) : null,
      perf,
      { fast },
    );
  }

  let stocks: Stock[] = [];
  let themeTotalMarketValue = 0;
  let themeAverageUnrealizedPnlPercent = 0;
  let themeAverageAlpha = 0;
  let themeAverageFxNeutralAlpha = 0;
  let cumulativeAlphaSeries: CumulativeAlphaPoint[] = [];
  let themeStructuralTrendSeries: CumulativeAlphaPoint[] = [];
  let themeStructuralTrendTotalPct: number | null = null;
  let themeStructuralTrendStartDate: string | null = null;
  let structuralAlphaTotalPct: number | null = null;
  let cumulativeAlphaAnchorDate: string | null = null;

  let themeSyntheticUsRatio: number | null = null;
  let themeSyntheticJpRatio: number | null = null;
  let themeSyntheticBasis: "market_value" | "equal_count" | null = null;
  let themeBenchmarkVooClose: number | null = null;
  let themeBenchmarkTopixClose: number | null = null;
  let themeSyntheticBenchmarkTooltip: string | null = null;

  if (matching.length > 0) {
    const tickers = [...new Set(matching.map((r) => String(r.ticker)))];
    const efficiencyByTickerUpper = await fetchEcosystemEfficiencyByTickerUpper(db, tickers);
    const tAlphaQ = perf.enabled ? Date.now() : 0;
    const rows = await fetchAlphaHistoryRowsForTickers(db, userId, tickers);
    if (perf.enabled && perf.requestId) {
      console.log(
        `[perf] ${perf.requestId} alphaHistoryQuery ms=${Date.now() - tAlphaQ} tickers=${tickers.length}`,
      );
    }

    const byTicker = buildByTickerFromAlphaRows(rows);
    const byTickerDated = buildByTickerDatedAlphaRows(rows);
    const chartListedReturnPctByHoldingKey = await prefetchChartListedTotalReturnByHoldingKey(matching, { fast });
    const drafts = buildDraftsFromHoldingRows(
      matching,
      byTicker,
      researchByTicker,
      fxUsdJpy,
      hybridPriceByHoldingKey,
      efficiencyByTickerUpper,
      liveAlphaCtx,
      chartListedReturnPctByHoldingKey,
    );
    themeTotalMarketValue = drafts.reduce((s, d) => s + sanitizeMarketValueForAggregation(d.marketValue), 0);
    stocks = finalizeStocksFromDrafts(drafts, themeTotalMarketValue);
    themeAverageUnrealizedPnlPercent = computeThemeAverageUnrealizedPnlPercent(stocks);
    themeAverageAlpha = computePortfolioAverageAlphaSummary(stocks).average;
    themeAverageFxNeutralAlpha = portfolioAverageFxNeutralDailyAlphaPct(stocks);

    const { usRatio, jpRatio, basis: synthBasis } = computeThemeUsJpRatiosForSyntheticBenchmark(
      stocks.map((s) => ({ instrumentKind: s.instrumentKind, marketValue: s.marketValue })),
      "JPY",
      fxUsdJpy,
    );
    themeSyntheticUsRatio = usRatio;
    themeSyntheticJpRatio = jpRatio;
    themeSyntheticBasis = synthBasis;
    themeBenchmarkVooClose =
      benchmarkSnap.close != null && Number.isFinite(benchmarkSnap.close) && benchmarkSnap.close > 0
        ? benchmarkSnap.close
        : null;
    if (!fast) {
      try {
        const tp = await fetchLatestPrice(TOPIX_ETF_BENCHMARK_TICKER, null);
        if (tp != null && Number.isFinite(tp.close) && tp.close > 0) {
          themeBenchmarkTopixClose = tp.close;
        }
      } catch {
        /* optional ref price */
      }
    }
    const pctU = Math.round(usRatio * 100);
    const pctJ = Math.round(jpRatio * 100);
    themeSyntheticBenchmarkTooltip = `テーマ累積 Alpha の物差し: 日次の合成騰落率（${pctU}%×VOO + ${pctJ}%×1306.T / TOPIX ETF）を基準線とし、テーマ加重の銘柄騰落率から差し引いた超過を積み上げています。各銘柄の日次 Alpha は Lv.1 どおり米株→VOO、日本株・投信→1306.T です。`;
    if (fast && usRatio > 1e-6 && jpRatio > 1e-6) {
      themeSyntheticBenchmarkTooltip += `（fast モード: 累積系列はベンチ取得を省略し、従来の銘柄別累積の加重マージを表示）`;
    }

    // ベンチマーク移行（VOO / 1306.T）後も累積の物差しを一本化するため、表示アンカーは固定暦日（実際の起点は calculateCumulativeAlpha が最寄り観測日に丸める）。
    const startAnchor = CUMULATIVE_ALPHA_DISPLAY_ANCHOR_YMD;

    const perTicker: { weight: number; series: { date: string; cumulative: number }[] }[] = [];
    for (const s of stocks) {
      const dated = byTickerDated.get(s.ticker) ?? [];
      if (dated.length === 0) continue;
      const series = calculateCumulativeAlpha(dated, startAnchor);
      if (series.length > 0) {
        perTicker.push({
          weight: sanitizeMarketValueForAggregation(s.marketValue),
          series,
        });
      }
    }

    const mergedCumulativeFallback = mergeWeightedCumulativeAlphaSeries(perTicker);
    const isMixedRegion = usRatio > 1e-6 && jpRatio > 1e-6;
    cumulativeAlphaSeries = mergedCumulativeFallback;

    if (isMixedRegion && !fast && perTicker.length > 0) {
      try {
        let minD = "9999-12-31";
        let maxD = "1970-01-01";
        for (const s of stocks) {
          const dr = byTickerDated.get(s.ticker);
          if (dr == null || dr.length === 0) continue;
          const first = toYmd(dr[0]!.recordedAt);
          const last = toYmd(dr[dr.length - 1]!.recordedAt);
          if (first < minD) minD = first;
          if (last > maxD) maxD = last;
        }
        const spanDays =
          minD.length === 10 && maxD.length === 10
            ? Math.max(
                30,
                Math.ceil(
                  (new Date(`${maxD}T12:00:00Z`).getTime() - new Date(`${minD}T12:00:00Z`).getTime()) /
                    86_400_000,
                ),
              )
            : 90;
        const benchDays = Math.min(180, Math.max(70, spanDays + 45));
        const [vooBars, topixBars] = await Promise.all([
          fetchPriceHistory(SIGNAL_BENCHMARK_TICKER, benchDays, null),
          fetchPriceHistory(TOPIX_ETF_BENCHMARK_TICKER, benchDays, null),
        ]);
        const vooRet = benchmarkDailyReturnPercentByEndDate(vooBars);
        const topixRet = benchmarkDailyReturnPercentByEndDate(topixBars);
        const stockInputs: ThemeSyntheticStockInput[] = stocks
          .map((s) => {
            const dated = byTickerDated.get(s.ticker) ?? [];
            const m = new Map<string, number>();
            for (const r of dated) {
              m.set(toYmd(r.recordedAt), r.alphaValue);
            }
            return {
              ticker: s.ticker,
              weight: sanitizeMarketValueForAggregation(s.marketValue),
              instrumentKind: s.instrumentKind,
              dailyAlphaByEndDateYmd: m,
            };
          })
          .filter((x) => x.weight > 0);

        const synthSeries = computeThemeCumulativeAlphaVsSyntheticFromDailyExcesses({
          startAnchorYmd: toYmd(startAnchor),
          stocks: stockInputs,
          usRatio,
          jpRatio,
          vooReturnByEndDateYmd: vooRet,
          topixReturnByEndDateYmd: topixRet,
        });
        if (synthSeries.length >= 2) {
          cumulativeAlphaSeries = synthSeries;
        }
      } catch {
        /* keep mergedCumulativeFallback */
      }
    }

    if (cumulativeAlphaSeries.length > 0) {
      structuralAlphaTotalPct = cumulativeAlphaSeries[cumulativeAlphaSeries.length - 1]!.cumulative;
    }
    if (cumulativeAlphaSeries.length > 0) {
      cumulativeAlphaAnchorDate = cumulativeAlphaSeries[0]!.date;
    }

    const windowStartYmd = ymdDaysAgoUtc(THEME_STRUCTURAL_TREND_LOOKBACK_DAYS);
    themeStructuralTrendStartDate = windowStartYmd;
    const structuralTrendInputs: { weight: number; dailyAlphaByYmd: Map<string, number> }[] = [];
    for (const s of stocks) {
      const dated = byTickerDated.get(s.ticker) ?? [];
      const filtered = dated.filter((r) => toYmd(r.recordedAt) >= windowStartYmd);
      if (filtered.length === 0) continue;
      const w = sanitizeMarketValueForAggregation(s.marketValue);
      if (w <= 0) continue;
      const dailyAlphaByYmd = new Map<string, number>();
      for (const r of filtered) {
        dailyAlphaByYmd.set(toYmd(r.recordedAt), r.alphaValue);
      }
      structuralTrendInputs.push({ weight: w, dailyAlphaByYmd });
    }
    themeStructuralTrendSeries = computeThemeStructuralTrendCumulativeFromWeightedDailyAlphas(
      structuralTrendInputs,
      windowStartYmd,
    );
    if (themeStructuralTrendSeries.length > 0) {
      themeStructuralTrendTotalPct =
        themeStructuralTrendSeries[themeStructuralTrendSeries.length - 1]!.cumulative;
    }
  } else if (ecosystem.length > 0) {
    const ecoAlphaTargets = alphaWatchTargetsFromEcosystemMembers(ecosystem);
    if (!fast && ecoAlphaTargets.length > 0) {
      const tBf = perf.enabled ? Date.now() : 0;
      try {
        const r = await reconcileAlphaHistoryForWatchlistTickers(db, userId, ecoAlphaTargets, {
          delayMs: 40,
          maxTickers: 48,
        });
        if (perf.enabled && perf.requestId) {
          console.log(
            `[perf] ${perf.requestId} ecosystem:alphaBackfill ms=${Date.now() - tBf} rows=${r.rowsBackfilled} tickers=${r.backfilledTickers.length}`,
          );
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn(`[getThemeDetailData] ecosystem alpha backfill failed (continuing): ${msg}`);
      }
    }

    const windowStartYmd = ymdDaysAgoUtc(THEME_STRUCTURAL_TREND_LOOKBACK_DAYS);
    themeStructuralTrendStartDate = windowStartYmd;

    const tickerWeights = new Map<string, number>();
    const tickerSqlByUpper = new Map<string, string>();
    for (const e of ecosystem) {
      const raw = e.isUnlisted
        ? e.proxyTicker != null && String(e.proxyTicker).trim().length > 0
          ? String(e.proxyTicker).trim()
          : null
        : String(e.ticker).trim();
      if (!raw) continue;
      const u = raw.toUpperCase();
      if (!tickerSqlByUpper.has(u)) tickerSqlByUpper.set(u, raw);
      const w = e.isMajorPlayer ? 2 : 1;
      tickerWeights.set(u, (tickerWeights.get(u) ?? 0) + w);
    }

    const tickersForQuery = [...tickerSqlByUpper.values()];
    if (tickersForQuery.length > 0) {
      const ecoRows = await fetchAlphaHistoryRowsForTickers(db, userId, tickersForQuery);
      const byTickerDatedEco = buildByTickerDatedAlphaRows(ecoRows);
      const byUpper = new Map<string, DatedAlphaRow[]>();
      for (const [k, v] of byTickerDatedEco) {
        byUpper.set(k.toUpperCase(), v);
      }

      const structuralTrendEcoInputs: { weight: number; dailyAlphaByYmd: Map<string, number> }[] = [];
      for (const [u, weight] of tickerWeights) {
        const dated = byUpper.get(u) ?? [];
        const filtered = dated.filter((r) => toYmd(r.recordedAt) >= windowStartYmd);
        if (filtered.length === 0) continue;
        if (weight <= 0) continue;
        const dailyAlphaByYmd = new Map<string, number>();
        for (const r of filtered) {
          dailyAlphaByYmd.set(toYmd(r.recordedAt), r.alphaValue);
        }
        structuralTrendEcoInputs.push({ weight, dailyAlphaByYmd });
      }
      themeStructuralTrendSeries = computeThemeStructuralTrendCumulativeFromWeightedDailyAlphas(
        structuralTrendEcoInputs,
        windowStartYmd,
      );
      if (themeStructuralTrendSeries.length > 0) {
        themeStructuralTrendTotalPct =
          themeStructuralTrendSeries[themeStructuralTrendSeries.length - 1]!.cumulative;
      }
    }
  }

  if (perf.enabled && perf.requestId) {
    console.log(`[perf] ${perf.requestId} getThemeDetailData totalMs=${Date.now() - t0} theme="${themeName}"`);
  }

  if (themeStructuralTrendStartDate == null && theme?.id != null) {
    themeStructuralTrendStartDate = ymdDaysAgoUtc(THEME_STRUCTURAL_TREND_LOOKBACK_DAYS);
  }

  return {
    themeName,
    theme,
    stocks,
    themeTotalMarketValue,
    themeAverageUnrealizedPnlPercent,
    themeAverageAlpha,
    themeAverageFxNeutralAlpha,
    fxUsdJpy,
    benchmarkLatestPrice: benchmarkSnap.close,
    themeSyntheticUsRatio,
    themeSyntheticJpRatio,
    themeSyntheticBasis,
    themeBenchmarkVooClose,
    themeBenchmarkTopixClose,
    themeSyntheticBenchmarkTooltip,
    ecosystem,
    cumulativeAlphaSeries,
    structuralAlphaTotalPct,
    cumulativeAlphaAnchorDate,
    themeStructuralTrendSeries,
    themeStructuralTrendTotalPct,
    themeStructuralTrendStartDate,
  };
}

/**
 * ダッシュボード用: 保有の Alpha 履歴・最新終値・円ベース評価額・ウェイト・構造別 / Core-Satellite 集計。
 * `holdings.quantity` と `avg_acquisition_price` は DB の現行値をそのまま使用（取引実行アクション更新後も再取得で反映）。
 * 数量 0 の銘柄（売却済み）は一覧・集計から除外する。
 */
export async function getDashboardData(db: Client, userId: string): Promise<DashboardData> {
  const h = await fetchHoldingsRowsWithInvestmentMeta(db, userId);

  if (h.rows.length === 0) {
    const [allThemes, benchmarkSnap, fxMaybe, totalRealizedPnlJpy, marketIndicators] = await Promise.all([
      fetchAllInvestmentThemes(db, userId),
      resolveBenchmarkSnapshot(),
      resolveFxUsdJpyRate(),
      fetchTotalRealizedPnlJpy(db, userId),
      fetchGlobalMarketIndicators(),
    ]);
    const financial = computeFinancialTotals([], totalRealizedPnlJpy);
    const indicatorValueOrNull = (label: string): number | null => {
      const m = marketIndicators.find((x) => x.label === label);
      return m != null && Number.isFinite(m.value) && m.value > 0 ? m.value : null;
    };
    const goldPrice = indicatorValueOrNull("Gold");
    const btcPrice = indicatorValueOrNull("BTC");
    const themeStructuralSparklines = await computeThemeStructuralSparklinesForDashboard(
      db,
      userId,
      allThemes,
      [],
    );
    return {
      stocks: [],
      allThemes,
      themeStructuralSparklines,
      structureByTheme: [],
      structureBySector: [],
      coreSatellite: computeCoreSatellite([]),
      totalMarketValue: 0,
      summary: {
        portfolioAverageAlpha: 0,
        portfolioAverageFxNeutralAlpha: 0,
        portfolioAvgAlphaStalestLatestYmd: null,
        portfolioAvgAlphaFreshestLatestYmd: null,
        portfolioAvgAlphaAsOfDisplay: null,
        averageDailyAlphaPct: null,
        portfolioTotalLiveAlphaPct: null,
        benchmarkLatestPrice: benchmarkSnap.close,
        benchmarkChangePct: benchmarkSnap.changePct,
        benchmarkPriceSource: benchmarkSnap.priceSource,
        benchmarkAsOf: benchmarkSnap.asOf,
        fxUsdJpy: fxMaybe != null && Number.isFinite(fxMaybe) && fxMaybe > 0 ? fxMaybe : null,
        totalHoldings: 0,
        marketIndicators,
        goldPrice,
        btcPrice,
        portfolioAvgDayChangePct: null,
        ...financial,
      },
    };
  }

  const tickers = [...new Set(h.rows.map((r) => String(r.ticker)))];
  const [allThemes, alphaRows, benchmarkSnap, fxMaybe, totalRealizedPnlJpy, marketIndicators, liveAlphaCtx, snapshotReturnRows] =
    await Promise.all([
      fetchAllInvestmentThemes(db, userId),
      fetchAlphaHistoryRowsForTickers(db, userId, tickers),
      resolveBenchmarkSnapshot(),
      resolveFxUsdJpyRate(),
      fetchTotalRealizedPnlJpy(db, userId),
      fetchGlobalMarketIndicators(),
      resolveLiveAlphaBenchmarkContext(),
      fetchPortfolioSnapshotReturnRows(db, userId),
    ]);

  const byTicker = buildByTickerFromAlphaRows(alphaRows);
  const fxUsdJpy = fxMaybe != null && Number.isFinite(fxMaybe) && fxMaybe > 0 ? fxMaybe : USD_JPY_RATE_FALLBACK;
  const holdingRowsForDash = h.rows as unknown as HoldingQueryRow[];
  const efficiencyByTickerUpper = await fetchEcosystemEfficiencyByTickerUpper(db, tickers);
  const [researchByTicker, hybridPriceByHoldingKey] = await Promise.all([
    fetchEquityResearchSnapshots(
      holdingRowsForDash.map((r) => ({
        ticker: String(r.ticker),
        providerSymbol: r.provider_symbol != null ? String(r.provider_symbol) : null,
      })),
    ),
    fetchHoldingsHybridPriceSnapshots(
      holdingRowsForDash.map((r) => ({
        ticker: String(r.ticker),
        providerSymbol: r.provider_symbol != null ? String(r.provider_symbol) : null,
      })),
    ),
  ]);
  await prefetchHoldingsInstrumentMetadata(db, userId, holdingRowsForDash as unknown as Record<string, unknown>[], {
    fast: false,
  });
  const chartListedReturnPctByHoldingKey = await prefetchChartListedTotalReturnByHoldingKey(holdingRowsForDash, {
    fast: false,
  });
  const drafts = buildDraftsFromHoldingRows(
    holdingRowsForDash,
    byTicker,
    researchByTicker,
    fxUsdJpy,
    hybridPriceByHoldingKey,
    efficiencyByTickerUpper,
    liveAlphaCtx,
    chartListedReturnPctByHoldingKey,
  );

  const totalMarketValue = drafts.reduce(
    (s, d) => s + sanitizeMarketValueForAggregation(d.marketValue),
    0,
  );

  const stocks = finalizeStocksFromDrafts(drafts, totalMarketValue);

  const aggRows = drafts.map((d) => ({ structureTagsJson: d.structureTagsJson, marketValue: d.marketValue }));
  const structureByTheme = aggregateByTheme(aggRows);
  const structureBySector = aggregateByHoldingSector(
    drafts.map((d) => ({ sector: d.sector, structureTagsJson: d.structureTagsJson, marketValue: d.marketValue })),
  );

  const coreSatellite = computeCoreSatellite(stocks);

  const financial = computeFinancialTotals(stocks, totalRealizedPnlJpy);
  const goldIndicator = marketIndicators.find((m) => m.label === "Gold");
  const btcIndicator = marketIndicators.find((m) => m.label === "BTC");
  const goldPrice =
    goldIndicator != null && Number.isFinite(goldIndicator.value) && goldIndicator.value > 0 ? goldIndicator.value : null;
  const btcPrice =
    btcIndicator != null && Number.isFinite(btcIndicator.value) && btcIndicator.value > 0 ? btcIndicator.value : null;
  const paSummary = computePortfolioAverageAlphaSummary(stocks);
  const portfolioAvgAlphaAsOfDisplay = formatPortfolioAvgAlphaAsOfDisplay(
    paSummary.stalestLatestObservationYmd,
    paSummary.freshestLatestObservationYmd,
  );
  const averageDailyAlphaPct = computeAverageDailyAlphaPctFromSnapshots(snapshotReturnRows);
  const portfolioTotalLiveAlphaPct = computePortfolioTotalLiveAlphaPctWeighted(stocks);
  const summary = {
    portfolioAverageAlpha: paSummary.average,
    portfolioAverageFxNeutralAlpha: portfolioAverageFxNeutralDailyAlphaPct(stocks),
    portfolioAvgAlphaStalestLatestYmd: paSummary.stalestLatestObservationYmd,
    portfolioAvgAlphaFreshestLatestYmd: paSummary.freshestLatestObservationYmd,
    portfolioAvgAlphaAsOfDisplay,
    averageDailyAlphaPct,
    portfolioTotalLiveAlphaPct,
    benchmarkLatestPrice: benchmarkSnap.close,
    benchmarkChangePct: benchmarkSnap.changePct,
    benchmarkPriceSource: benchmarkSnap.priceSource,
    benchmarkAsOf: benchmarkSnap.asOf,
    fxUsdJpy: fxMaybe != null && Number.isFinite(fxMaybe) && fxMaybe > 0 ? fxMaybe : null,
    totalHoldings: stocks.length,
    marketIndicators,
    goldPrice,
    btcPrice,
    portfolioAvgDayChangePct: computePortfolioAvgDayChangePct(stocks),
    ...financial,
  };

  const themeStructuralSparklines = await computeThemeStructuralSparklinesForDashboard(
    db,
    userId,
    allThemes,
    drafts,
  );

  return {
    stocks,
    allThemes,
    themeStructuralSparklines,
    structureByTheme,
    structureBySector,
    coreSatellite,
    totalMarketValue,
    summary,
  };
}

export async function fetchStocksForUser(db: Client, userId: string): Promise<Stock[]> {
  const { stocks } = await getDashboardData(db, userId);
  return stocks;
}

/** Unresolved signals for dashboard cards (`id` is the `signals.id` row). */
export async function fetchUnresolvedSignalsForUser(db: Client, userId: string): Promise<Signal[]> {
  const rs = await db.execute({
    sql: `SELECT s.id AS signal_id, s.signal_type, s.alpha_at_signal, s.detected_at,
                 h.ticker, h.name, h.structure_tags, h.sector, h.provider_symbol, h.category, h.expectation_category
          FROM signals s
          JOIN holdings h ON h.id = s.holding_id
          WHERE h.user_id = ? AND h.quantity > 0 AND s.is_resolved = 0
          ORDER BY s.detected_at DESC
          LIMIT 50`,
    args: [userId],
  });

  return rs.rows.map((row) => {
    const rawSt = String(row.signal_type);
    const signalType: LiveSignalType =
      rawSt === "BUY" || rawSt === "WARN" || rawSt === "BREAK" || rawSt === "CRITICAL" ? rawSt : "WARN";
    const isBuy = signalType === "BUY";
    const isWarn = !isBuy;
    const alpha = Number(row.alpha_at_signal);
    const stags = row.structure_tags == null ? "[]" : String(row.structure_tags);
    const tag = row.structure_tags == null ? "" : themeFromStructureTags(stags);
    const ticker = String(row.ticker);
    const instrumentKind = classifyTickerInstrument(ticker);
    return {
      id: String(row.signal_id),
      ticker,
      name: row.name != null ? String(row.name) : "",
      accountType: null,
      countryName: instrumentKind === "US_EQUITY" ? "米国" : "日本",
      nextEarningsDate: null,
      daysToEarnings: null,
      exDividendDate: null,
      daysToExDividend: null,
      recordDate: null,
      daysToRecordDate: null,
      annualDividendRate: null,
      dividendYieldPercent: null,
      trailingPe: null,
      forwardPe: null,
      trailingEps: null,
      forwardEps: null,
      tag,
      alphaHistory: [alpha],
      latestAlphaObservationYmd: null,
      weight: 0,
      quantity: 0,
      category: asCategory(String(row.category)),
      avgAcquisitionPrice: null,
      unrealizedPnlLocal: 0,
      unrealizedPnlJpy: 0,
      unrealizedPnlPercent: 0,
      dayChangePercent: null,
      instrumentKind,
      secondaryTag: sectorFromStructureTags(stags),
      sector: parseSector(row.sector),
      priceSource: "close",
      lastUpdatedAt: null,
      currentPrice: null,
      alphaDeviationZ: null,
      drawdownFromHigh90dPct: null,
      revenueGrowth: Number.NaN,
      fcfMargin: Number.NaN,
      fcfYield: Number.NaN,
      ruleOf40: Number.NaN,
      judgmentStatus: "WATCH",
      judgmentReason: "シグナル行のため財務ベースの判定は保留。",
      marketValue: 0,
      valuationFactor: 1,
      isWarning: isWarn,
      isBuy: isBuy,
      signalType,
      currentAlpha: alpha,
      detectedAt: row.detected_at != null ? String(row.detected_at) : "",
      providerSymbol:
        row.provider_symbol != null && String(row.provider_symbol).length > 0 ? String(row.provider_symbol) : null,
      expectationCategory: parseExpectationCategory(row.expectation_category),
      earningsSummaryNote: null,
      listingDate: null,
      marketCap: null,
      listingPrice: null,
      memo: null,
      isBookmarked: false,
      stopLossPct: null,
      targetProfitPct: null,
      tradeDeadline: null,
      exitRuleEnabled: false,
      performanceSinceFoundation: null,
      previousClose: null,
      benchmarkDayChangePercent: null,
      liveAlphaBenchmarkTicker: null,
    };
  });
}
