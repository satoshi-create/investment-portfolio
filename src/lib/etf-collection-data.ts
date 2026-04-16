import type { Client } from "@libsql/client";

import {
  calculateCumulativeAlpha,
  computeRotationRadarVector,
  computeAlphaDeviationZScore,
  computeEtfTrackingAlphaPercent,
  computeExpenseRatioDragPercent,
  computeRegionalMomentum,
  roundAlphaMetric,
  toYmd,
  ymdDaysAgoUtc,
  type DatedAlphaRow,
  type RegionMomentumOutput,
  type RotationRadarPoint,
} from "@/src/lib/alpha-logic";
import { USD_JPY_RATE_FALLBACK } from "@/src/lib/fx-constants";
import { themeFromStructureTags } from "@/src/lib/structure-tags";
import { fetchRecentDatedDailyAlphasVsVoo, fetchUsdJpyRate } from "@/src/lib/price-service";

export type EtfRegionFilter = "ALL" | "GLOBAL_DEVELOPED" | "EMERGING_FRONTIER" | "THEMATIC_STRATA";

export type EtfDescriptor = {
  ticker: string;
  name: string;
  regionGroup: Exclude<EtfRegionFilter, "ALL">;
  /** Thematic Strata の細分類キー（Rotation Radar の Theme 集約用）。 */
  strataThemeKey?: string;
  geographyLabel: string; // e.g. "US", "EU", "India"
  geographyCode?: string; // e.g. "US", "EU", "IN"
  underlyingStructure: string;
  currency: "USD" | "JPY";
  expenseRatioPercent: number; // e.g. 0.03 for 0.03%
  purityScore: number; // 0..1
  liquidityScore: number; // 0..1
  relatedKeywords: string[]; // used for spillover matching
};

export const GLOBAL_STRATA_ETFS: EtfDescriptor[] = [
  {
    ticker: "VOO",
    name: "Vanguard S&P 500 ETF",
    regionGroup: "GLOBAL_DEVELOPED",
    strataThemeKey: "US_EQUITY_CORE",
    geographyLabel: "United States",
    geographyCode: "US",
    underlyingStructure: "米国の企業利益サイクル（世界の最終需要×自社株買い×資本効率）",
    currency: "USD",
    expenseRatioPercent: 0.03,
    purityScore: 0.92,
    liquidityScore: 0.98,
    relatedKeywords: ["米国", "US", "S&P", "消費", "資本効率"],
  },
  {
    ticker: "QQQ",
    name: "Invesco QQQ Trust (NASDAQ-100)",
    regionGroup: "GLOBAL_DEVELOPED",
    strataThemeKey: "US_TECH_PLATFORM",
    geographyLabel: "United States",
    geographyCode: "US",
    underlyingStructure: "米国テック覇権（AI・クラウド・ソフトウェアの利益プラットフォーム）",
    currency: "USD",
    expenseRatioPercent: 0.20,
    purityScore: 0.80,
    liquidityScore: 0.98,
    relatedKeywords: ["米国", "US", "NASDAQ", "AI", "クラウド", "ソフトウェア"],
  },
  {
    ticker: "VGK",
    name: "Vanguard FTSE Europe ETF",
    regionGroup: "GLOBAL_DEVELOPED",
    strataThemeKey: "EU_EQUITY",
    geographyLabel: "Europe",
    geographyCode: "EU",
    underlyingStructure: "欧州の価値・製造・資源循環（エネルギー転換と産業再配置）",
    currency: "USD",
    expenseRatioPercent: 0.06,
    purityScore: 0.82,
    liquidityScore: 0.90,
    relatedKeywords: ["欧州", "EU", "Europe", "製造", "資源", "エネルギー"],
  },
  {
    ticker: "EPI",
    name: "WisdomTree India Earnings Fund",
    regionGroup: "EMERGING_FRONTIER",
    strataThemeKey: "INDIA_EQUITY",
    geographyLabel: "India",
    geographyCode: "IN",
    underlyingStructure: "インド人口ボーナス×内需金融化（所得層の厚みと都市化）",
    currency: "USD",
    expenseRatioPercent: 0.84,
    purityScore: 0.72,
    liquidityScore: 0.75,
    relatedKeywords: ["インド", "India", "人口", "内需", "金融", "都市化"],
  },
  {
    ticker: "INDA",
    name: "iShares MSCI India ETF",
    regionGroup: "EMERGING_FRONTIER",
    strataThemeKey: "INDIA_EQUITY",
    geographyLabel: "India",
    geographyCode: "IN",
    underlyingStructure: "インドの広い株式市場（内需・製造・サービスの複合）",
    currency: "USD",
    expenseRatioPercent: 0.64,
    purityScore: 0.78,
    liquidityScore: 0.88,
    relatedKeywords: ["インド", "India", "MSCI", "内需", "製造", "サービス"],
  },
  {
    ticker: "MCHI",
    name: "iShares MSCI China ETF",
    regionGroup: "EMERGING_FRONTIER",
    strataThemeKey: "CHINA_EQUITY",
    geographyLabel: "China",
    geographyCode: "CN",
    underlyingStructure: "中国の政策・景気循環と巨大内需（製造・プラットフォーム・金融の再編）",
    currency: "USD",
    expenseRatioPercent: 0.59,
    purityScore: 0.70,
    liquidityScore: 0.90,
    relatedKeywords: ["中国", "China", "内需", "製造", "政策", "MSCI"],
  },
  {
    ticker: "EWJ",
    name: "iShares MSCI Japan ETF",
    regionGroup: "GLOBAL_DEVELOPED",
    strataThemeKey: "JAPAN_EQUITY",
    geographyLabel: "Japan",
    geographyCode: "JP",
    underlyingStructure: "日本の企業統治・円資産・輸出の質（高配当化と再投資の均衡）",
    currency: "USD",
    expenseRatioPercent: 0.50,
    purityScore: 0.86,
    liquidityScore: 0.92,
    relatedKeywords: ["日本", "Japan", "MSCI", "輸出", "円", "企業統治"],
  },
  {
    ticker: "VNM",
    name: "VanEck Vietnam ETF",
    regionGroup: "EMERGING_FRONTIER",
    strataThemeKey: "SEA_EQUITY",
    geographyLabel: "Southeast Asia",
    geographyCode: "SEA",
    underlyingStructure: "東南アジアの製造代替と内需拡張（若年人口×都市化×サプライチェーン移転）",
    currency: "USD",
    expenseRatioPercent: 0.61,
    purityScore: 0.66,
    liquidityScore: 0.70,
    relatedKeywords: ["東南アジア", "ASEAN", "ベトナム", "Vietnam", "製造", "内需", "都市化"],
  },
  {
    ticker: "EZA",
    name: "iShares MSCI South Africa ETF",
    regionGroup: "EMERGING_FRONTIER",
    strataThemeKey: "AFRICA_EQUITY",
    geographyLabel: "Africa",
    geographyCode: "AF",
    underlyingStructure: "南アフリカを中心とした資源・金融の循環（新興フロンティアの入口）",
    currency: "USD",
    expenseRatioPercent: 0.59,
    purityScore: 0.62,
    liquidityScore: 0.72,
    relatedKeywords: ["アフリカ", "Africa", "南ア", "資源", "金融", "新興"],
  },
  {
    ticker: "EWW",
    name: "iShares MSCI Mexico ETF",
    regionGroup: "EMERGING_FRONTIER",
    strataThemeKey: "MEXICO_EQUITY",
    geographyLabel: "Mexico",
    geographyCode: "MX",
    underlyingStructure: "メキシコ近接移転（ニアショア）×米国供給網の再編",
    currency: "USD",
    expenseRatioPercent: 0.50,
    purityScore: 0.75,
    liquidityScore: 0.82,
    relatedKeywords: ["メキシコ", "Mexico", "ニアショア", "製造", "サプライチェーン"],
  },
  {
    ticker: "FM",
    name: "iShares MSCI Frontier and Select EM ETF",
    regionGroup: "EMERGING_FRONTIER",
    strataThemeKey: "FRONTIER_EQUITY",
    geographyLabel: "Frontier",
    geographyCode: "FR",
    underlyingStructure: "フロンティア市場の“薄い成長”の束（資本の空白地帯）",
    currency: "USD",
    expenseRatioPercent: 0.79,
    purityScore: 0.58,
    liquidityScore: 0.60,
    relatedKeywords: ["フロンティア", "Frontier", "新興", "資本流入"],
  },
  {
    ticker: "SMH",
    name: "VanEck Semiconductor ETF",
    regionGroup: "THEMATIC_STRATA",
    strataThemeKey: "AI_SEMICONDUCTOR",
    geographyLabel: "Global",
    geographyCode: "GL",
    underlyingStructure: "半導体（計算資本）—AI/産業の“電気”そのもの",
    currency: "USD",
    expenseRatioPercent: 0.35,
    purityScore: 0.86,
    liquidityScore: 0.92,
    relatedKeywords: ["半導体", "Semiconductor", "AI", "データセンター", "装置", "材料"],
  },
  {
    ticker: "LIT",
    name: "Global X Lithium & Battery Tech ETF",
    regionGroup: "THEMATIC_STRATA",
    strataThemeKey: "EV_BATTERY",
    geographyLabel: "Global",
    geographyCode: "GL",
    underlyingStructure: "電池・リチウム（エネルギー密度）—EV/蓄電の心臓部",
    currency: "USD",
    expenseRatioPercent: 0.75,
    purityScore: 0.74,
    liquidityScore: 0.75,
    relatedKeywords: ["リチウム", "電池", "EV", "蓄電", "資源"],
  },
  {
    ticker: "2244.T",
    name: "グローバルX FANG+ ETF",
    regionGroup: "THEMATIC_STRATA",
    strataThemeKey: "US_TECH_PLATFORM",
    geographyLabel: "Japan Listed",
    geographyCode: "JP",
    underlyingStructure: "FANG+（プラットフォーム覇権）—広告/EC/クラウドの収穫機",
    currency: "JPY",
    expenseRatioPercent: 0.65,
    purityScore: 0.80,
    liquidityScore: 0.78,
    relatedKeywords: ["FANG", "プラットフォーム", "米国テック", "クラウド", "広告"],
  },
  {
    ticker: "ICLN",
    name: "iShares Global Clean Energy ETF",
    regionGroup: "THEMATIC_STRATA",
    strataThemeKey: "CLEAN_ENERGY_GLOBAL",
    geographyLabel: "Global",
    geographyCode: "GL",
    underlyingStructure: "クリーンエネルギー（再エネ・電化投資）の“世界の潮目”を観測するプローブ",
    currency: "USD",
    expenseRatioPercent: 0.41,
    purityScore: 0.78,
    liquidityScore: 0.88,
    relatedKeywords: ["再エネ", "クリーンエネルギー", "電力", "太陽光", "風力", "送配電", "蓄電", "電化"],
  },
  {
    ticker: "ASEA",
    name: "Global X FTSE Southeast Asia ETF",
    regionGroup: "EMERGING_FRONTIER",
    strataThemeKey: "SEA_RENEWABLES_PROBE",
    geographyLabel: "Southeast Asia",
    geographyCode: "SEA",
    underlyingStructure:
      "東南アジア（SEA）の電化・電力インフラ投資の地殻変動を、地域株の資金循環として観測するプローブ（再エネ転換の温度計）",
    currency: "USD",
    expenseRatioPercent: 0.65,
    purityScore: 0.62,
    liquidityScore: 0.62,
    relatedKeywords: ["東南アジア", "SEA", "ASEAN", "電力", "送配電", "再エネ", "インフラ", "電化", "電池"],
  },
];

/**
 * Commodities Strata (materials & energy) — interpreted as "flow into real assets"
 * relative to equity benchmark (VOO).
 */
export const COMMODITIES_STRATA_ETFS: EtfDescriptor[] = [
  {
    ticker: "GLD",
    name: "SPDR Gold Shares",
    regionGroup: "THEMATIC_STRATA",
    strataThemeKey: "COMMODITY_GOLD",
    geographyLabel: "Global",
    geographyCode: "GL",
    underlyingStructure: "金（安全資産/実質金利）—リスク回避とインフレヘッジの受け皿",
    currency: "USD",
    expenseRatioPercent: 0.40,
    purityScore: 0.80,
    liquidityScore: 0.92,
    relatedKeywords: ["金", "Gold", "安全資産", "実質金利", "インフレ"],
  },
  {
    ticker: "USO",
    name: "United States Oil Fund",
    regionGroup: "THEMATIC_STRATA",
    strataThemeKey: "COMMODITY_OIL",
    geographyLabel: "Global",
    geographyCode: "GL",
    underlyingStructure: "原油（エネルギーの血流）—需給ショック/地政学/インフレ期待の温度計",
    currency: "USD",
    expenseRatioPercent: 0.60,
    purityScore: 0.72,
    liquidityScore: 0.88,
    relatedKeywords: ["原油", "Oil", "エネルギー", "インフレ", "地政学"],
  },
  {
    ticker: "CPER",
    name: "United States Copper Index Fund",
    regionGroup: "THEMATIC_STRATA",
    strataThemeKey: "COMMODITY_COPPER",
    geographyLabel: "Global",
    geographyCode: "GL",
    underlyingStructure: "銅（景気の血圧）—製造/建設/電化投資の前兆",
    currency: "USD",
    expenseRatioPercent: 0.65,
    purityScore: 0.70,
    liquidityScore: 0.72,
    relatedKeywords: ["銅", "Copper", "景気", "製造", "電化"],
  },
  {
    ticker: "DBA",
    name: "Invesco DB Agriculture Fund",
    regionGroup: "THEMATIC_STRATA",
    strataThemeKey: "COMMODITY_AGRI",
    geographyLabel: "Global",
    geographyCode: "GL",
    underlyingStructure: "農産物（生活コスト）—天候/供給制約/インフレの持続性",
    currency: "USD",
    expenseRatioPercent: 0.85,
    purityScore: 0.68,
    liquidityScore: 0.70,
    relatedKeywords: ["農産物", "Agriculture", "食料", "インフレ", "天候"],
  },
  {
    ticker: "DBB",
    name: "Invesco DB Base Metals Fund",
    regionGroup: "THEMATIC_STRATA",
    strataThemeKey: "COMMODITY_BASE_METALS",
    geographyLabel: "Global",
    geographyCode: "GL",
    underlyingStructure: "ベースメタル（産業の骨格）—景気循環/在庫サイクル/供給制約",
    currency: "USD",
    expenseRatioPercent: 0.79,
    purityScore: 0.70,
    liquidityScore: 0.70,
    relatedKeywords: ["金属", "ベースメタル", "在庫", "景気", "供給制約"],
  },
];

type HoldingRow = { ticker: string; name: string; structure_tags: string | null };

async function fetchHoldingsForSpillover(db: Client, userId: string): Promise<HoldingRow[]> {
  try {
    const rs = await db.execute({
      sql: `SELECT ticker, name, structure_tags
            FROM holdings
            WHERE user_id = ? AND quantity > 0
            ORDER BY ticker`,
      args: [userId],
    });
    return (rs.rows as unknown as Record<string, unknown>[]).map((r) => ({
      ticker: String(r.ticker),
      name: r.name != null ? String(r.name) : "",
      structure_tags: r.structure_tags != null ? String(r.structure_tags) : null,
    }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("no such table") || msg.toLowerCase().includes("holdings")) return [];
    throw e;
  }
}

function matchSpilloverHoldings(holdings: HoldingRow[], keywords: string[], limit = 6): { ticker: string; name: string; reason: string }[] {
  const ks = keywords.map((k) => k.trim()).filter((k) => k.length > 0);
  if (ks.length === 0 || holdings.length === 0) return [];
  const out: { ticker: string; name: string; reason: string }[] = [];
  for (const h of holdings) {
    const tagsJson = h.structure_tags ?? "[]";
    const theme = themeFromStructureTags(tagsJson);
    const hay = [h.ticker, h.name, theme, tagsJson].join(" ").toLowerCase();
    const hit = ks.find((k) => hay.includes(k.toLowerCase())) ?? null;
    if (hit) {
      out.push({ ticker: h.ticker, name: h.name, reason: hit });
      if (out.length >= limit) break;
    }
  }
  return out;
}

function phaseShiftFromDailyAlphas(daily: number[]): { z: number | null; phaseShift: boolean; direction: "UP" | "DOWN" | null } {
  const series = daily.filter((x) => Number.isFinite(x));
  const z = computeAlphaDeviationZScore(series, 30);
  if (z == null) return { z: null, phaseShift: false, direction: null };
  const abs = Math.abs(z);
  if (abs < 2.25) return { z, phaseShift: false, direction: null };
  const direction: "UP" | "DOWN" = z > 0 ? "UP" : "DOWN";
  return { z, phaseShift: true, direction };
}

export type EtfEvaluatedRow = {
  ticker: string;
  name: string;
  regionGroup: EtfDescriptor["regionGroup"];
  strataThemeKey: string | null;
  geographyLabel: string;
  geographyCode: string | null;
  underlyingStructure: string;
  currency: "USD" | "JPY";

  // Alpha fields
  latestDailyAlpha: number | null;
  dailyAlphaZ: number | null;
  cumulativeAlpha90d: number | null;

  // ETF gravity
  trackingAlphaScore: number;
  expenseDrag5y: number;

  // Nonlinear
  phaseShift: boolean;
  phaseShiftDirection: "UP" | "DOWN" | null;

  // Spillover
  spilloverHoldings: { ticker: string; name: string; reason: string }[];

  // Rotation Radar (capital flow)
  rotationRadar: RotationRadarPoint[];
};

export type EtfCollectionSnapshot = {
  asOf: string;
  fxUsdJpy: number | null;
  etfs: EtfEvaluatedRow[];
  commoditiesEtfs: EtfEvaluatedRow[];
  regionalMomentum: RegionMomentumOutput[];
};

export async function getEtfCollectionSnapshot(db: Client, userId: string): Promise<EtfCollectionSnapshot> {
  const fxSnap = await (async () => {
    try {
      return await fetchUsdJpyRate();
    } catch {
      return null;
    }
  })();
  const fxUsdJpy =
    fxSnap?.rate != null && Number.isFinite(fxSnap.rate) && fxSnap.rate > 0 ? fxSnap.rate : null;

  const holdings = await fetchHoldingsForSpillover(db, userId);

  async function evaluateEtfs(descriptors: EtfDescriptor[]): Promise<EtfEvaluatedRow[]> {
    const MAX = descriptors.length;
    if (MAX === 0) return [];
    const CONCURRENCY = Math.min(10, Math.max(2, MAX));
    const results: (EtfEvaluatedRow | null)[] = new Array(MAX).fill(null);
    let nextIdx = 0;

    async function worker() {
      while (true) {
        const i = nextIdx;
        nextIdx += 1;
        if (i >= MAX) return;
        const d = descriptors[i]!;
        const themeKey =
          d.strataThemeKey != null && String(d.strataThemeKey).trim().length > 0
            ? String(d.strataThemeKey).trim()
            : null;
        try {
          const { rows } = await fetchRecentDatedDailyAlphasVsVoo(d.ticker, 120, null);
          const daily = rows.map((r) => Number(r.alphaValue)).filter((x) => Number.isFinite(x));
          const latestDailyAlpha = daily.length > 0 ? roundAlphaMetric(daily[daily.length - 1]!) : null;
          const { z, phaseShift, direction } = phaseShiftFromDailyAlphas(daily);

          const start = ymdDaysAgoUtc(90);
          const filtered: DatedAlphaRow[] = rows.filter((r) => toYmd(r.recordedAt) >= start);
          const cum = filtered.length >= 2 ? calculateCumulativeAlpha(filtered, start) : [];
          const cumulativeAlpha90d = cum.length > 0 ? cum[cum.length - 1]!.cumulative : null;

          const expenseDrag5y = computeExpenseRatioDragPercent(d.expenseRatioPercent, 5);
          const trackingAlphaScore = computeEtfTrackingAlphaPercent({
            purityScore: d.purityScore,
            liquidityScore: d.liquidityScore,
            expenseRatioPercent: d.expenseRatioPercent,
            feeHorizonYears: 5,
          });

          const spilloverHoldings = phaseShift ? matchSpilloverHoldings(holdings, d.relatedKeywords, 6) : [];

          const rotationRadar = computeRotationRadarVector(rows, { lookbackDays: 20, momentumLagDays: 5 });

          results[i] = {
            ticker: d.ticker,
            name: d.name,
            regionGroup: d.regionGroup,
            strataThemeKey: themeKey,
            geographyLabel: d.geographyLabel,
            geographyCode: d.geographyCode ?? null,
            underlyingStructure: d.underlyingStructure,
            currency: d.currency,
            latestDailyAlpha,
            dailyAlphaZ: z,
            cumulativeAlpha90d,
            trackingAlphaScore,
            expenseDrag5y,
            phaseShift,
            phaseShiftDirection: direction,
            spilloverHoldings,
            rotationRadar,
          };
        } catch {
          results[i] = {
            ticker: d.ticker,
            name: d.name,
            regionGroup: d.regionGroup,
            strataThemeKey: themeKey,
            geographyLabel: d.geographyLabel,
            geographyCode: d.geographyCode ?? null,
            underlyingStructure: d.underlyingStructure,
            currency: d.currency,
            latestDailyAlpha: null,
            dailyAlphaZ: null,
            cumulativeAlpha90d: null,
            trackingAlphaScore: computeEtfTrackingAlphaPercent({
              purityScore: d.purityScore,
              liquidityScore: d.liquidityScore,
              expenseRatioPercent: d.expenseRatioPercent,
              feeHorizonYears: 5,
            }),
            expenseDrag5y: computeExpenseRatioDragPercent(d.expenseRatioPercent, 5),
            phaseShift: false,
            phaseShiftDirection: null,
            spilloverHoldings: [],
            rotationRadar: [],
          };
        }
      }
    }

    await Promise.allSettled(Array.from({ length: Math.min(CONCURRENCY, MAX) }, () => worker()));
    return results.filter((x): x is EtfEvaluatedRow => x != null);
  }

  const [etfs, commoditiesEtfs] = await Promise.all([
    evaluateEtfs(GLOBAL_STRATA_ETFS),
    evaluateEtfs(COMMODITIES_STRATA_ETFS),
  ]);

  // Regional momentum computed from cumulative 90d alpha by region group.
  const byRegion = new Map<string, number[]>();
  for (const e of etfs) {
    const v = e.cumulativeAlpha90d;
    if (v == null) continue;
    if (!byRegion.has(e.regionGroup)) byRegion.set(e.regionGroup, []);
    byRegion.get(e.regionGroup)!.push(v);
  }
  const regionInputs = [...byRegion.entries()].map(([region, vals]) => ({
    region,
    cumulativeAlpha: vals.length > 0 ? roundAlphaMetric(vals.reduce((a, b) => a + b, 0) / vals.length) : 0,
  }));
  const regionalMomentum = computeRegionalMomentum(regionInputs, 7);

  return {
    asOf: new Date().toISOString(),
    fxUsdJpy: fxUsdJpy ?? (USD_JPY_RATE_FALLBACK > 0 ? USD_JPY_RATE_FALLBACK : null),
    etfs,
    commoditiesEtfs,
    regionalMomentum,
  };
}

