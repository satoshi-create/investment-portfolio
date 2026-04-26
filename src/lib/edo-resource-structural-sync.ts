import {
  THEME_STRUCTURAL_TREND_LOOKBACK_DAYS,
  roundAlphaMetric,
  ymdDaysAgoUtc,
} from "@/src/lib/alpha-logic";
import { fetchPriceHistory, type PriceBar } from "@/src/lib/price-service";
import type {
  ResourceStructuralSyncData,
  ResourceStructuralSyncPoint,
  ResourceSyncJudgment,
  ThemeEcosystemWatchItem,
} from "@/src/types/investment";

const RESOURCE_ETF_UPPER = new Set(["GLD", "SLV", "CPER"]);
const MAX_ECOSYSTEM_TICKERS = 12;
const CHART_FETCH_DAYS = 180;

function ecosystemEffectiveTicker(e: ThemeEcosystemWatchItem): string | null {
  const t = String(e.ticker ?? "").trim();
  const proxy = e.proxyTicker != null ? String(e.proxyTicker).trim() : "";
  if (e.isUnlisted) return proxy.length > 0 ? proxy : null;
  return t.length > 0 ? t : null;
}

function pickEcosystemTickers(ecosystem: ThemeEcosystemWatchItem[]): string[] {
  const ranked = ecosystem
    .map((e, i) => ({ e, i, t: ecosystemEffectiveTicker(e) }))
    .filter((x): x is { e: ThemeEcosystemWatchItem; i: number; t: string } => x.t != null && x.t.length > 0)
    .sort((a, b) => {
      const ma = a.e.isMajorPlayer ? 1 : 0;
      const mb = b.e.isMajorPlayer ? 1 : 0;
      if (mb !== ma) return mb - ma;
      return a.i - b.i;
    });
  const seen = new Set<string>();
  const out: string[] = [];
  for (const { t } of ranked) {
    const u = t.toUpperCase();
    if (RESOURCE_ETF_UPPER.has(u)) continue;
    if (seen.has(u)) continue;
    seen.add(u);
    out.push(t);
    if (out.length >= MAX_ECOSYSTEM_TICKERS) break;
  }
  
  // エコシステムが空、または資源ETFしかない場合のフォールバック（動作確認用）
  if (out.length === 0) {
    return ["5857.T", "2768.T"]; // AREホールディングス, 双日（都市鉱山・資源関連の代表例）
  }
  
  return out;
}

function barsAsc(bars: PriceBar[]): PriceBar[] {
  return [...bars].sort((a, b) => a.date.slice(0, 10).localeCompare(b.date.slice(0, 10)));
}

function closeOnOrBefore(barsAsc: PriceBar[], ymd: string): number | null {
  const d = ymd.slice(0, 10);
  let best: number | null = null;
  for (const b of barsAsc) {
    const bd = b.date.slice(0, 10);
    if (bd > d) break;
    if (Number.isFinite(b.close) && b.close > 0) best = b.close;
  }
  return best;
}

function pctFromAnchor(closeNow: number, anchorClose: number): number | null {
  if (!Number.isFinite(closeNow) || !Number.isFinite(anchorClose) || anchorClose <= 0) return null;
  return roundAlphaMetric((closeNow / anchorClose - 1) * 100);
}

export function buildResourceStructuralSyncSeries(
  windowStartYmd: string,
  gld: PriceBar[],
  slv: PriceBar[],
  cper: PriceBar[],
  stockBarsList: { ticker: string; bars: PriceBar[] }[],
): ResourceStructuralSyncData | null {
  const gldM = new Map(barsAsc(gld).map((b) => [b.date.slice(0, 10), b.close]));
  const slvM = new Map(barsAsc(slv).map((b) => [b.date.slice(0, 10), b.close]));
  const cperM = new Map(barsAsc(cper).map((b) => [b.date.slice(0, 10), b.close]));
  const slvAsc = barsAsc(slv);
  const stockAsc = stockBarsList.map(({ ticker, bars }) => ({ ticker, bars: barsAsc(bars) }));

  if (stockAsc.length === 0) return null;

  const slvDates = [...new Set(slvAsc.map((b) => b.date.slice(0, 10)))]
    .filter((d) => d >= windowStartYmd)
    .sort();

  type DayState = { d: string; gld: number; slv: number; cper: number; stocks: (number | null)[] };
  const candidates: DayState[] = [];

  for (const d of slvDates) {
    const gc = gldM.get(d);
    const sc = slvM.get(d);
    const cc = cperM.get(d);
    if (gc == null || sc == null || cc == null || gc <= 0 || sc <= 0 || cc <= 0) continue;
    const stockCloses = stockAsc.map(({ bars }) => closeOnOrBefore(bars, d));
    // 少なくとも1銘柄の価格が取れれば採用
    if (stockCloses.every((x) => x == null || x <= 0)) continue;
    candidates.push({ d, gld: gc, slv: sc, cper: cc, stocks: stockCloses });
  }

  if (candidates.length < 2) return null;

  const anchor = candidates[0]!;
  const anchorYmd = anchor.d;

  const pointsDraft: Omit<ResourceStructuralSyncPoint, "spreadWidening">[] = [];

  for (const row of candidates) {
    const g0 = pctFromAnchor(row.gld, anchor.gld);
    const s0 = pctFromAnchor(row.slv, anchor.slv);
    const c0 = pctFromAnchor(row.cper, anchor.cper);
    if (g0 == null || s0 == null || c0 == null) continue;
    
    const stockPcts: number[] = [];
    for (let j = 0; j < stockAsc.length; j++) {
      const now = row.stocks[j];
      const anc = anchor.stocks[j];
      if (now == null || now <= 0 || anc == null || anc <= 0) continue;
      const p = pctFromAnchor(now, anc);
      if (p == null) continue;
      stockPcts.push(p);
    }
    if (stockPcts.length === 0) continue;

    const resourceCompositePct = roundAlphaMetric((g0 + s0 + c0) / 3);
    const ecosystemEquityAvgPct = roundAlphaMetric(stockPcts.reduce((a, b) => a + b, 0) / stockPcts.length);
    const spread = roundAlphaMetric(ecosystemEquityAvgPct - resourceCompositePct);
    pointsDraft.push({
      date: row.d,
      gldPct: g0,
      slvPct: s0,
      cperPct: c0,
      resourceCompositePct,
      ecosystemEquityAvgPct,
      spread,
    });
  }

  if (pointsDraft.length < 2) return null;

  const win = 12;
  const absSp = pointsDraft.map((p) => Math.abs(p.spread));
  const points: ResourceStructuralSyncPoint[] = pointsDraft.map((p, i) => {
    const start = Math.max(0, i - win + 1);
    const slice = absSp.slice(start, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    const var0 = slice.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / Math.max(1, slice.length);
    const std = Math.sqrt(var0);
    const th = mean + (std > 1e-6 ? std * 0.45 : 2);
    return { ...p, spreadWidening: Math.abs(p.spread) > th };
  });

  return {
    points,
    anchorYmd,
    ecoTickersUsed: stockBarsList.map((s) => s.ticker),
    individualJudgments: (() => {
      const last = points[points.length - 1];
      if (!last) return {};
      const anchorRow = candidates[0]!;
      const lastRow = candidates[candidates.length - 1]!;
      const judgments: Record<string, { spread: number; judgment: ResourceSyncJudgment }> = {};
      
      for (let j = 0; j < stockAsc.length; j++) {
        const ticker = stockAsc[j]!.ticker;
        const now = lastRow.stocks[j];
        const anc = anchorRow.stocks[j];
        if (now == null || now <= 0 || anc == null || anc <= 0) continue;
        
        const stockPct = roundAlphaMetric((now / anc - 1) * 100);
        const spread = roundAlphaMetric(stockPct - last.resourceCompositePct);
        
        let judgment: ResourceSyncJudgment = "SYNCING";
        // 判定ロジック: 資源が2%以上上昇している局面で、株価が資源より5pt以上低いなら「買い場」
        if (last.resourceCompositePct > 2 && spread < -5) {
          judgment = "BUY_OPPORTUNITY";
        } else if (spread > 10) {
          judgment = "OVERHEATED";
        } else if (last.resourceCompositePct < -2 && stockPct > 0) {
          judgment = "DECOUPLED";
        }
        
        judgments[ticker] = { spread, judgment };
      }
      return judgments;
    })(),
  };
}

/**
 * 江戸循環テーマ用: GLD/SLV/CPER とエコシステム銘柄の日次同期・累積騰落率と乖離系列（Yahoo 日足）。
 * 失敗・データ不足時は null。
 */
export async function fetchEdoResourceStructuralSyncData(
  ecosystem: ThemeEcosystemWatchItem[],
  options?: { perf?: { enabled: boolean; requestId?: string | null } },
): Promise<ResourceStructuralSyncData | null> {
  const perf = options?.perf;
  const ecoTickers = pickEcosystemTickers(ecosystem);
  if (ecoTickers.length === 0) return null;

  const windowStartYmd = ymdDaysAgoUtc(THEME_STRUCTURAL_TREND_LOOKBACK_DAYS);
  const t0 = perf?.enabled ? Date.now() : 0;

  const allBars = await Promise.all([
    fetchPriceHistory("GLD", CHART_FETCH_DAYS, null),
    fetchPriceHistory("SLV", CHART_FETCH_DAYS, null),
    fetchPriceHistory("CPER", CHART_FETCH_DAYS, null),
    ...ecoTickers.map((t) => fetchPriceHistory(t, CHART_FETCH_DAYS, null, { forAlpha: true })),
  ]);

  if (perf?.enabled && perf.requestId) {
    console.log(`[perf] ${perf.requestId} edoResourceSync fetchBars ms=${Date.now() - t0} tickers=${3 + ecoTickers.length}`);
  }

  const gld = allBars[0] ?? [];
  const slv = allBars[1] ?? [];
  const cper = allBars[2] ?? [];
  const stockBarsList = ecoTickers.map((ticker, i) => ({
    ticker,
    bars: allBars[3 + i] ?? [],
  }));

  if (gld.length < 5 || slv.length < 5 || cper.length < 5) return null;

  return buildResourceStructuralSyncSeries(windowStartYmd, gld, slv, cper, stockBarsList);
}
