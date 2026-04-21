import type {
  ClosedTradeDashboardRow,
  HoldingDailySnapshotRow,
  PortfolioDailySnapshotRow,
  Stock,
  ThemeEcosystemWatchItem,
} from "@/src/types/investment";
import { EXPECTATION_CATEGORY_LABEL_JA } from "@/src/types/investment";

import { ADOPTION_STAGE_META } from "@/src/lib/adoption-stage";
import type { CsvColumnDef } from "@/src/lib/csv-export";

function geopoliticalPotentialFromNotes(observationNotes: string | null | undefined): string {
  if (observationNotes == null) return "";
  const s = observationNotes.trim();
  if (s.length === 0) return "";
  const m = s.match(/地政学(?:ポテンシャル|リスク|要因)[:：]\s*([^\n]+)\s*$/);
  if (m?.[1]) return m[1].trim();
  return "";
}

function latestAlphaPct(s: Stock): number | null {
  if (s.alphaHistory.length === 0) return null;
  const v = s.alphaHistory[s.alphaHistory.length - 1]!;
  return Number.isFinite(v) ? v : null;
}

export function stocksToCsvRows(stocks: Stock[]): Record<string, unknown>[] {
  return stocks.map((s) => ({
    ticker: s.ticker,
    name: s.name ?? "",
    theme: s.tag ?? "",
    sector: s.sector ?? s.secondaryTag ?? "",
    expectationCategory:
      s.expectationCategory != null ? EXPECTATION_CATEGORY_LABEL_JA[s.expectationCategory] : "",
    category: s.category,
    accountType: s.accountType ?? "",
    countryName: s.countryName ?? "",
    quantity: s.quantity,
    currentPrice: s.currentPrice,
    marketValueJpy: s.marketValue,
    weightPct: s.weight,
    unrealizedPnlJpy: s.unrealizedPnlJpy,
    unrealizedPnlPct: s.unrealizedPnlPercent,
    dayChangePct: s.dayChangePercent,
    latestAlphaPct: latestAlphaPct(s),
    alphaDeviationZ: s.alphaDeviationZ,
    drawdownFromHigh90dPct: s.drawdownFromHigh90dPct,
    judgmentStatus: s.judgmentStatus,
    judgmentReason: s.judgmentReason,
    nextEarningsDate: s.nextEarningsDate ?? "",
    daysToEarnings: s.daysToEarnings,
    dividendYieldPct: s.dividendYieldPercent,
    valuationFactor: s.valuationFactor,
    instrumentKind: s.instrumentKind,
    priceSource: s.priceSource,
    avgAcquisitionPrice: s.avgAcquisitionPrice,
  }));
}

export const STOCK_CSV_COLUMNS: CsvColumnDef[] = [
  { key: "ticker", header: "銘柄コード" },
  { key: "name", header: "銘柄名" },
  { key: "theme", header: "構造テーマ" },
  { key: "sector", header: "セクター" },
  { key: "expectationCategory", header: "期待カテゴリー" },
  { key: "category", header: "Core/Satellite" },
  { key: "accountType", header: "口座" },
  { key: "countryName", header: "市場" },
  { key: "quantity", header: "数量" },
  { key: "currentPrice", header: "現在値（建て通貨）" },
  { key: "marketValueJpy", header: "評価額（円）" },
  { key: "weightPct", header: "ウェイト（%）" },
  { key: "unrealizedPnlJpy", header: "含み損益（円）" },
  { key: "unrealizedPnlPct", header: "含み損益率（%）" },
  { key: "dayChangePct", header: "前日比（%）" },
  { key: "latestAlphaPct", header: "最新累積Alpha（%）" },
  { key: "alphaDeviationZ", header: "日次Alpha乖離（σ）" },
  { key: "drawdownFromHigh90dPct", header: "90日高値比（%）" },
  { key: "judgmentStatus", header: "投資判定" },
  { key: "judgmentReason", header: "判定理由" },
  { key: "nextEarningsDate", header: "次回決算日" },
  { key: "daysToEarnings", header: "決算まで日数" },
  { key: "dividendYieldPct", header: "配当利回り（%）" },
  { key: "valuationFactor", header: "換算係数" },
  { key: "instrumentKind", header: "銘柄種別" },
  { key: "priceSource", header: "価格ソース" },
  { key: "avgAcquisitionPrice", header: "平均取得単価" },
];

export function portfolioSnapshotsToCsvRows(rows: PortfolioDailySnapshotRow[]): Record<string, unknown>[] {
  return rows.map((r) => ({
    snapshotDate: r.snapshotDate,
    recordedAt: r.recordedAt,
    fxUsdJpy: r.fxUsdJpy,
    benchmarkTicker: r.benchmarkTicker,
    benchmarkClose: r.benchmarkClose,
    benchmarkChangePct: r.benchmarkChangePct,
    totalMarketValueJpy: r.totalMarketValueJpy,
    totalUnrealizedPnlJpy: r.totalUnrealizedPnlJpy,
    totalProfitJpy: r.totalProfitJpy,
    costBasisJpy: r.costBasisJpy,
    holdingsCount: r.holdingsCount,
    holdingsAddedCount: r.holdingsAddedCount,
    holdingsRemovedCount: r.holdingsRemovedCount,
    holdingsContinuingCount: r.holdingsContinuingCount,
    nonEtfListedEquityQuantityTotal: r.nonEtfListedEquityQuantityTotal,
    portfolioAvgAlpha: r.portfolioAvgAlpha,
    portfolioReturnVsPrevPct: r.portfolioReturnVsPrevPct,
    benchmarkReturnVsPrevPct: r.benchmarkReturnVsPrevPct,
    alphaVsPrevPct: r.alphaVsPrevPct,
  }));
}

export const PORTFOLIO_SNAPSHOT_CSV_COLUMNS: CsvColumnDef[] = [
  { key: "snapshotDate", header: "スナップショット日付" },
  { key: "recordedAt", header: "記録時刻" },
  { key: "fxUsdJpy", header: "USD/JPY" },
  { key: "benchmarkTicker", header: "ベンチマーク" },
  { key: "benchmarkClose", header: "ベンチマーク終値" },
  { key: "benchmarkChangePct", header: "ベンチマーク当日%" },
  { key: "totalMarketValueJpy", header: "評価額合計（円）" },
  { key: "totalUnrealizedPnlJpy", header: "含み損益合計（円）" },
  { key: "totalProfitJpy", header: "合計損益（円）" },
  { key: "costBasisJpy", header: "コスト計（円）" },
  { key: "holdingsCount", header: "保有銘柄数" },
  { key: "holdingsAddedCount", header: "銘柄追加数（前スナップ比）" },
  { key: "holdingsRemovedCount", header: "銘柄削除数（前スナップ比）" },
  { key: "holdingsContinuingCount", header: "継続銘柄数（前スナップ比）" },
  {
    key: "nonEtfListedEquityQuantityTotal",
    header: "個別株数量計（ETF除く・米日上場）",
  },
  { key: "portfolioAvgAlpha", header: "平均Alpha" },
  { key: "portfolioReturnVsPrevPct", header: "PF前日比（%）" },
  { key: "benchmarkReturnVsPrevPct", header: "BM前日比（%）" },
  { key: "alphaVsPrevPct", header: "α乖離（%）" },
];

export function holdingSnapshotsToCsvRows(rows: HoldingDailySnapshotRow[]): Record<string, unknown>[] {
  return rows.map((r) => ({
    snapshotDate: r.snapshotDate,
    ticker: r.ticker,
    name: r.name,
    instrumentKind: r.instrumentKind,
    category: r.category,
    secondaryTag: r.secondaryTag,
    quantity: r.quantity,
    valuationFactor: r.valuationFactor,
    avgAcquisitionPrice: r.avgAcquisitionPrice,
    closePrice: r.closePrice,
    marketValueJpy: r.marketValueJpy,
    unrealizedPnlJpy: r.unrealizedPnlJpy,
    unrealizedPnlPct: r.unrealizedPnlPct,
    dayChangePct: r.dayChangePct,
    benchmarkTicker: r.benchmarkTicker,
    benchmarkClose: r.benchmarkClose,
    fxUsdJpy: r.fxUsdJpy,
  }));
}

export const HOLDING_SNAPSHOT_CSV_COLUMNS: CsvColumnDef[] = [
  { key: "snapshotDate", header: "スナップショット日付" },
  { key: "ticker", header: "銘柄コード" },
  { key: "name", header: "銘柄名" },
  { key: "instrumentKind", header: "種別" },
  { key: "category", header: "Core/Satellite" },
  { key: "secondaryTag", header: "セクター/タグ" },
  { key: "quantity", header: "数量" },
  { key: "valuationFactor", header: "換算係数" },
  { key: "avgAcquisitionPrice", header: "平均取得単価" },
  { key: "closePrice", header: "終値（記録時）" },
  { key: "marketValueJpy", header: "評価額（円）" },
  { key: "unrealizedPnlJpy", header: "含み損益（円）" },
  { key: "unrealizedPnlPct", header: "含み損益率（%）" },
  { key: "dayChangePct", header: "前日比（%）" },
  { key: "benchmarkTicker", header: "ベンチマーク" },
  { key: "benchmarkClose", header: "BM終値" },
  { key: "fxUsdJpy", header: "USD/JPY" },
];

export function closedTradesToCsvRows(rows: ClosedTradeDashboardRow[]): Record<string, unknown>[] {
  return rows.map((r) => ({
    tradeDate: r.tradeDate,
    ticker: r.ticker,
    name: r.name,
    market: r.market,
    accountName: r.accountName,
    side: r.side,
    quantity: r.quantity,
    costJpy: r.costJpy,
    proceedsJpy: r.proceedsJpy,
    feesJpy: r.feesJpy,
    realizedPnlJpy: r.realizedPnlJpy,
    currentPriceJpy: r.currentPriceJpy,
    postExitReturnPct: r.postExitReturnPct,
    verdictLabel: r.verdictLabel,
    reason: r.reason ?? "",
  }));
}

export const CLOSED_TRADE_CSV_COLUMNS: CsvColumnDef[] = [
  { key: "tradeDate", header: "約定日" },
  { key: "ticker", header: "銘柄コード" },
  { key: "name", header: "銘柄名" },
  { key: "market", header: "市場" },
  { key: "accountName", header: "口座" },
  { key: "side", header: "売買" },
  { key: "quantity", header: "数量" },
  { key: "costJpy", header: "取得代金（円）" },
  { key: "proceedsJpy", header: "譲渡代金（円）" },
  { key: "feesJpy", header: "諸経費（円）" },
  { key: "realizedPnlJpy", header: "確定損益（円）" },
  { key: "currentPriceJpy", header: "現在価格（円/単位）" },
  { key: "postExitReturnPct", header: "売却後騰落率（%）" },
  { key: "verdictLabel", header: "売却判定" },
  { key: "reason", header: "取引理由・反省" },
];

export function themeEcosystemWatchlistToCsvRows(
  items: ThemeEcosystemWatchItem[],
  themeName: string,
): Record<string, unknown>[] {
  return items.map((e) => ({
    themeName,
    field: e.field?.trim() ? e.field.trim() : "その他",
    ticker: e.ticker,
    companyName: e.companyName ?? "",
    isUnlisted: e.isUnlisted ? "はい" : "いいえ",
    proxyTicker: e.proxyTicker ?? "",
    estimatedIpoDate: e.estimatedIpoDate ?? "",
    estimatedValuation: e.estimatedValuation ?? "",
    observationNotes: e.observationNotes ?? "",
    geopoliticalPotential: geopoliticalPotentialFromNotes(e.observationNotes),
    role: e.role ?? "",
    isMajorPlayer: e.isMajorPlayer ? "はい" : "いいえ",
    inPortfolio: e.inPortfolio ? "はい" : "いいえ",
    countryName: e.countryName ?? "",
    instrumentKind: e.instrumentKind ?? "",
    nextEarningsDate: e.nextEarningsDate ?? "",
    daysToEarnings: e.daysToEarnings,
    dividendYieldPercent: e.dividendYieldPercent,
    annualDividendRate: e.annualDividendRate,
    observationStartedAt: e.observationStartedAt ?? "",
    alphaObservationStartDate: e.alphaObservationStartDate ?? "",
    adoptionStage:
      e.adoptionStage != null ? ADOPTION_STAGE_META[e.adoptionStage].labelJa : "",
    adoptionStageRationale: e.adoptionStageRationale ?? "",
    expectationCategory:
      e.expectationCategory != null ? EXPECTATION_CATEGORY_LABEL_JA[e.expectationCategory] : "",
    ruleOf40: e.ruleOf40,
    fcfYield: e.fcfYield,
    judgmentStatus: e.judgmentStatus,
    judgmentReason: e.judgmentReason,
    alphaDeviationZ: e.alphaDeviationZ,
    drawdownFromHigh90dPct: e.drawdownFromHigh90dPct,
    latestCumulativeAlphaPct: e.latestAlpha,
    alphaHistorySeries: e.alphaHistory.length > 0 ? JSON.stringify(e.alphaHistory) : "",
    alphaDailyHistorySeries: e.alphaDailyHistory.length > 0 ? JSON.stringify(e.alphaDailyHistory) : "",
    currentPrice: e.currentPrice,
  }));
}

export const THEME_ECOSYSTEM_WATCHLIST_CSV_COLUMNS: CsvColumnDef[] = [
  { key: "themeName", header: "構造テーマ" },
  { key: "field", header: "サブカテゴリ" },
  { key: "ticker", header: "銘柄コード" },
  { key: "companyName", header: "企業名" },
  { key: "isUnlisted", header: "未上場" },
  { key: "proxyTicker", header: "代理ティッカー" },
  { key: "estimatedIpoDate", header: "IPO予定" },
  { key: "estimatedValuation", header: "想定バリュエーション" },
  { key: "observationNotes", header: "観測メモ" },
  { key: "geopoliticalPotential", header: "地政学ポテンシャル（抽出）" },
  { key: "role", header: "江戸的役割" },
  { key: "isMajorPlayer", header: "Major" },
  { key: "inPortfolio", header: "保有中" },
  { key: "countryName", header: "国・市場" },
  { key: "instrumentKind", header: "銘柄種別（API）" },
  { key: "nextEarningsDate", header: "次回決算日" },
  { key: "daysToEarnings", header: "決算まで日数" },
  { key: "dividendYieldPercent", header: "配当利回り（%）" },
  { key: "annualDividendRate", header: "年間配当" },
  { key: "observationStartedAt", header: "観測開始日" },
  { key: "alphaObservationStartDate", header: "累積Alpha系列起点" },
  { key: "adoptionStage", header: "普及ステージ（キャズム）" },
  { key: "adoptionStageRationale", header: "普及ステージ根拠" },
  { key: "expectationCategory", header: "期待カテゴリー" },
  { key: "ruleOf40", header: "Rule of 40（%）" },
  { key: "fcfYield", header: "FCF Yield（%）" },
  { key: "judgmentStatus", header: "投資判定" },
  { key: "judgmentReason", header: "判定理由" },
  { key: "alphaDeviationZ", header: "日次Alpha乖離（σ）" },
  { key: "drawdownFromHigh90dPct", header: "90日高値比（%）" },
  { key: "latestCumulativeAlphaPct", header: "累積Alpha（%）" },
  { key: "alphaHistorySeries", header: "累積Alpha系列（JSON）" },
  { key: "alphaDailyHistorySeries", header: "日次Alpha系列（JSON）" },
  { key: "currentPrice", header: "現在値（建て通貨）" },
];
