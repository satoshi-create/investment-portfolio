/**
 * 保有銘柄および構造投資エコシステム観測銘柄の Efficiency 指標を Yahoo Finance で取得し
 * `ticker_efficiency_metrics` に UPSERT。
 *
 * ティッカー集合:
 *   - `holdings`（quantity > 0）の米国・日本上場（投信コード含む）
 *   - `theme_ecosystem_members` の上場観測銘柄（is_unlisted = 0）。
 *     `N/A:`・名称のみ・8 桁投信コード等は `@/src/lib/ecosystem-ticker-hygiene` で除外。
 *   上記をマージし重複排除。取得キューは未登録または `last_updated_at` が 7 日超（上限 `YAHOO_MAX_TICKERS`）。
 *
 * - **米国株**: fundamentalsTimeSeries（年次）に加え、**常に** quoteSummary 拡張（PL/CF 等）で欠損を補完し、
 *   Rule of 40・`fcf_yield`（時価総額ベースの近似）を埋める。
 * - **日本株**: 同上を試行し、不足時は quoteSummary でフォールバック。
 * - **`net_cash`**: `financialData`（totalCash − totalDebt）を優先し、不足時は `balanceSheetHistory` 最新年次で近似。
 *   ソース列: `Yahoo_TS` / `Yahoo_JP` / `Yahoo_US_QS`。
 *
 * Env:
 *   TURSO_DATABASE_URL, TURSO_AUTH_TOKEN
 *   NEXT_PUBLIC_DEFAULT_PROFILE_USER_ID
 *   YAHOO_FUNDAMENTALS_DELAY_MS — 銘柄あたりのベース待機（既定 1000ms、800〜1200 にクランプ）
 *   YAHOO_MAX_TICKERS — 既定 200（環境変数で上書き可）
 *
 * Usage:
 *   npx tsx scripts/fetch-fundamental-metrics.ts [userId]
 */

import path from "node:path";

import dotenv from "dotenv";
import YahooFinance from "yahoo-finance2";
import type { QuoteSummaryModules } from "yahoo-finance2/modules/quoteSummary";

import { classifyTickerInstrument } from "@/src/lib/alpha-logic";
import { defaultProfileUserId } from "@/src/lib/authorize-signals";
import {
  ecosystemTickerExcludedFromYahooFundamentals,
  normalizeTickerForYahooSymbol,
} from "@/src/lib/ecosystem-ticker-hygiene";
import { getDb, isDbConfigured } from "@/src/lib/db";
import { toYahooFinanceSymbol } from "@/src/lib/price-service";
import type { TickerInstrumentKind } from "@/src/types/investment";

const SOURCE_YAHOO_TS = "Yahoo_TS";
const SOURCE_YAHOO_JP = "Yahoo_JP";
/** 米国株: quoteSummary（income/cashflow/financialData）由来の補完 */
const SOURCE_YAHOO_US_QS = "Yahoo_US_QS";

const QUOTE_SUMMARY_EXTENDED_MODULES = [
  "defaultKeyStatistics",
  "incomeStatementHistory",
  "cashflowStatementHistory",
  "balanceSheetHistory",
  "financialData",
  "summaryDetail",
  "price",
] as const;

/** quoteSummary 最小取得でも net_cash 用に付与する追加モジュール */
const NET_CASH_QUOTE_EXTRA_MODULES = ["financialData", "balanceSheetHistory"] as const;

/** `last_updated_at` がこれより古い行は再取得対象 */
const STALE_MS = 7 * 24 * 60 * 60 * 1000;

const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
});

/** Yahoo TS の過去十分な深さ（年次） */
const TS_PERIOD1 = "2005-01-01";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** `date` は Unix 秒またはミリ秒の数値が返ることが多い */
function dateKeyMs(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw < 1e12 ? raw * 1000 : raw;
  }
  if (typeof raw === "string") {
    const t = new Date(raw).getTime();
    return Number.isFinite(t) ? t : null;
  }
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw.getTime();
  return null;
}

function pickNum(row: Record<string, unknown>, keys: string[]): number {
  for (const k of keys) {
    if (!Object.prototype.hasOwnProperty.call(row, k)) continue;
    const v = row[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return Number.NaN;
}

type MergedAnnual = {
  dateMs: number;
  totalRevenue: number | null;
  freeCashFlow: number | null;
  netIncome: number | null;
  ebitda: number | null;
  operatingIncome: number | null;
  depreciation: number | null;
};

/**
 * financials / cash-flow の各行を timestamp でマージ（同一決算期の売上と FCF を揃える）。
 */
function mergeAnnualRows(
  financials: unknown,
  cashFlow: unknown,
): MergedAnnual[] {
  const map = new Map<number, MergedAnnual>();

  const ingest = (
    rows: unknown,
    field: "totalRevenue" | "freeCashFlow" | "netIncome" | "ebitda" | "operatingIncome" | "depreciation",
    keyCandidates: string[],
  ) => {
    if (!Array.isArray(rows)) return;
    for (const raw of rows) {
      if (!raw || typeof raw !== "object") continue;
      const r = raw as Record<string, unknown>;
      const dk = dateKeyMs(r["date"]);
      if (dk == null) continue;
      const v = pickNum(r, keyCandidates);
      const cur = map.get(dk) ?? {
        dateMs: dk,
        totalRevenue: null,
        freeCashFlow: null,
        netIncome: null,
        ebitda: null,
        operatingIncome: null,
        depreciation: null,
      };
      if (Number.isFinite(v)) {
        if (field === "totalRevenue") cur.totalRevenue = v;
        if (field === "freeCashFlow") cur.freeCashFlow = v;
        if (field === "netIncome") cur.netIncome = v;
        if (field === "ebitda") cur.ebitda = v;
        if (field === "operatingIncome") cur.operatingIncome = v;
        if (field === "depreciation") cur.depreciation = v;
      }
      map.set(dk, cur);
    }
  };

  ingest(financials, "totalRevenue", ["totalRevenue", "TotalRevenue"]);
  ingest(financials, "netIncome", ["netIncome", "NetIncome"]);
  ingest(financials, "operatingIncome", ["operatingIncome", "OperatingIncome"]);
  ingest(financials, "ebitda", ["ebitda", "EBITDA", "trailingEbitda", "TrailingEbitda"]);
  ingest(cashFlow, "freeCashFlow", ["freeCashFlow", "FreeCashFlow"]);
  ingest(cashFlow, "depreciation", [
    "depreciation",
    "depreciationAndAmortization",
    "DepreciationAndAmortization",
    "depreciationAmortization",
  ]);

  return [...map.values()].sort((a, b) => b.dateMs - a.dateMs);
}

function finitePosRev(r: MergedAnnual): number | null {
  const v = r.totalRevenue;
  if (v == null || !Number.isFinite(v) || v <= 0) return null;
  return v;
}

function computeMetricsFromMerged(sortedDesc: MergedAnnual[]): {
  revenueGrowthPct: number;
  fcfMarginPct: number;
  ruleOf40: number;
  annualFcf: number | null;
  ebitda: number | null;
} {
  const revChain = sortedDesc.filter((r) => finitePosRev(r) != null);
  let revenueGrowthPct = Number.NaN;
  if (revChain.length >= 2) {
    const r0 = finitePosRev(revChain[0]!);
    const r1 = finitePosRev(revChain[1]!);
    if (r0 != null && r1 != null && r1 !== 0) {
      revenueGrowthPct = ((r0 - r1) / r1) * 100;
    }
  }

  let fcfMarginPct = Number.NaN;
  let annualFcf: number | null = null;
  let ebitda: number | null = null;

  const both = sortedDesc.find((r) => {
    const rev = finitePosRev(r);
    const fcf = r.freeCashFlow;
    return rev != null && fcf != null && Number.isFinite(fcf);
  });

  if (both != null) {
    const rev = finitePosRev(both)!;
    const fcf = both.freeCashFlow!;
    annualFcf = fcf;
    fcfMarginPct = (fcf / rev) * 100;
  } else if (sortedDesc.length > 0) {
    /** FCF のみ後段で埋まるケース — 単体で annual_fcf のみ保存 */
    const fcfOnly = sortedDesc.map((r) => r.freeCashFlow).find((x) => x != null && Number.isFinite(x));
    if (fcfOnly != null && Number.isFinite(fcfOnly)) annualFcf = fcfOnly;
  }

  /** EBITDA の抽出（最新年次） */
  if (sortedDesc.length > 0) {
    const top = sortedDesc[0]!;
    const eb = top.ebitda;
    if (eb != null && Number.isFinite(eb)) {
      ebitda = eb;
    } else {
      /** 営業利益 + 減価償却費による近似 */
      const opInc = top.operatingIncome;
      const dep = top.depreciation;
      if (opInc != null && dep != null && Number.isFinite(opInc) && Number.isFinite(dep)) {
        ebitda = opInc + Math.abs(dep);
      }
    }
  }

  const ruleOf40 =
    Number.isFinite(revenueGrowthPct) && Number.isFinite(fcfMarginPct)
      ? revenueGrowthPct + fcfMarginPct
      : Number.NaN;

  return { revenueGrowthPct, fcfMarginPct, ruleOf40, annualFcf, ebitda };
}

async function fetchLastUpdatedMap(
  db: ReturnType<typeof getDb>,
): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  try {
    const rs = await db.execute({
      sql: `SELECT ticker, last_updated_at FROM ticker_efficiency_metrics`,
      args: [],
    });
    for (const r of rs.rows as { ticker?: unknown; last_updated_at?: unknown }[]) {
      const t = String(r.ticker ?? "").trim().toUpperCase();
      if (!t) continue;
      const lu = r.last_updated_at != null ? String(r.last_updated_at).trim() : null;
      out.set(t, lu && lu.length > 0 ? lu : null);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[warn] ticker_efficiency_metrics メタ読込に失敗（全件対象扱い）: ${msg}`);
  }
  return out;
}

function needsRefresh(lastUpdatedAt: string | null | undefined): boolean {
  if (lastUpdatedAt == null || String(lastUpdatedAt).trim().length === 0) return true;
  const t = Date.parse(String(lastUpdatedAt));
  if (!Number.isFinite(t)) return true;
  return Date.now() - t >= STALE_MS;
}

function needsFetch(
  tickerUpper: string,
  lastUpdatedByTicker: Map<string, string | null>,
): boolean {
  if (!lastUpdatedByTicker.has(tickerUpper)) return true;
  return needsRefresh(lastUpdatedByTicker.get(tickerUpper) ?? null);
}

/** Yahoo `quoteSummary` 数値: 素の number / 文字列 / `{ raw, fmt }` / `fmt` の K/M/B 略号に追随。 */
function yahooCoerceNumberLeaf(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const t = v.trim().replace(/,/g, "");
    if (t.length === 0) return null;
    const plain = Number(t);
    if (Number.isFinite(plain)) return plain;
    const m = t.match(/^(-?(?:\d+\.?\d*|\.\d+))\s*([KkMmBbTt])$/);
    if (!m) return null;
    const base = Number(m[1]);
    if (!Number.isFinite(base)) return null;
    const suf = (m[2] ?? "").toUpperCase();
    const mult = suf === "K" ? 1e3 : suf === "M" ? 1e6 : suf === "B" ? 1e9 : suf === "T" ? 1e12 : 1;
    return base * mult;
  }
  if (typeof v === "object" && v !== null) {
    const obj = v as Record<string, unknown>;
    if ("raw" in obj) {
      const inner = yahooCoerceNumberLeaf(obj["raw"]);
      if (inner != null) return inner;
    }
    if (typeof obj["fmt"] === "string") {
      const fromFmt = yahooCoerceNumberLeaf(obj["fmt"]);
      if (fromFmt != null) return fromFmt;
    }
  }
  return null;
}

function yahooStatementNum(row: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    if (!Object.prototype.hasOwnProperty.call(row, k)) continue;
    const n = yahooCoerceNumberLeaf(row[k]);
    if (n != null && Number.isFinite(n)) return n;
  }
  return null;
}

function sharesFromQuoteSummary(qs: unknown): number | null {
  if (!qs || typeof qs !== "object") return null;
  const dk = (qs as Record<string, unknown>)["defaultKeyStatistics"];
  if (!dk || typeof dk !== "object") return null;
  const d = dk as Record<string, unknown>;
  const raw =
    yahooStatementNum(d, ["sharesOutstanding"]) ??
    yahooStatementNum(d, ["impliedSharesOutstanding"]) ??
    yahooStatementNum(d, ["floatShares"]);
  if (raw == null || !Number.isFinite(raw) || raw <= 0) return null;
  return raw;
}

/**
 * ネットキャッシュ（Yahoo: `financialData` 優先、次に年次 `balanceSheetHistory` 最上行）。
 * 定義: 流動性の高い資産 − 有利子負債（FMP スクリプトと同趣旨の近似）。
 */
function netCashFromYahooQuoteSummary(qs: unknown): number | null {
  if (!qs || typeof qs !== "object") return null;
  const o = qs as Record<string, unknown>;

  const fd = o["financialData"];
  if (fd && typeof fd === "object") {
    const f = fd as Record<string, unknown>;
    let tc = yahooStatementNum(f, ["totalCash", "totalCashCommon"]);
    const td = yahooStatementNum(f, ["totalDebt"]);
    if (tc == null || !Number.isFinite(tc)) {
      const tcps = yahooStatementNum(f, ["totalCashPerShare"]);
      const sh = sharesFromQuoteSummary(o);
      if (tcps != null && Number.isFinite(tcps) && sh != null && Number.isFinite(sh) && sh > 0) {
        tc = tcps * sh;
      }
    }
    if (tc != null && Number.isFinite(tc) && td != null && Number.isFinite(td)) {
      return tc - td;
    }
    if (tc != null && Number.isFinite(tc) && (td == null || !Number.isFinite(td))) {
      return tc;
    }
  }

  const bsh = o["balanceSheetHistory"];
  if (!bsh || typeof bsh !== "object") return null;
  const b = bsh as Record<string, unknown>;
  const inner = b["balanceSheetHistory"] ?? b["balanceSheetStatements"];
  if (!Array.isArray(inner) || inner.length === 0) return null;
  const rows = inner.filter((r): r is Record<string, unknown> => r != null && typeof r === "object") as Record<
    string,
    unknown
  >[];
  if (rows.length === 0) return null;
  const top = sortStatementRowsByEndDateDesc(rows)[0]!;
  const totalDebt = yahooStatementNum(top, ["totalDebt", "shortLongTermDebt"]);
  const cComb = yahooStatementNum(top, [
    "cashAndShortTermInvestments",
    "cashAndCashEquivalents",
    "totalCash",
  ]);
  if (cComb != null && Number.isFinite(cComb) && totalDebt != null && Number.isFinite(totalDebt)) {
    return cComb - totalDebt;
  }
  const cash = yahooStatementNum(top, ["cash"]) ?? 0;
  const sti = yahooStatementNum(top, ["shortLongTermInvestments", "shortTermInvestments"]) ?? 0;
  const liq = (Number.isFinite(cash) ? cash : 0) + (Number.isFinite(sti) ? sti : 0);
  if (totalDebt != null && Number.isFinite(totalDebt)) {
    return liq - totalDebt;
  }
  if (liq !== 0 && Number.isFinite(liq)) return liq;
  return null;
}

function isJpListedEfficiencyKind(kind: TickerInstrumentKind): boolean {
  return kind === "JP_LISTED_EQUITY" || kind === "JP_INVESTMENT_TRUST";
}

function isEfficiencyFetchTarget(kind: TickerInstrumentKind): boolean {
  return kind === "US_EQUITY" || isJpListedEfficiencyKind(kind);
}

function rowFiscalEndMs(row: Record<string, unknown>): number | null {
  return dateKeyMs(row["endDate"] ?? row["asOfDate"]);
}

function sortStatementRowsByEndDateDesc(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return [...rows].sort((a, b) => {
    const ma = rowFiscalEndMs(a);
    const mb = rowFiscalEndMs(b);
    if (ma == null && mb == null) return 0;
    if (ma == null) return 1;
    if (mb == null) return -1;
    return mb - ma;
  });
}

function incomeStatementHistoryRows(qs: Record<string, unknown>): Record<string, unknown>[] {
  const mod = qs["incomeStatementHistory"];
  if (!mod || typeof mod !== "object") return [];
  const inner = (mod as Record<string, unknown>)["incomeStatementHistory"];
  if (!Array.isArray(inner)) return [];
  return inner.filter((r): r is Record<string, unknown> => r != null && typeof r === "object") as Record<
    string,
    unknown
  >[];
}

function cashflowStatementHistoryRows(qs: Record<string, unknown>): Record<string, unknown>[] {
  const mod = qs["cashflowStatementHistory"];
  if (!mod || typeof mod !== "object") return [];
  const o = mod as Record<string, unknown>;
  const candidates = [o["cashflowStatements"], o["cashflowStatementHistory"]];
  for (const c of candidates) {
    if (Array.isArray(c)) {
      return c.filter((r): r is Record<string, unknown> => r != null && typeof r === "object") as Record<
        string,
        unknown
      >[];
    }
  }
  return [];
}

function inferAnnualFcfFromCashflowRow(row: Record<string, unknown>): number | null {
  const direct = yahooStatementNum(row, ["freeCashFlow"]);
  if (direct != null && Number.isFinite(direct)) return direct;
  const ocf = yahooStatementNum(row, ["totalCashFromOperatingActivities"]);
  const capex = yahooStatementNum(row, ["capitalExpenditure"]);
  if (
    ocf != null &&
    capex != null &&
    Number.isFinite(ocf) &&
    Number.isFinite(capex)
  ) {
    return ocf + capex;
  }
  return null;
}

function marketCapFromQuoteSummary(qs: Record<string, unknown>): number | null {
  for (const key of ["financialData", "defaultKeyStatistics", "summaryDetail"]) {
    const mod = qs[key];
    if (!mod || typeof mod !== "object") continue;
    const mc = yahooStatementNum(mod as Record<string, unknown>, ["marketCap"]);
    if (mc != null && mc > 0) return mc;
  }
  return null;
}

function regularMarketPriceFromQuoteSummary(qs: Record<string, unknown>): number | null {
  const priceMod = qs["price"];
  if (priceMod && typeof priceMod === "object") {
    const p = yahooStatementNum(priceMod as Record<string, unknown>, [
      "regularMarketPrice",
      "regularMarketPreviousClose",
    ]);
    if (p != null && p > 0) return p;
  }
  const sd = qs["summaryDetail"];
  if (sd && typeof sd === "object") {
    const p = yahooStatementNum(sd as Record<string, unknown>, ["regularMarketPreviousClose"]);
    if (p != null && p > 0) return p;
  }
  return null;
}

type JpFallbackParsed = {
  revenueGrowthPct: number;
  fcfMarginPct: number;
  annualFcf: number | null;
  fcfYieldPct: number | null;
  ebitda: number | null;
};

/**
 * quoteSummary の年次 PL / CF / 時価総額から日本株向けに指標を抽出（TS フォールバック）。
 */
function parseJpFallbackFromQuoteSummary(qsRaw: unknown): JpFallbackParsed | null {
  if (!qsRaw || typeof qsRaw !== "object") return null;
  const qs = qsRaw as Record<string, unknown>;

  const incomeSorted = sortStatementRowsByEndDateDesc(incomeStatementHistoryRows(qs));
  const cashSorted = sortStatementRowsByEndDateDesc(cashflowStatementHistoryRows(qs));

  let revenueGrowthPct = Number.NaN;
  const revChain = incomeSorted
    .map((r) => {
      const rev = yahooStatementNum(r, ["totalRevenue"]);
      return rev != null && rev > 0 ? rev : null;
    })
    .filter((x): x is number => x != null);
  if (revChain.length >= 2) {
    const r0 = revChain[0]!;
    const r1 = revChain[1]!;
    if (r1 !== 0) revenueGrowthPct = ((r0 - r1) / r1) * 100;
  }

  let annualFcf: number | null = null;
  const topInc = incomeSorted[0];
  let latestRev: number | null = null;
  if (topInc) {
    latestRev = yahooStatementNum(topInc, ["totalRevenue"]);
    const topEnd = rowFiscalEndMs(topInc);
    const cfMatch =
      (topEnd != null ? cashSorted.find((c) => rowFiscalEndMs(c) === topEnd) : null) ??
      cashSorted[0] ??
      null;
    if (cfMatch) {
      const f = inferAnnualFcfFromCashflowRow(cfMatch);
      if (f != null && Number.isFinite(f)) annualFcf = f;
    }
  }

  let ebitda: number | null = null;
  const fd = qs["financialData"];
  if (fd && typeof fd === "object") {
    const fcfYahoo = yahooStatementNum(fd as Record<string, unknown>, ["freeCashflow", "freeCashFlow"]);
    if (fcfYahoo != null && Number.isFinite(fcfYahoo)) {
      if (annualFcf == null || !Number.isFinite(annualFcf)) annualFcf = fcfYahoo;
    }
    const eb = yahooStatementNum(fd as Record<string, unknown>, ["ebitda", "EBITDA", "trailingEbitda", "TrailingEbitda"]);
    if (eb != null && Number.isFinite(eb)) ebitda = eb;
  }

  if (ebitda == null && topInc) {
    /** incomeStatementHistory から EBITDA を近似（営業利益 + 減価償却費） */
    const opInc = yahooStatementNum(topInc, ["operatingIncome", "OperatingIncome"]);
    if (opInc != null && Number.isFinite(opInc)) {
      const topEnd = rowFiscalEndMs(topInc);
      const cfMatch =
        (topEnd != null ? cashSorted.find((c) => rowFiscalEndMs(c) === topEnd) : null) ??
        cashSorted[0] ??
        null;
      if (cfMatch) {
        const dep = yahooStatementNum(cfMatch, [
          "depreciation",
          "depreciationAndAmortization",
          "DepreciationAndAmortization",
          "depreciationAmortization",
        ]);
        if (dep != null && Number.isFinite(dep)) {
          ebitda = opInc + Math.abs(dep);
        }
      }
    }
  }

  let fcfMarginPct = Number.NaN;
  if (
    latestRev != null &&
    latestRev > 0 &&
    annualFcf != null &&
    Number.isFinite(annualFcf)
  ) {
    fcfMarginPct = (annualFcf / latestRev) * 100;
  }

  const mcap = marketCapFromQuoteSummary(qs);
  const px = regularMarketPriceFromQuoteSummary(qs);
  const shOut = sharesFromQuoteSummary(qsRaw);

  let fcfYieldPct: number | null = null;
  if (annualFcf != null && Number.isFinite(annualFcf)) {
    if (mcap != null && mcap > 0) {
      fcfYieldPct = (annualFcf / mcap) * 100;
    } else if (shOut != null && shOut > 0 && px != null && px > 0) {
      fcfYieldPct = (annualFcf / (shOut * px)) * 100;
    }
  }

  const hasAny =
    Number.isFinite(revenueGrowthPct) ||
    Number.isFinite(fcfMarginPct) ||
    (annualFcf != null && Number.isFinite(annualFcf)) ||
    (ebitda != null && Number.isFinite(ebitda));
  if (!hasAny) return null;

  return { revenueGrowthPct, fcfMarginPct, annualFcf, fcfYieldPct, ebitda };
}

function jpNeedsQuoteFallback(
  kind: TickerInstrumentKind,
  merged: MergedAnnual[],
  ts: { revenueGrowthPct: number; fcfMarginPct: number },
): boolean {
  if (!isJpListedEfficiencyKind(kind)) return false;
  if (merged.length === 0) return true;
  if (!Number.isFinite(ts.revenueGrowthPct)) return true;
  if (!Number.isFinite(ts.fcfMarginPct)) return true;
  return false;
}

/**
 * quoteSummary から欠損のみ埋める。TS で既に有限の値は上書きしない。
 * `fcf_yield` は DB 静的列用に、fb 側が有限なら設定する（TS 単体では null になりやすい）。
 */
function mergeQuoteSummaryFallbackIntoMetrics(
  tsBaseline: { revenueGrowthPct: number; fcfMarginPct: number; annualFcf: number | null; ebitda: number | null },
  current: {
    revenueGrowthPct: number;
    fcfMarginPct: number;
    annualFcf: number | null;
    fcfYieldStored: number | null;
    ebitda: number | null;
  },
  fb: JpFallbackParsed,
): { revenueGrowthPct: number; fcfMarginPct: number; annualFcf: number | null; fcfYieldStored: number | null; ebitda: number | null; applied: boolean } {
  let applied = false;
  let revenueGrowthPct = current.revenueGrowthPct;
  let fcfMarginPct = current.fcfMarginPct;
  let annualFcf = current.annualFcf;
  let fcfYieldStored = current.fcfYieldStored;
  let ebitda = current.ebitda;

  if (!Number.isFinite(tsBaseline.revenueGrowthPct) && Number.isFinite(fb.revenueGrowthPct)) {
    revenueGrowthPct = fb.revenueGrowthPct;
    applied = true;
  }
  if (!Number.isFinite(tsBaseline.fcfMarginPct) && Number.isFinite(fb.fcfMarginPct)) {
    fcfMarginPct = fb.fcfMarginPct;
    applied = true;
  }
  if (
    (tsBaseline.annualFcf == null || !Number.isFinite(tsBaseline.annualFcf)) &&
    fb.annualFcf != null &&
    Number.isFinite(fb.annualFcf)
  ) {
    annualFcf = fb.annualFcf;
    applied = true;
  }
  if (fb.fcfYieldPct != null && Number.isFinite(fb.fcfYieldPct)) {
    fcfYieldStored = fb.fcfYieldPct;
    applied = true;
  }
  if (
    (tsBaseline.ebitda == null || !Number.isFinite(tsBaseline.ebitda)) &&
    fb.ebitda != null &&
    Number.isFinite(fb.ebitda)
  ) {
    ebitda = fb.ebitda;
    applied = true;
  }

  return { revenueGrowthPct, fcfMarginPct, annualFcf, fcfYieldStored, ebitda, applied };
}

async function main() {
  dotenv.config({ path: path.join(process.cwd(), ".env.local") });

  if (!isDbConfigured()) {
    throw new Error("Database not configured (set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN)");
  }

  const rawDelay = Number(process.env.YAHOO_FUNDAMENTALS_DELAY_MS ?? "1000") || 1000;
  const delayMs = Math.round(Math.min(1200, Math.max(800, rawDelay)));
  const maxTickers = Math.max(1, Number(process.env.YAHOO_MAX_TICKERS ?? "200") || 200);

  const userIdArg = process.argv.slice(2).find((a) => !a.startsWith("--"));
  const userId = userIdArg && userIdArg.trim().length > 0 ? userIdArg.trim() : defaultProfileUserId();

  const db = getDb();
  const holdingsRs = await db.execute({
    sql: `SELECT ticker, provider_symbol FROM holdings WHERE user_id = ? AND quantity > 0 ORDER BY ticker`,
    args: [userId],
  });

  type YahooTargetRow = { ticker: string; yahooSym: string; instrumentKind: TickerInstrumentKind };
  const fromHoldings: YahooTargetRow[] = [];
  for (const r of holdingsRs.rows as { ticker?: unknown; provider_symbol?: unknown }[]) {
    const ticker = String(r.ticker ?? "").trim();
    if (ticker.length === 0) continue;
    const ps = r.provider_symbol != null && String(r.provider_symbol).length > 0 ? String(r.provider_symbol) : null;
    const tickerForYahoo =
      ps != null && ps.trim().length > 0 ? ticker : normalizeTickerForYahooSymbol(ticker);
    const instrumentKind = classifyTickerInstrument(tickerForYahoo);
    if (!isEfficiencyFetchTarget(instrumentKind)) continue;
    const yahooSym = toYahooFinanceSymbol(tickerForYahoo, ps);
    if (yahooSym.trim().length === 0) continue;
    fromHoldings.push({ ticker: ticker.toUpperCase(), yahooSym, instrumentKind });
  }

  let ecosystemTickers: string[] = [];
  try {
    const ecoRs = await db.execute({
      sql: `SELECT DISTINCT ticker FROM theme_ecosystem_members WHERE COALESCE(is_unlisted, 0) = 0`,
      args: [],
    });
    ecosystemTickers = (ecoRs.rows as { ticker?: unknown }[])
      .map((row) => String(row.ticker ?? "").trim())
      .filter((t) => t.length > 0);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[warn] theme_ecosystem_members の読込に失敗（保有銘柄のみ）: ${msg}`);
  }

  const fromEcosystem: YahooTargetRow[] = [];
  for (const ticker of ecosystemTickers) {
    if (ecosystemTickerExcludedFromYahooFundamentals(ticker)) continue;
    const dbTickerUpper = ticker.toUpperCase();
    const tickerForYahoo = normalizeTickerForYahooSymbol(ticker);
    const instrumentKind = classifyTickerInstrument(tickerForYahoo);
    if (!isEfficiencyFetchTarget(instrumentKind)) continue;
    const yahooSym = toYahooFinanceSymbol(tickerForYahoo, null);
    if (yahooSym.trim().length === 0) continue;
    fromEcosystem.push({ ticker: dbTickerUpper, yahooSym, instrumentKind });
  }

  /** 保有を優先（provider_symbol 付き Yahoo シンボル）、不足分をエコシステムで補完 */
  const dedup = new Map<string, YahooTargetRow>();
  for (const t of fromHoldings) {
    dedup.set(t.ticker, t);
  }
  for (const t of fromEcosystem) {
    if (!dedup.has(t.ticker)) dedup.set(t.ticker, t);
  }

  const mergedAll = [...dedup.values()];
  const lastUpdatedByTicker = await fetchLastUpdatedMap(db);

  const sortKey = (tickerUpper: string): [number, number] => {
    const lu = lastUpdatedByTicker.get(tickerUpper);
    if (lu === undefined) return [0, 0];
    const ts = lu ? Date.parse(lu) : 0;
    return [1, Number.isFinite(ts) ? ts : 0];
  };

  const pendingRefresh = mergedAll
    .filter((t) => needsFetch(t.ticker, lastUpdatedByTicker))
    .sort((a, b) => {
      const [ka1, ka2] = sortKey(a.ticker);
      const [kb1, kb2] = sortKey(b.ticker);
      if (ka1 !== kb1) return ka1 - kb1;
      return ka2 - kb2;
    });

  const batch = pendingRefresh.slice(0, maxTickers);

  const pause = async (factor = 1) => {
    const ms = Math.round(delayMs * factor);
    if (ms > 0) await sleep(ms);
  };

  console.log(
    `Yahoo fundamentals: user=${userId} holdings=${fromHoldings.length} ecosystem=${fromEcosystem.length} merged_unique=${mergedAll.length} pending_refresh=${pendingRefresh.length} batch=${batch.length} baseDelayMs=${delayMs} | TS + quoteSummary（JP 欠損時 / US 常時） | sources=${SOURCE_YAHOO_TS}|${SOURCE_YAHOO_JP}|${SOURCE_YAHOO_US_QS}`,
  );

  let ok = 0;
  let skipped = 0;
  let failed = 0;
  let newMetricRows = 0;
  let updatedMetricRows = 0;

  for (let i = 0; i < batch.length; i++) {
    const row = batch[i]!;
    const { ticker, yahooSym, instrumentKind } = row;
    const hadRowBefore = lastUpdatedByTicker.has(ticker);
    try {
      const tsOpts = {
        period1: TS_PERIOD1,
        type: "annual" as const,
      };

      const finRows = await yahooFinance.fundamentalsTimeSeries(yahooSym, {
        ...tsOpts,
        module: "financials",
      });
      await pause(0.5);

      const cfRows = await yahooFinance.fundamentalsTimeSeries(yahooSym, {
        ...tsOpts,
        module: "cash-flow",
      });
      await pause(0.5);

      const merged = mergeAnnualRows(finRows, cfRows);

      if (merged.length === 0) {
        console.warn(`[warn] ${ticker} (${yahooSym}): fundamentalsTimeSeries returned no annual rows`);
      }

      const tsMetrics = computeMetricsFromMerged(merged);
      let revenueGrowthPct = tsMetrics.revenueGrowthPct;
      let fcfMarginPct = tsMetrics.fcfMarginPct;
      let annualFcf = tsMetrics.annualFcf;
      let ebitda = tsMetrics.ebitda;

      const needJpQs =
        isJpListedEfficiencyKind(instrumentKind) &&
        jpNeedsQuoteFallback(instrumentKind, merged, {
          revenueGrowthPct,
          fcfMarginPct,
        });

      /** 米国株は TS だけでは fcf_yield が空になりやすいため、quoteSummary 拡張を常に取得して補完する。 */
      const useUsQuoteDetail = instrumentKind === "US_EQUITY";
      const needExtendedQuote = needJpQs || useUsQuoteDetail;

      const quoteModules: QuoteSummaryModules[] = needExtendedQuote
        ? ([...QUOTE_SUMMARY_EXTENDED_MODULES] as QuoteSummaryModules[])
        : (["defaultKeyStatistics", ...NET_CASH_QUOTE_EXTRA_MODULES] as QuoteSummaryModules[]);

      let sharesOut: number | null = null;
      let netCash: number | null = null;
      let fcfYieldStored: number | null = null;
      let quoteFallbackApplied = false;

      try {
        const qs = await yahooFinance.quoteSummary(
          yahooSym,
          {
            modules: quoteModules,
          },
          {
            validateResult: false,
          } as any,
        );
        await pause(1);

        sharesOut = sharesFromQuoteSummary(qs);
        netCash = netCashFromYahooQuoteSummary(qs);

        if (needExtendedQuote) {
          const fb = parseJpFallbackFromQuoteSummary(qs);
          if (fb != null) {
            const mergedFb = mergeQuoteSummaryFallbackIntoMetrics(
              {
                revenueGrowthPct: tsMetrics.revenueGrowthPct,
                fcfMarginPct: tsMetrics.fcfMarginPct,
                annualFcf: tsMetrics.annualFcf,
                ebitda: tsMetrics.ebitda,
              },
              { revenueGrowthPct, fcfMarginPct, annualFcf, fcfYieldStored, ebitda },
              fb,
            );
            revenueGrowthPct = mergedFb.revenueGrowthPct;
            fcfMarginPct = mergedFb.fcfMarginPct;
            annualFcf = mergedFb.annualFcf;
            fcfYieldStored = mergedFb.fcfYieldStored;
            ebitda = mergedFb.ebitda;
            quoteFallbackApplied = mergedFb.applied;
          } else if (merged.length === 0) {
            const region = useUsQuoteDetail ? "US" : "JP";
            console.warn(`[warn] ${ticker} (${yahooSym}): ${region} quoteSummary fallback produced no metrics`);
          }
        }
      } catch (eQs) {
        const msg = eQs instanceof Error ? eQs.message : String(eQs);
        console.warn(`[warn] ${ticker} (${yahooSym}): quoteSummary failed, skipping fallback/meta: ${msg}`);
      }

      const sourceTag = quoteFallbackApplied
        ? instrumentKind === "US_EQUITY"
          ? SOURCE_YAHOO_US_QS
          : SOURCE_YAHOO_JP
        : SOURCE_YAHOO_TS;

      const ruleOf40 =
        Number.isFinite(revenueGrowthPct) && Number.isFinite(fcfMarginPct)
          ? revenueGrowthPct + fcfMarginPct
          : Number.NaN;

      const isoNow = new Date().toISOString();

      await db.execute({
        sql: `INSERT INTO ticker_efficiency_metrics
                (ticker, revenue_growth, fcf_margin, annual_fcf, shares_outstanding, rule_of_40,
                 fcf_yield, net_cash, ebitda, source, last_updated_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
              ON CONFLICT(ticker) DO UPDATE SET
                revenue_growth = COALESCE(excluded.revenue_growth, ticker_efficiency_metrics.revenue_growth),
                fcf_margin = COALESCE(excluded.fcf_margin, ticker_efficiency_metrics.fcf_margin),
                annual_fcf = COALESCE(excluded.annual_fcf, ticker_efficiency_metrics.annual_fcf),
                shares_outstanding = COALESCE(excluded.shares_outstanding, ticker_efficiency_metrics.shares_outstanding),
                rule_of_40 = COALESCE(excluded.rule_of_40, ticker_efficiency_metrics.rule_of_40),
                fcf_yield = COALESCE(excluded.fcf_yield, ticker_efficiency_metrics.fcf_yield),
                net_cash = COALESCE(excluded.net_cash, ticker_efficiency_metrics.net_cash),
                ebitda = COALESCE(excluded.ebitda, ticker_efficiency_metrics.ebitda),
                source = COALESCE(excluded.source, ticker_efficiency_metrics.source),
                last_updated_at = COALESCE(excluded.last_updated_at, ticker_efficiency_metrics.last_updated_at),
                updated_at = datetime('now')`,
        args: [
          ticker,
          Number.isFinite(revenueGrowthPct) ? revenueGrowthPct : null,
          Number.isFinite(fcfMarginPct) ? fcfMarginPct : null,
          annualFcf != null && Number.isFinite(annualFcf) ? annualFcf : null,
          sharesOut,
          Number.isFinite(ruleOf40) ? ruleOf40 : null,
          fcfYieldStored,
          netCash != null && Number.isFinite(netCash) ? netCash : null,
          ebitda != null && Number.isFinite(ebitda) ? ebitda : null,
          sourceTag,
          isoNow,
        ],
      });

      const hasAny =
        Number.isFinite(revenueGrowthPct) ||
        Number.isFinite(fcfMarginPct) ||
        (annualFcf != null && Number.isFinite(annualFcf)) ||
        (sharesOut != null && sharesOut > 0) ||
        (fcfYieldStored != null && Number.isFinite(fcfYieldStored)) ||
        (netCash != null && Number.isFinite(netCash)) ||
        (ebitda != null && Number.isFinite(ebitda));

      if (hasAny) {
        ok += 1;
        if (hadRowBefore) updatedMetricRows += 1;
        else newMetricRows += 1;
        const bits: string[] = [];
        if (Number.isFinite(revenueGrowthPct)) bits.push(`revYoY=${revenueGrowthPct.toFixed(2)}%`);
        if (Number.isFinite(fcfMarginPct)) bits.push(`fcfM=${fcfMarginPct.toFixed(2)}%`);
        if (Number.isFinite(ruleOf40)) bits.push(`R40=${ruleOf40.toFixed(2)}`);
        if (fcfYieldStored != null && Number.isFinite(fcfYieldStored)) {
          bits.push(`fcfY≈${fcfYieldStored.toFixed(2)}%`);
        }
        if (ebitda != null && Number.isFinite(ebitda)) {
          const abs = Math.abs(ebitda);
          const scale = abs >= 1e12 ? "T" : abs >= 1e9 ? "B" : abs >= 1e6 ? "M" : "";
          const div = abs >= 1e12 ? 1e12 : abs >= 1e9 ? 1e9 : abs >= 1e6 ? 1e6 : 1;
          bits.push(`ebitda≈${(ebitda / div).toFixed(2)}${scale}`);
        }
        if (netCash != null && Number.isFinite(netCash)) {
          const abs = Math.abs(netCash);
          const scale =
            abs >= 1e12 ? "T" : abs >= 1e9 ? "B" : abs >= 1e6 ? "M" : "";
          const div = abs >= 1e12 ? 1e12 : abs >= 1e9 ? 1e9 : abs >= 1e6 ? 1e6 : 1;
          if (scale) bits.push(`netC≈${(netCash / div).toFixed(2)}${scale}`);
          else bits.push(`netC≈${netCash.toFixed(0)}`);
        }
        bits.push(`src=${sourceTag}`);
        console.log(`[ok] ${ticker} (${yahooSym}): ${bits.join(", ")} | periods=${merged.length}`);
      } else {
        skipped += 1;
        console.warn(`[warn] ${ticker} (${yahooSym}): no metrics (merged periods=${merged.length})`);
      }
    } catch (e) {
      failed += 1;
      console.warn(`[skip] ${ticker}: ${e instanceof Error ? e.message : String(e)}`);
    }

    if (i < batch.length - 1 && delayMs > 0) await pause(1);
  }

  console.log(
    `Done. upsert_attempts=${batch.length} 新規取得銘柄数=${newMetricRows} 更新銘柄数=${updatedMetricRows} ok_metrics=${ok} empty_parse=${skipped} failed=${failed} (${SOURCE_YAHOO_TS}|${SOURCE_YAHOO_JP}|${SOURCE_YAHOO_US_QS})`,
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
