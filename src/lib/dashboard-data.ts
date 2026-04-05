import type { Client } from "@libsql/client";

import type {
  CoreSatelliteBreakdown,
  DashboardData,
  HoldingCategory,
  Signal,
  Stock,
  StructureTagSlice,
  TickerInstrumentKind,
} from "@/src/types/investment";
import {
  classifyTickerInstrument,
  convertValueToJpy,
  dailyReturnPercent,
  quoteCurrencyForDashboardWeights,
  roundAlphaMetric,
  SIGNAL_BENCHMARK_TICKER,
} from "@/src/lib/alpha-logic";
import {
  aggregateByHoldingSector,
  aggregateByTheme,
  sanitizeMarketValueForAggregation,
  sectorFromStructureTags,
  themeFromStructureTags,
} from "@/src/lib/structure-tags";
import { fetchLatestPrice } from "@/src/lib/price-service";

const TARGET_CORE_PERCENT = 90;

type AlphaPoint = { alpha: number; close: number | null };

function asCategory(raw: string): HoldingCategory {
  return raw === "Core" ? "Core" : "Satellite";
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
 * `quantity × latest_close × valuation_factor × (USD_JPY_RATE if quote is USD, else 1)`.
 */
export function normalizedHoldingValueJpy(input: {
  ticker: string;
  quantity: number;
  currentPrice: number | null;
  valuationFactor: number;
}): number {
  const { ticker, quantity, currentPrice, valuationFactor } = input;
  if (currentPrice == null || !Number.isFinite(currentPrice) || currentPrice <= 0) return 0;
  if (!Number.isFinite(quantity) || quantity <= 0) return 0;
  const f = Number.isFinite(valuationFactor) && valuationFactor > 0 ? valuationFactor : 1;
  const base = quantity * currentPrice * f;
  const ccy = quoteCurrencyForDashboardWeights(ticker);
  return convertValueToJpy(base, ccy);
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

async function resolveBenchmarkLatestClose(): Promise<number> {
  try {
    const snap = await fetchLatestPrice(SIGNAL_BENCHMARK_TICKER);
    if (snap != null && Number.isFinite(snap.close) && snap.close > 0) return snap.close;
  } catch {
    /* Yahoo 失敗時は 0（UI は —） */
  }
  return 0;
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

/**
 * ダッシュボード用: 保有の Alpha 履歴・最新終値・円ベース評価額・ウェイト・構造別 / Core-Satellite 集計。
 * `holdings.quantity` と `avg_acquisition_price` は DB の現行値をそのまま使用（取引実行アクション更新後も再取得で反映）。
 */
export async function getDashboardData(db: Client, userId: string): Promise<DashboardData> {
  const h = await db.execute({
    sql: `SELECT id, ticker, name, quantity, avg_acquisition_price, structure_tags, sector, category, provider_symbol, valuation_factor
          FROM holdings
          WHERE user_id = ?
          ORDER BY ticker`,
    args: [userId],
  });

  const holdingIds = h.rows.map((r) => String(r.id));
  if (holdingIds.length === 0) {
    const [benchmarkLatestPrice, totalRealizedPnlJpy] = await Promise.all([
      resolveBenchmarkLatestClose(),
      fetchTotalRealizedPnlJpy(db, userId),
    ]);
    const financial = computeFinancialTotals([], totalRealizedPnlJpy);
    return {
      stocks: [],
      structureByTheme: [],
      structureBySector: [],
      coreSatellite: computeCoreSatellite([]),
      totalMarketValue: 0,
      summary: {
        portfolioAverageAlpha: 0,
        benchmarkLatestPrice,
        totalHoldings: 0,
        ...financial,
      },
    };
  }

  const placeholders = holdingIds.map(() => "?").join(",");
  const [a, benchmarkLatestPrice, totalRealizedPnlJpy] = await Promise.all([
    db.execute({
      sql: `SELECT holding_id, alpha_value, recorded_at, close_price FROM alpha_history
            WHERE benchmark_ticker = ? AND holding_id IN (${placeholders})
            ORDER BY recorded_at ASC`,
      args: [SIGNAL_BENCHMARK_TICKER, ...holdingIds],
    }),
    resolveBenchmarkLatestClose(),
    fetchTotalRealizedPnlJpy(db, userId),
  ]);

  const byHolding = new Map<string, AlphaPoint[]>();
  for (const row of a.rows) {
    const hid = String(row.holding_id);
    if (!byHolding.has(hid)) byHolding.set(hid, []);
    byHolding.get(hid)!.push({
      alpha: Number(row.alpha_value),
      close: row.close_price != null && Number.isFinite(Number(row.close_price)) ? Number(row.close_price) : null,
    });
  }

  type Draft = Omit<Stock, "weight"> & { structureTagsJson: string };

  const drafts: Draft[] = h.rows.map((row) => {
    const id = String(row.id);
    const ticker = String(row.ticker);
    const series = byHolding.get(id) ?? [];
    const alphaHistory = series.map((p) => p.alpha);
    const currentPrice = latestCloseFromSeries(series);
    const qty = Number(row.quantity);
    const valuationFactor =
      row.valuation_factor != null && Number.isFinite(Number(row.valuation_factor))
        ? Number(row.valuation_factor)
        : 1;
    const providerSymbol =
      row.provider_symbol != null && String(row.provider_symbol).length > 0 ? String(row.provider_symbol) : null;
    const marketValue = normalizedHoldingValueJpy({
      ticker,
      quantity: qty,
      currentPrice,
      valuationFactor,
    });
    const rawStructureTags = row.structure_tags;
    const tagsJson = rawStructureTags == null ? "[]" : String(rawStructureTags);
    const sector = parseSector(row.sector);
    const instrumentKind = classifyTickerInstrument(ticker);
    const avgAcquisitionPrice = parseAvgAcquisitionPrice(row.avg_acquisition_price);
    const { local: unrealizedPnlLocal, percent: unrealizedPnlPercent } = computeUnrealizedPnlLocal(
      currentPrice,
      avgAcquisitionPrice,
      qty,
      valuationFactor,
    );
    const unrealizedPnlJpy = convertValueToJpy(unrealizedPnlLocal, quoteCurrencyForInstrument(instrumentKind));
    const two = lastTwoClosesFromSeries(series);
    const dayChangeRaw =
      two != null ? dailyReturnPercent(two.prevClose, two.latestClose) : null;
    const dayChangePercent =
      dayChangeRaw != null && Number.isFinite(dayChangeRaw) ? roundAlphaMetric(dayChangeRaw) : null;

    return {
      id,
      ticker,
      name: row.name != null ? String(row.name) : "",
      tag: rawStructureTags == null ? "" : themeFromStructureTags(tagsJson),
      alphaHistory,
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
    };
  });

  const totalMarketValue = drafts.reduce(
    (s, d) => s + sanitizeMarketValueForAggregation(d.marketValue),
    0,
  );

  const stocks: Stock[] = drafts.map((d) => {
    const mv = sanitizeMarketValueForAggregation(d.marketValue);
    return {
      id: d.id,
      ticker: d.ticker,
      name: d.name,
      tag: d.tag,
      alphaHistory: d.alphaHistory,
      quantity: d.quantity,
      category: d.category,
      avgAcquisitionPrice: d.avgAcquisitionPrice,
      unrealizedPnlLocal: d.unrealizedPnlLocal,
      unrealizedPnlJpy: d.unrealizedPnlJpy,
      unrealizedPnlPercent: d.unrealizedPnlPercent,
      dayChangePercent: d.dayChangePercent,
      instrumentKind: d.instrumentKind,
      secondaryTag: d.secondaryTag,
      sector: d.sector,
      currentPrice: d.currentPrice,
      marketValue: mv,
      valuationFactor: d.valuationFactor,
      providerSymbol: d.providerSymbol,
      weight: totalMarketValue > 0 ? Math.round((mv / totalMarketValue) * 10000) / 100 : 0,
    };
  });

  const aggRows = drafts.map((d) => ({ structureTagsJson: d.structureTagsJson, marketValue: d.marketValue }));
  const structureByTheme = aggregateByTheme(aggRows);
  const structureBySector = aggregateByHoldingSector(
    drafts.map((d) => ({ sector: d.sector, structureTagsJson: d.structureTagsJson, marketValue: d.marketValue })),
  );

  const coreSatellite = computeCoreSatellite(stocks);

  const financial = computeFinancialTotals(stocks, totalRealizedPnlJpy);
  const summary = {
    portfolioAverageAlpha: computePortfolioAverageAlpha(stocks),
    benchmarkLatestPrice,
    totalHoldings: stocks.length,
    ...financial,
  };

  return { stocks, structureByTheme, structureBySector, coreSatellite, totalMarketValue, summary };
}

export async function fetchStocksForUser(db: Client, userId: string): Promise<Stock[]> {
  const { stocks } = await getDashboardData(db, userId);
  return stocks;
}

/** Unresolved signals for dashboard cards (`id` is the `signals.id` row). */
export async function fetchUnresolvedSignalsForUser(db: Client, userId: string): Promise<Signal[]> {
  const rs = await db.execute({
    sql: `SELECT s.id AS signal_id, s.signal_type, s.alpha_at_signal, s.detected_at,
                 h.ticker, h.name, h.structure_tags, h.sector, h.provider_symbol, h.category
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
      currentPrice: null,
      marketValue: 0,
      valuationFactor: 1,
      isWarning: isWarn,
      isBuy: isBuy,
      currentAlpha: alpha,
      detectedAt: row.detected_at != null ? String(row.detected_at) : "",
      providerSymbol:
        row.provider_symbol != null && String(row.provider_symbol).length > 0 ? String(row.provider_symbol) : null,
    };
  });
}
