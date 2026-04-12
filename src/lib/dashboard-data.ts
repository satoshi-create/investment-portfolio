import type { Client } from "@libsql/client";

import type {
  CoreSatelliteBreakdown,
  CumulativeAlphaPoint,
  DashboardData,
  HoldingCategory,
  InvestmentThemeRecord,
  Signal,
  Stock,
  StructureTagSlice,
  ThemeDetailData,
  ThemeEcosystemWatchItem,
  TickerInstrumentKind,
} from "@/src/types/investment";
import {
  calculateCumulativeAlpha,
  classifyTickerInstrument,
  computeAlphaDeviationZScore,
  computePriceDrawdownFromHighPercent,
  convertValueToJpy,
  dailyReturnPercent,
  mergeWeightedCumulativeAlphaSeries,
  quoteCurrencyForDashboardWeights,
  roundAlphaMetric,
  SIGNAL_BENCHMARK_TICKER,
  type DatedAlphaRow,
} from "@/src/lib/alpha-logic";
import { parseAdoptionStage } from "@/src/lib/adoption-stage";
import { parseExpectationCategory } from "@/src/lib/expectation-category";
import {
  aggregateByHoldingSector,
  aggregateByTheme,
  sanitizeMarketValueForAggregation,
  sectorFromStructureTags,
  themeFromStructureTags,
} from "@/src/lib/structure-tags";
import { USD_JPY_RATE_FALLBACK } from "@/src/lib/fx-constants";
import {
  fetchGlobalMarketIndicators,
  fetchLatestPrice,
  fetchEquityResearchSnapshots,
  fetchRecentDatedDailyAlphasVsVoo,
  fetchLatestPriceWithChangePct,
  fetchLiveQuoteSnapshot,
  fetchHoldingsHybridPriceSnapshots,
  fetchPriceHistory,
  type HybridHoldingPriceSnapshot,
  fetchUsdJpyRate,
  holdingLivePriceKey,
} from "@/src/lib/price-service";

const TARGET_CORE_PERCENT = 90;

type AlphaPoint = { alpha: number; close: number | null };

function asCategory(raw: string): HoldingCategory {
  return raw === "Core" ? "Core" : "Satellite";
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
  return kind === "JP_INVESTMENT_TRUST" ? "JPY" : "USD";
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

function computePortfolioAverageAlpha(stocks: Stock[]): number {
  const latest = stocks
    .map((s) => (s.alphaHistory.length > 0 ? s.alphaHistory[s.alphaHistory.length - 1]! : null))
    .filter((x): x is number => x != null && Number.isFinite(x));
  if (latest.length === 0) return 0;
  const sum = latest.reduce((a, b) => a + b, 0);
  return roundAlphaMetric(sum / latest.length);
}

type BenchmarkSnapshot = {
  close: number;
  changePct: number | null;
  priceSource: "live" | "close";
  asOf: string | null;
};

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
  "totalCostBasisJpy" | "totalRealizedPnlJpy" | "totalProfitJpy" | "totalReturnPct"
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
};

type StockDraft = Omit<Stock, "weight"> & { structureTagsJson: string };

function buildByTickerFromAlphaRows(rows: Iterable<Record<string, unknown>>): Map<string, AlphaPoint[]> {
  const byTicker = new Map<string, AlphaPoint[]>();
  for (const row of rows) {
    const tk = String(row["ticker"]);
    if (!byTicker.has(tk)) byTicker.set(tk, []);
    const cp = row["close_price"];
    byTicker.get(tk)!.push({
      alpha: Number(row["alpha_value"]),
      close: cp != null && Number.isFinite(Number(cp)) ? Number(cp) : null,
    });
  }
  return byTicker;
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

function buildDraftsFromHoldingRows(
  rows: HoldingQueryRow[],
  byTicker: Map<string, AlphaPoint[]>,
  researchByTicker: Map<string, { nextEarningsDate: string | null; annualDividendRate: number | null; dividendYieldPercent: number | null }>,
  fxUsdJpy: number,
  hybridPriceByHoldingKey: Map<string, HybridHoldingPriceSnapshot>,
): StockDraft[] {
  return rows.map((row) => {
    const id = String(row.id);
    const ticker = String(row.ticker);
    const series = byTicker.get(ticker) ?? [];
    const alphaHistory = series.map((p) => p.alpha);
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
    const countryName = instrumentKind === "JP_INVESTMENT_TRUST" ? "日本" : "米国";
    const research = researchByTicker.get(ticker.toUpperCase()) ?? null;
    const nextEarningsDate = research?.nextEarningsDate ?? null;
    const annualDividendRate = research?.annualDividendRate ?? null;
    const dividendYieldPercent = research?.dividendYieldPercent ?? null;
    const daysToEarnings = nextEarningsDate != null ? (() => {
      const d = new Date(`${nextEarningsDate}T00:00:00.000Z`);
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

    return {
      id,
      ticker,
      name: row.name != null ? String(row.name) : "",
      priceSource,
      lastUpdatedAt,
      accountType,
      countryName,
      nextEarningsDate,
      daysToEarnings,
      annualDividendRate,
      dividendYieldPercent,
      tag: rawStructureTags == null ? "" : themeFromStructureTags(tagsJson),
      alphaHistory,
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
      expectationCategory: parseExpectationCategory(row.expectation_category),
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
    { nextEarningsDate: string | null; annualDividendRate: number | null; dividendYieldPercent: number | null }
  >,
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
  const observationNotes =
    row["observation_notes"] != null && String(row["observation_notes"]).trim().length > 0
      ? String(row["observation_notes"]).trim()
      : null;
  const adoptionStage = parseAdoptionStage(row["adoption_stage"]);
  const adoptionStageRationale =
    row["adoption_stage_rationale"] != null && String(row["adoption_stage_rationale"]).trim().length > 0
      ? String(row["adoption_stage_rationale"]).trim()
      : null;

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
  const countryName = instrumentKind === "JP_INVESTMENT_TRUST" ? "日本" : "米国";
  const researchKey = effectiveTicker.length > 0 ? effectiveTicker.toUpperCase() : ticker.toUpperCase();
  const research = researchByTicker.get(researchKey) ?? null;
  const nextEarningsDate = research?.nextEarningsDate ?? null;
  const annualDividendRate = research?.annualDividendRate ?? null;
  const dividendYieldPercent = research?.dividendYieldPercent ?? null;
  const daysToEarnings =
    nextEarningsDate != null
      ? (() => {
          const d = new Date(`${nextEarningsDate}T00:00:00.000Z`);
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
          args: [userId, effectiveTicker, SIGNAL_BENCHMARK_TICKER],
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
        const live = await fetchRecentDatedDailyAlphasVsVoo(effectiveTicker, 120, null);
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
   * Last 列:
   * - Watchlist（非保有）は初回ロード速度優先で DB/系列の終値を使う（live quote は叩かない）
   * - 保有銘柄のみ live quote を許可（必要なら）
   */
  let displayPrice: number | null = lastClose;
  if (effectiveTicker.length > 0 && inPortfolio) {
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

  return {
    id,
    themeId,
    ticker,
    isUnlisted,
    proxyTicker,
    estimatedIpoDate,
    estimatedValuation,
    observationNotes,
    companyName,
    field,
    role,
    isMajorPlayer,
    inPortfolio,
    countryName,
    nextEarningsDate,
    daysToEarnings,
    annualDividendRate,
    dividendYieldPercent,
    observationStartedAt,
    alphaHistory,
    currentPrice: displayPrice,
    latestAlpha,
    alphaObservationStartDate,
    alphaDeviationZ,
    drawdownFromHigh90dPct,
    adoptionStage,
    adoptionStageRationale,
    expectationCategory: parseExpectationCategory(row["expectation_category"]),
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
      const rs = await db.execute({
        sql: `SELECT id, theme_id, ticker, is_unlisted, proxy_ticker, estimated_ipo_date, estimated_valuation, observation_notes,
                     company_name, field, role, is_major_player, observation_started_at,
                     adoption_stage, adoption_stage_rationale, expectation_category
              FROM theme_ecosystem_members
              WHERE theme_id = ?
              ORDER BY field ASC, ticker ASC`,
        args: [themeId],
      });
      rows = rs.rows as unknown as Record<string, unknown>[];
    } catch (e) {
      if (ecosystemMissingExpectationCategoryColumn(e)) {
        try {
          const rs = await db.execute({
            sql: `SELECT id, theme_id, ticker, is_unlisted, proxy_ticker, estimated_ipo_date, estimated_valuation, observation_notes,
                         company_name, field, role, is_major_player, observation_started_at,
                         adoption_stage, adoption_stage_rationale
                  FROM theme_ecosystem_members
                  WHERE theme_id = ?
                  ORDER BY field ASC, ticker ASC`,
            args: [themeId],
          });
          rows = (rs.rows as unknown as Record<string, unknown>[]).map((r) => ({
            ...r,
            expectation_category: null,
          }));
        } catch (e2) {
          if (!ecosystemMissingAdoptionColumns(e2)) throw e2;
          const rs = await db.execute({
            sql: `SELECT id, theme_id, ticker, is_unlisted, proxy_ticker, estimated_ipo_date, estimated_valuation, observation_notes,
                         company_name, field, role, is_major_player, observation_started_at
                  FROM theme_ecosystem_members
                  WHERE theme_id = ?
                  ORDER BY field ASC, ticker ASC`,
            args: [themeId],
          });
          rows = (rs.rows as unknown as Record<string, unknown>[]).map((r) => ({
            ...r,
            adoption_stage: null,
            adoption_stage_rationale: null,
            expectation_category: null,
          }));
        }
      } else if (ecosystemMissingAdoptionColumns(e)) {
        const rs = await db.execute({
          sql: `SELECT id, theme_id, ticker, is_unlisted, proxy_ticker, estimated_ipo_date, estimated_valuation, observation_notes,
                       company_name, field, role, is_major_player, observation_started_at
              FROM theme_ecosystem_members
              WHERE theme_id = ?
              ORDER BY field ASC, ticker ASC`,
          args: [themeId],
        });
        rows = (rs.rows as unknown as Record<string, unknown>[]).map((r) => ({
          ...r,
          adoption_stage: null,
          adoption_stage_rationale: null,
          expectation_category: null,
        }));
      } else {
        throw e;
      }
    }
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

    /**
     * Yahoo Finance 等の外部 I/O がボトルネックになりやすいので、適度な並列度で回す。
     * 一部失敗してもページ全体を止めない（Promise.allSettled 相当）。
     */
    const CONCURRENCY = 6;
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
  const [theme, benchmarkSnap, fxMaybe, h] = await Promise.all([
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
      const out = await db.execute({
        sql: `SELECT id, ticker, name, quantity, avg_acquisition_price, structure_tags, sector, category, account_type, provider_symbol, valuation_factor, expectation_category
              FROM holdings
              WHERE user_id = ? AND quantity > 0
              ORDER BY ticker`,
        args: [userId],
      });
      if (perf.enabled && perf.requestId) console.log(`[perf] ${perf.requestId} holdingsQuery ms=${Date.now() - t}`);
      return out;
    })(),
  ]);
  const fxUsdJpy = fxMaybe != null && Number.isFinite(fxMaybe) && fxMaybe > 0 ? fxMaybe : USD_JPY_RATE_FALLBACK;

  const holdingRows = h.rows as unknown as HoldingQueryRow[];
  const portfolioTickerSet = new Set(holdingRows.map((r) => String(r.ticker).trim().toUpperCase()));

  const matching = holdingRows.filter((row) => {
    const tagsJson = row.structure_tags == null ? "[]" : String(row.structure_tags);
    return themeFromStructureTags(tagsJson) === themeName;
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

  let stocks: Stock[] = [];
  let themeTotalMarketValue = 0;
  let themeAverageUnrealizedPnlPercent = 0;
  let themeAverageAlpha = 0;
  let cumulativeAlphaSeries: CumulativeAlphaPoint[] = [];
  let structuralAlphaTotalPct: number | null = null;
  let cumulativeAlphaAnchorDate: string | null =
    theme?.createdAt != null && String(theme.createdAt).trim().length >= 10
      ? String(theme.createdAt).trim().slice(0, 10)
      : null;

  if (matching.length > 0) {
    const tickers = [...new Set(matching.map((r) => String(r.ticker)))];
    const tPlaceholders = tickers.map(() => "?").join(",");
    const tAlphaQ = perf.enabled ? Date.now() : 0;
    const a = await db.execute({
      sql: `SELECT ticker, alpha_value, recorded_at, close_price FROM alpha_history
            WHERE user_id = ? AND benchmark_ticker = ? AND ticker IN (${tPlaceholders})
            ORDER BY ticker ASC, recorded_at ASC`,
      args: [userId, SIGNAL_BENCHMARK_TICKER, ...tickers],
    });
    if (perf.enabled && perf.requestId) {
      console.log(`[perf] ${perf.requestId} alphaHistoryQuery ms=${Date.now() - tAlphaQ} tickers=${tickers.length}`);
    }

    const rows = a.rows as Record<string, unknown>[];
    const byTicker = buildByTickerFromAlphaRows(rows);
    const byTickerDated = buildByTickerDatedAlphaRows(rows);
    const drafts = buildDraftsFromHoldingRows(
      matching,
      byTicker,
      researchByTicker,
      fxUsdJpy,
      hybridPriceByHoldingKey,
    );
    themeTotalMarketValue = drafts.reduce((s, d) => s + sanitizeMarketValueForAggregation(d.marketValue), 0);
    stocks = finalizeStocksFromDrafts(drafts, themeTotalMarketValue);
    themeAverageUnrealizedPnlPercent = computeThemeAverageUnrealizedPnlPercent(stocks);
    themeAverageAlpha = computePortfolioAverageAlpha(stocks);

    const startAnchor =
      theme?.createdAt != null && String(theme.createdAt).trim().length > 0
        ? String(theme.createdAt)
        : (() => {
            let min = "";
            for (const tk of tickers) {
              const dr = byTickerDated.get(tk);
              if (dr == null || dr.length === 0) continue;
              const y = dr[0]!.recordedAt.slice(0, 10);
              if (min.length === 0 || y < min) min = y;
            }
            return min.length > 0 ? min : "1970-01-01";
          })();

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

    cumulativeAlphaSeries = mergeWeightedCumulativeAlphaSeries(perTicker);
    if (cumulativeAlphaSeries.length > 0) {
      structuralAlphaTotalPct = cumulativeAlphaSeries[cumulativeAlphaSeries.length - 1]!.cumulative;
    }
    if (cumulativeAlphaAnchorDate == null && cumulativeAlphaSeries.length > 0) {
      cumulativeAlphaAnchorDate = cumulativeAlphaSeries[0]!.date;
    }
  }

  const ecosystem =
    theme?.id != null
      ? await fetchEnrichedThemeEcosystem(
          db,
          userId,
          theme.id,
          portfolioTickerSet,
          theme.createdAt != null ? String(theme.createdAt) : null,
          perf,
          { fast },
        )
      : [];
  if (perf.enabled && perf.requestId) {
    console.log(`[perf] ${perf.requestId} getThemeDetailData totalMs=${Date.now() - t0} theme="${themeName}"`);
  }

  return {
    themeName,
    theme,
    stocks,
    themeTotalMarketValue,
    themeAverageUnrealizedPnlPercent,
    themeAverageAlpha,
    benchmarkLatestPrice: benchmarkSnap.close,
    ecosystem,
    cumulativeAlphaSeries,
    structuralAlphaTotalPct,
    cumulativeAlphaAnchorDate,
  };
}

/**
 * ダッシュボード用: 保有の Alpha 履歴・最新終値・円ベース評価額・ウェイト・構造別 / Core-Satellite 集計。
 * `holdings.quantity` と `avg_acquisition_price` は DB の現行値をそのまま使用（取引実行アクション更新後も再取得で反映）。
 * 数量 0 の銘柄（売却済み）は一覧・集計から除外する。
 */
export async function getDashboardData(db: Client, userId: string): Promise<DashboardData> {
  const h = await db.execute({
    sql: `SELECT id, ticker, name, quantity, avg_acquisition_price, structure_tags, sector, category, account_type, provider_symbol, valuation_factor, expectation_category
          FROM holdings
          WHERE user_id = ? AND quantity > 0
          ORDER BY ticker`,
    args: [userId],
  });

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
    return {
      stocks: [],
      allThemes,
      structureByTheme: [],
      structureBySector: [],
      coreSatellite: computeCoreSatellite([]),
      totalMarketValue: 0,
      summary: {
        portfolioAverageAlpha: 0,
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
  const tPlaceholders = tickers.map(() => "?").join(",");
  const [allThemes, a, benchmarkSnap, fxMaybe, totalRealizedPnlJpy, marketIndicators] = await Promise.all([
    fetchAllInvestmentThemes(db, userId),
    db.execute({
      // Match by user + benchmark + ticker only; `holding_id` may be NULL (orphaned rows still chart).
      sql: `SELECT ticker, alpha_value, recorded_at, close_price FROM alpha_history
            WHERE user_id = ? AND benchmark_ticker = ? AND ticker IN (${tPlaceholders})
            ORDER BY ticker ASC, recorded_at ASC`,
      args: [userId, SIGNAL_BENCHMARK_TICKER, ...tickers],
    }),
    resolveBenchmarkSnapshot(),
    resolveFxUsdJpyRate(),
    fetchTotalRealizedPnlJpy(db, userId),
    fetchGlobalMarketIndicators(),
  ]);

  const byTicker = buildByTickerFromAlphaRows(a.rows as Record<string, unknown>[]);
  const fxUsdJpy = fxMaybe != null && Number.isFinite(fxMaybe) && fxMaybe > 0 ? fxMaybe : USD_JPY_RATE_FALLBACK;
  const holdingRowsForDash = h.rows as unknown as HoldingQueryRow[];
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
  const drafts = buildDraftsFromHoldingRows(
    holdingRowsForDash,
    byTicker,
    researchByTicker,
    fxUsdJpy,
    hybridPriceByHoldingKey,
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
  const summary = {
    portfolioAverageAlpha: computePortfolioAverageAlpha(stocks),
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

  return { stocks, allThemes, structureByTheme, structureBySector, coreSatellite, totalMarketValue, summary };
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
          WHERE h.user_id = ? AND s.is_resolved = 0
          ORDER BY s.detected_at DESC
          LIMIT 50`,
    args: [userId],
  });

  return rs.rows.map((row) => {
    const isWarn = String(row.signal_type) === "WARN";
    const isBuy = String(row.signal_type) === "BUY";
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
      countryName: instrumentKind === "JP_INVESTMENT_TRUST" ? "日本" : "米国",
      nextEarningsDate: null,
      daysToEarnings: null,
      annualDividendRate: null,
      dividendYieldPercent: null,
      tag,
      alphaHistory: [alpha],
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
      marketValue: 0,
      valuationFactor: 1,
      isWarning: isWarn,
      isBuy: isBuy,
      currentAlpha: alpha,
      detectedAt: row.detected_at != null ? String(row.detected_at) : "",
      providerSymbol:
        row.provider_symbol != null && String(row.provider_symbol).length > 0 ? String(row.provider_symbol) : null,
      expectationCategory: parseExpectationCategory(row.expectation_category),
    };
  });
}
