import type { Client } from "@libsql/client";

import { NAPHTHA_DEFAULT_YAHOO_PROXY, NAPHTHA_WATCH_PRIORITY } from "@/src/config/naphtha-watchlist";
import { isEdoCircularThemeName } from "@/src/lib/edo-theme-constants";
import {
  dailyReturnPercentByDate,
  detectSpikeDates,
  meanNonNull,
  MIN_PAIRS_FOR_CORRELATION,
  NAPHTHA_DEFAULT_LOOKBACK_DAYS,
  NAPHTHA_SPIKE_ABS_DAILY_PCT,
  pearsonCorrelation,
} from "@/src/lib/naphtha-correlation-engine";
import { computeAlphaPercent, dailyReturnPercent, SIGNAL_BENCHMARK_TICKER } from "@/src/lib/alpha-logic";
import { fetchPriceHistory, type PriceBar } from "@/src/lib/price-service";
import type { NaphthaCorrelationChartData } from "@/src/types/naphtha";
import type { ThemeEcosystemWatchItem } from "@/src/types/investment";

const BENCH = SIGNAL_BENCHMARK_TICKER;
const NAPHTHA_SYMBOL = "NAPHTHA";

export function alphaDataKeyForTicker(ticker: string): string {
  return `alpha_${ticker.replace(/[^a-zA-Z0-9]/g, "_")}`;
}

type WatchRow = {
  memberId: string;
  /** Yahoo / Alpha 取得に使うティッカー（未上場時は proxy） */
  fetchTicker: string;
  /** チャート dataKey 安定化用（優先リスト側の銘柄コード） */
  displayKeyTicker: string;
  labelJa: string;
};

function resolveProxySymbol(): string {
  const fromEnv = process.env.NAPHTHA_YAHOO_SYMBOL?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : NAPHTHA_DEFAULT_YAHOO_PROXY;
}

function resolveLookbackDays(): number {
  const n = Number(process.env.NAPHTHA_LOOKBACK_DAYS);
  if (Number.isFinite(n) && n >= 30 && n <= 200) return Math.floor(n);
  return NAPHTHA_DEFAULT_LOOKBACK_DAYS;
}

export function resolveNaphthaWatchRows(ecosystem: ThemeEcosystemWatchItem[]): WatchRow[] {
  const byUpper = new Map(
    ecosystem.map((e) => [e.ticker.trim().toUpperCase(), e] as const),
  );
  const out: WatchRow[] = [];
  for (const p of NAPHTHA_WATCH_PRIORITY) {
    const m = byUpper.get(p.ticker.toUpperCase());
    if (m == null) continue;
    if (m.isUnlisted) {
      const proxy = m.proxyTicker?.trim();
      if (proxy == null || proxy.length === 0) continue;
      out.push({
        memberId: m.id,
        fetchTicker: proxy,
        displayKeyTicker: p.ticker,
        labelJa: p.shortLabelJa,
      });
    } else {
      out.push({
        memberId: m.id,
        fetchTicker: m.ticker.trim(),
        displayKeyTicker: p.ticker,
        labelJa: p.shortLabelJa,
      });
    }
  }
  return out;
}

async function loadCommodityPricesFromDb(
  db: Client,
  symbol: string,
  limit: number,
): Promise<{ date: string; price: number }[]> {
  try {
    const rs = await db.execute({
      sql: `SELECT price, timestamp FROM commodity_prices WHERE symbol = ? ORDER BY timestamp DESC LIMIT ?`,
      args: [symbol, limit],
    });
    const rows = rs.rows as unknown as { price: unknown; timestamp: unknown }[];
    const out: { date: string; price: number }[] = [];
    for (const r of rows) {
      const pr = Number(r.price);
      const ts = r.timestamp != null ? String(r.timestamp) : "";
      if (!Number.isFinite(pr) || pr <= 0 || ts.length < 10) continue;
      out.push({ date: ts.slice(0, 10), price: pr });
    }
    return out.sort((a, b) => a.date.localeCompare(b.date));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.toLowerCase().includes("no such table")) return [];
    throw e;
  }
}

function mergePriceSeries(
  dbPoints: { date: string; price: number }[],
  yahooBars: PriceBar[],
): { merged: { date: string; price: number }[]; source: "db" | "yahoo" | "merged" } {
  const map = new Map<string, number>();
  for (const b of yahooBars) {
    const d = b.date.slice(0, 10);
    if (d.length === 10) map.set(d, b.close);
  }
  for (const p of dbPoints) {
    map.set(p.date.slice(0, 10), p.price);
  }
  const dates = [...map.keys()].filter((d) => d.length === 10).sort();
  const merged = dates.map((d) => ({ date: d, price: map.get(d)! }));
  const source: "db" | "yahoo" | "merged" =
    dbPoints.length === 0 ? "yahoo" : yahooBars.length === 0 ? "db" : "merged";
  return { merged, source };
}

function dailyAlphaVsBenchmarkByDate(stockBars: PriceBar[], benchBars: PriceBar[]): Map<string, number> {
  const benchBy = new Map(benchBars.map((b) => [b.date.slice(0, 10), b.close]));
  const stockBy = new Map(stockBars.map((b) => [b.date.slice(0, 10), b.close]));
  const shared = [...new Set([...stockBy.keys()].filter((d) => benchBy.has(d)))].sort();
  const out = new Map<string, number>();
  for (let i = 1; i < shared.length; i++) {
    const dPrev = shared[i - 1]!;
    const dCur = shared[i]!;
    const s0 = stockBy.get(dPrev);
    const s1 = stockBy.get(dCur);
    const b0 = benchBy.get(dPrev);
    const b1 = benchBy.get(dCur);
    if (s0 == null || s1 == null || b0 == null || b1 == null) continue;
    const rStock = dailyReturnPercent(s0, s1);
    const rBench = dailyReturnPercent(b0, b1);
    const a = computeAlphaPercent(rStock, rBench);
    if (a != null && Number.isFinite(a)) out.set(dCur, a);
  }
  return out;
}

function pctLagFromEnd(points: { date: string; price: number }[], lagSessions: number): number | null {
  if (points.length < lagSessions + 1) return null;
  const last = points[points.length - 1]!.price;
  const prev = points[points.length - 1 - lagSessions]!.price;
  if (!(last > 0) || !(prev > 0)) return null;
  return ((last - prev) / prev) * 100;
}

function isMissingNaphthaSchema(e: unknown): boolean {
  const m = e instanceof Error ? e.message : String(e);
  return m.includes("naphtha_correlation_score") || m.includes("commodity_prices") || m.includes("no such column");
}

async function persistMemberScores(
  db: Client,
  themeId: string,
  scores: { memberId: string; score: number | null; transition: boolean }[],
): Promise<void> {
  if (scores.length === 0) return;
  try {
    for (const s of scores) {
      await db.execute({
        sql: `UPDATE theme_ecosystem_members SET naphtha_correlation_score = ?, transition_threshold = ?
              WHERE id = ? AND theme_id = ?`,
        args: [s.score, s.transition ? 1 : 0, s.memberId, themeId],
      });
    }
  } catch (e) {
    if (isMissingNaphthaSchema(e)) return;
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[naphtha] persistMemberScores skipped: ${msg}`);
  }
}

/**
 * 江戸循環テーマのテーマ詳細用: ナフサ（プロキシ）価格 + 監視銘柄の対 VOO 日次 Alpha を合成。
 * `fast` モードでは null。
 */
export async function fetchNaphthaCorrelationChartBundle(input: {
  db: Client;
  themeName: string;
  themeId: string | null;
  ecosystem: ThemeEcosystemWatchItem[];
  fast?: boolean;
}): Promise<NaphthaCorrelationChartData | null> {
  const { db, themeName, themeId, ecosystem, fast } = input;
  if (fast || !isEdoCircularThemeName(themeName) || themeId == null) return null;

  const watch = resolveNaphthaWatchRows(ecosystem);
  if (watch.length === 0) return null;

  const lookbackDays = resolveLookbackDays();
  const proxyYahoo = resolveProxySymbol();

  const [dbPrices, yahooNaphtha, vooBars] = await Promise.all([
    loadCommodityPricesFromDb(db, NAPHTHA_SYMBOL, lookbackDays + 30),
    fetchPriceHistory(proxyYahoo, lookbackDays + 30, null, { forAlpha: true }),
    fetchPriceHistory(BENCH, lookbackDays + 30, null, { forAlpha: true }),
  ]);

  const { merged: pricePoints, source: priceSource } = mergePriceSeries(dbPrices, yahooNaphtha);
  if (pricePoints.length < 5) return null;

  const trimStart = Math.max(0, pricePoints.length - lookbackDays - 5);
  const priceTrimmed = pricePoints.slice(trimStart);

  const nDates = priceTrimmed.map((p) => p.date);
  const nCloses = priceTrimmed.map((p) => p.price);
  const naphthaReturnByDate = dailyReturnPercentByDate(nDates, nCloses);
  const spikeDates = detectSpikeDates(naphthaReturnByDate, NAPHTHA_SPIKE_ABS_DAILY_PCT);

  const alphaMaps: { watch: WatchRow; map: Map<string, number> }[] = [];
  await Promise.all(
    watch.map(async (w) => {
      const stockBars = await fetchPriceHistory(w.fetchTicker, lookbackDays + 35, null, { forAlpha: true });
      const map = dailyAlphaVsBenchmarkByDate(stockBars, vooBars);
      alphaMaps.push({ watch: w, map });
    }),
  );

  const dateSet = new Set<string>();
  for (const d of naphthaReturnByDate.keys()) dateSet.add(d);
  for (const { map } of alphaMaps) {
    for (const d of map.keys()) dateSet.add(d);
  }
  const allDates = [...dateSet].sort();

  const alphaSeries = watch.map((w) => ({
    dataKey: alphaDataKeyForTicker(w.displayKeyTicker),
    labelJa: w.labelJa,
    ticker: w.displayKeyTicker,
  }));

  const priceByDate = new Map(priceTrimmed.map((p) => [p.date, p.price]));
  const alphaComboRows: Record<string, number | string | null>[] = [];
  for (const d of allDates) {
    const row: Record<string, number | string | null> = { date: d };
    row.naphthaPrice = priceByDate.get(d) ?? null;
    for (const { watch: w, map } of alphaMaps) {
      const key = alphaDataKeyForTicker(w.displayKeyTicker);
      row[key] = map.get(d) ?? null;
    }
    alphaComboRows.push(row);
  }

  const nArr: number[] = [];
  const meanAlphaArr: number[] = [];
  for (const d of allDates) {
    const nr = naphthaReturnByDate.get(d);
    const alphas = alphaMaps.map(({ map }) => map.get(d) ?? null);
    const m = meanNonNull(alphas);
    if (nr != null && Number.isFinite(nr) && m != null) {
      nArr.push(nr);
      meanAlphaArr.push(m);
    }
  }

  let aggregateCorrelation: number | null = null;
  if (nArr.length >= MIN_PAIRS_FOR_CORRELATION) {
    aggregateCorrelation = pearsonCorrelation(nArr, meanAlphaArr);
  }

  const scoresForDb: { memberId: string; score: number | null; transition: boolean }[] = [];
  for (const { watch: w, map } of alphaMaps) {
    const na: number[] = [];
    const aa: number[] = [];
    for (const d of allDates) {
      const nr = naphthaReturnByDate.get(d);
      const a = map.get(d);
      if (nr != null && a != null && Number.isFinite(nr) && Number.isFinite(a)) {
        na.push(nr);
        aa.push(a);
      }
    }
    let score: number | null = null;
    if (na.length >= MIN_PAIRS_FOR_CORRELATION) {
      score = pearsonCorrelation(na, aa);
    }
    const lowCorr = score != null && score < 0.15;
    const recentSpike = spikeDates.some((sd) => {
      const last = priceTrimmed[priceTrimmed.length - 1]?.date ?? "";
      if (last.length !== 10) return false;
      const spikeRank = allDates.indexOf(sd);
      const lastRank = allDates.indexOf(last);
      return spikeRank >= 0 && lastRank - spikeRank <= 8;
    });
    const transition = lowCorr || recentSpike;
    scoresForDb.push({ memberId: w.memberId, score, transition });
  }

  await persistMemberScores(db, themeId, scoresForDb);

  const change24hPct = pctLagFromEnd(priceTrimmed, 1);
  const change7dPct = pctLagFromEnd(priceTrimmed, 5);

  return {
    lookbackDays,
    naphthaProxyYahooSymbol: proxyYahoo,
    priceArea: priceTrimmed.map((p) => ({ date: p.date, price: p.price })),
    alphaComboRows,
    alphaSeries,
    spikeDates,
    aggregateCorrelation,
    correlationPairCount: nArr.length,
    change24hPct,
    change7dPct,
    priceSource,
  };
}
