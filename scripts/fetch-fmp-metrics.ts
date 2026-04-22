/**
 * （任意 / 有料 FMP 向け）FMP から `ticker_efficiency_metrics` へ UPSERT。
 * 通常の自動取得は **Yahoo** `npm run fetch:fundamentals`（`fetch-fundamental-metrics.ts`）を推奨。
 * `net_cash` は Yahoo スクリプトで `financialData` / `balanceSheetHistory` から埋める想定（本スクリプトでも上書き可）。
 *
 * - Legacy の `/financial-growth/`、`/key-metrics-ttm/` は使用しない。
 * - 財務三表（年次: income + cash-flow + **balance-sheet**）＋`/quote` から自前計算（含 net_cash）。
 *
 * Env:
 *   FMP_API_KEY           — required
 *   FMP_DELAY_MS          — 各 HTTP 直後の待機 ms（既定 800）
 *   FMP_MAX_TICKERS       — 1 実行あたり最大銘柄数（既定 65；~4 req/銘柄 で日次上限の目安内）
 *   NEXT_PUBLIC_DEFAULT_PROFILE_USER_ID — holdings の user_id
 *
 * Usage:
 *   npx tsx scripts/fetch-fmp-metrics.ts [userId]
 */

import path from "node:path";

import dotenv from "dotenv";

import { classifyTickerInstrument } from "@/src/lib/alpha-logic";
import { defaultProfileUserId } from "@/src/lib/authorize-signals";
import { getDb, isDbConfigured } from "@/src/lib/db";

const FMP_V3 = "https://financialmodelingprep.com/api/v3";
const FMP_STABLE = "https://financialmodelingprep.com/stable";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function fmpSymbolForApi(ticker: string): string {
  const t = ticker.trim().toUpperCase();
  if (t.endsWith(".T")) return t;
  if (/^\d{4}$/.test(t)) return `${t}.T`;
  return t.replace(/\./g, "-");
}

function numOrNan(v: unknown): number {
  const n = v != null ? Number(v) : Number.NaN;
  return Number.isFinite(n) ? n : Number.NaN;
}

function getKey(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, k) && obj[k] != null) return obj[k];
  }
  return undefined;
}

/** Sort rows by date descending (ISO `date` / `calendarYear`). */
function sortRowsByDateDesc(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return [...rows].sort((a, b) => {
    const da = String(getKey(a, ["date", "calendarYear"]) ?? "");
    const db = String(getKey(b, ["date", "calendarYear"]) ?? "");
    return db.localeCompare(da);
  });
}

/** YoY 売上成長率（%）。 */
function computeRevenueGrowthYoYPctFromIncomeAnnual(data: unknown): number {
  if (!Array.isArray(data) || data.length < 2) return Number.NaN;
  const rows = sortRowsByDateDesc(
    data.filter((r): r is Record<string, unknown> => r != null && typeof r === "object"),
  );
  if (rows.length < 2) return Number.NaN;
  const latestRev = numOrNan(getKey(rows[0]!, ["revenue"]));
  const priorRev = numOrNan(getKey(rows[1]!, ["revenue"]));
  if (!Number.isFinite(latestRev) || !Number.isFinite(priorRev) || priorRev === 0) return Number.NaN;
  return ((latestRev - priorRev) / priorRev) * 100;
}

/** 直近年度の売上高（分母用）。 */
function parseLatestAnnualRevenueFromIncome(data: unknown): number {
  if (!Array.isArray(data) || data.length === 0) return Number.NaN;
  const rows = sortRowsByDateDesc(
    data.filter((r): r is Record<string, unknown> => r != null && typeof r === "object"),
  );
  const top = rows[0];
  if (!top) return Number.NaN;
  return numOrNan(getKey(top, ["revenue"]));
}

/** 直近年度の freeCashFlow（年次キャッシュフロー）。 */
function parseLatestAnnualFreeCashFlow(data: unknown): number {
  if (!Array.isArray(data) || data.length === 0) return Number.NaN;
  const rows = sortRowsByDateDesc(
    data.filter((r): r is Record<string, unknown> => r != null && typeof r === "object"),
  );
  const top = rows[0];
  if (!top) return Number.NaN;
  return numOrNan(getKey(top, ["freeCashFlow", "freeCashFlows"]));
}

/**
 * ネットキャッシュ ≈ 流動性の高い資産 − 有利子負債（FMP: cashAndShortTermInvestments 又は
 * cash + shortTermInvestments − totalDebt）。
 */
function parseLatestAnnualNetCashFromBalance(data: unknown): number {
  if (!Array.isArray(data) || data.length === 0) return Number.NaN;
  const rows = sortRowsByDateDesc(
    data.filter((r): r is Record<string, unknown> => r != null && typeof r === "object"),
  );
  const top = rows[0];
  if (!top) return Number.NaN;
  const totalDebt = numOrNan(getKey(top, ["totalDebt"]));
  const csi = getKey(top, ["cashAndShortTermInvestments"]);
  if (csi != null) {
    const c = numOrNan(csi);
    if (Number.isFinite(c) && Number.isFinite(totalDebt)) return c - totalDebt;
    if (Number.isFinite(c) && !Number.isFinite(totalDebt)) return c;
  }
  const cce = numOrNan(getKey(top, ["cashAndCashEquivalents"]));
  const sti = numOrNan(getKey(top, ["shortTermInvestments"]));
  const liquid = (Number.isFinite(cce) ? cce : 0) + (Number.isFinite(sti) ? sti : 0);
  const td = Number.isFinite(totalDebt) ? totalDebt : 0;
  if (!Number.isFinite(liquid) && !Number.isFinite(totalDebt)) return Number.NaN;
  if (!Number.isFinite(liquid) && totalDebt === 0) return Number.NaN;
  return liquid - td;
}

/** `/quote` — v3 は配列、Stable は単一オブジェクトの場合あり。 */
function parseQuote(data: unknown): { marketCap: number | null; sharesOutstanding: number | null } {
  const row: Record<string, unknown> | null =
    Array.isArray(data) && data.length > 0 && typeof data[0] === "object"
      ? (data[0] as Record<string, unknown>)
      : data != null && typeof data === "object" && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : null;
  if (!row) return { marketCap: null, sharesOutstanding: null };
  const mc = numOrNan(row["marketCap"]);
  const sh = numOrNan(
    getKey(row, ["sharesOutstanding", "weightedAverageShsOutDil", "weightedAverageShsOut"]),
  );
  return {
    marketCap: Number.isFinite(mc) ? mc : null,
    sharesOutstanding: Number.isFinite(sh) && sh > 0 ? sh : null,
  };
}

async function fmpJson(
  apiKey: string,
  pathAndQuery: string,
): Promise<{ ok: true; data: unknown } | { ok: false; status: number; snippet: string }> {
  const sep = pathAndQuery.includes("?") ? "&" : "?";
  const url = `${FMP_V3}${pathAndQuery}${sep}apikey=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, snippet: text.slice(0, 280) };
  }
  try {
    return { ok: true, data: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, status: res.status, snippet: "invalid json" };
  }
}

/** Stable API（クエリ形式）。403 時のフォールバック用。 */
/** v3 が 403/402 のとき Stable を試す（プランにより片方のみ通ることがある）。 */
function shouldRetryWithStable(status: number): boolean {
  return status === 403 || status === 402;
}

function fmpStatusHint(status: number): string {
  if (status === 402)
    return "402 Payment Required — 銘柄または Stable エンドポイントが現在のサブスクに含まれないことがあります（FMP でプラン確認）";
  if (status === 403) return "403 Forbidden — Legacy/未契約エンドポイントの可能性（Stable にフォールバック済みか確認）";
  return `HTTP ${status}`;
}

async function fmpStableJson(
  apiKey: string,
  endpoint: string,
  params: Record<string, string>,
): Promise<{ ok: true; data: unknown } | { ok: false; status: number; snippet: string }> {
  const base = endpoint.replace(/^\//, "");
  const u = new URL(`${FMP_STABLE}/${base}`);
  for (const [k, v] of Object.entries(params)) {
    u.searchParams.set(k, v);
  }
  u.searchParams.set("apikey", apiKey);
  const res = await fetch(u.toString());
  const text = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, snippet: text.slice(0, 280) };
  }
  try {
    return { ok: true, data: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, status: res.status, snippet: "invalid json" };
  }
}

async function main() {
  dotenv.config({ path: path.join(process.cwd(), ".env.local") });

  const apiKey = process.env.FMP_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("FMP_API_KEY is not set (.env.local)");
  }
  if (!isDbConfigured()) {
    throw new Error("Database not configured (set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN)");
  }

  const delayMs = Math.max(0, Number(process.env.FMP_DELAY_MS ?? "800") || 800);
  const maxTickers = Math.max(1, Number(process.env.FMP_MAX_TICKERS ?? "65") || 65);

  const userIdArg = process.argv.slice(2).find((a) => !a.startsWith("--"));
  const userId = userIdArg && userIdArg.trim().length > 0 ? userIdArg.trim() : defaultProfileUserId();

  const db = getDb();
  const rs = await db.execute({
    sql: `SELECT DISTINCT ticker FROM holdings WHERE user_id = ? AND quantity > 0`,
    args: [userId],
  });

  const listedTickers: string[] = [];
  for (const r of rs.rows as { ticker?: unknown }[]) {
    const t = String(r.ticker ?? "").trim();
    if (t.length === 0) continue;
    const k = classifyTickerInstrument(t);
    if (k !== "US_EQUITY" && k !== "JP_LISTED_EQUITY") continue;
    listedTickers.push(t.toUpperCase());
  }

  const unique = [...new Set(listedTickers)].sort((a, b) => a.localeCompare(b));
  const batch = unique.slice(0, maxTickers);

  console.log(
    `FMP: user=${userId} listedHoldings=${unique.length} batch=${batch.length} delayMs=${delayMs} (income + cash-flow + balance-sheet + quote [+stable 403 fallback])`,
  );

  let ok = 0;
  let skipped = 0;
  let failed = 0;

  const pause = async () => {
    if (delayMs > 0) await sleep(delayMs);
  };

  for (let i = 0; i < batch.length; i++) {
    const sym = batch[i]!;
    const fmpSym = fmpSymbolForApi(sym);
    try {
      let revenueGrowthPct = Number.NaN;
      let fcfMarginPct = Number.NaN;
      let annualFcf: number | null = null;
      let sharesOut: number | null = null;
      let netCash: number | null = null;

      /** 1) Income statement — YoY growth + latest revenue */
      let inc = await fmpJson(apiKey, `/income-statement/${encodeURIComponent(fmpSym)}?period=annual&limit=2`);
      if (!inc.ok && shouldRetryWithStable(inc.status)) {
        console.warn(`[warn] ${sym}: income-statement v3 ${inc.status} — trying stable`);
        await pause();
        inc = await fmpStableJson(apiKey, "income-statement", {
          symbol: fmpSym,
          period: "annual",
          limit: "2",
        });
      }
      await pause();
      if (!inc.ok) {
        console.warn(
          `[warn] ${sym}: income-statement failed ${inc.status} (${fmpStatusHint(inc.status)}) ${inc.snippet.slice(0, 120)}`,
        );
      } else {
        revenueGrowthPct = computeRevenueGrowthYoYPctFromIncomeAnnual(inc.data);
      }

      /** 2) Cash flow — 直近年度の freeCashFlow（年次・limit=1；ソートで最新列を採用） */
      let cf = await fmpJson(apiKey, `/cash-flow-statement/${encodeURIComponent(fmpSym)}?period=annual&limit=1`);
      if (!cf.ok && shouldRetryWithStable(cf.status)) {
        console.warn(`[warn] ${sym}: cash-flow-statement v3 ${cf.status} — trying stable`);
        await pause();
        cf = await fmpStableJson(apiKey, "cash-flow-statement", {
          symbol: fmpSym,
          period: "annual",
          limit: "1",
        });
      }
      await pause();
      if (!cf.ok) {
        console.warn(
          `[warn] ${sym}: cash-flow-statement failed ${cf.status} (${fmpStatusHint(cf.status)}) ${cf.snippet.slice(0, 120)}`,
        );
      } else {
        const fcf = parseLatestAnnualFreeCashFlow(cf.data);
        if (Number.isFinite(fcf)) annualFcf = fcf;
      }

      /** 2b) Balance sheet — ネットキャッシュ（年次） */
      let bal = await fmpJson(apiKey, `/balance-sheet-statement/${encodeURIComponent(fmpSym)}?period=annual&limit=1`);
      if (!bal.ok && shouldRetryWithStable(bal.status)) {
        console.warn(`[warn] ${sym}: balance-sheet-statement v3 ${bal.status} — trying stable`);
        await pause();
        bal = await fmpStableJson(apiKey, "balance-sheet-statement", {
          symbol: fmpSym,
          period: "annual",
          limit: "1",
        });
      }
      await pause();
      if (!bal.ok) {
        console.warn(
          `[warn] ${sym}: balance-sheet-statement failed ${bal.status} (${fmpStatusHint(bal.status)}) ${bal.snippet.slice(0, 120)}`,
        );
      } else {
        const nc = parseLatestAnnualNetCashFromBalance(bal.data);
        if (Number.isFinite(nc)) netCash = nc;
      }

      /** fcf_margin = FCF / 最新売上（年次を揃える：income の直近売上を分母） */
      if (inc.ok && annualFcf != null && Number.isFinite(annualFcf)) {
        const latestRev = parseLatestAnnualRevenueFromIncome(inc.data);
        if (Number.isFinite(latestRev) && latestRev > 0) {
          fcfMarginPct = (annualFcf / latestRev) * 100;
        }
      }

      /** 3) Quote — shares（動的 FCF Yield 用）、marketCap はログ用 */
      let qt = await fmpJson(apiKey, `/quote/${encodeURIComponent(fmpSym)}`);
      if (!qt.ok && shouldRetryWithStable(qt.status)) {
        console.warn(`[warn] ${sym}: quote v3 ${qt.status} — trying stable`);
        await pause();
        qt = await fmpStableJson(apiKey, "quote", { symbol: fmpSym });
      }
      await pause();
      if (!qt.ok) {
        console.warn(`[warn] ${sym}: quote failed ${qt.status} (${fmpStatusHint(qt.status)}) ${qt.snippet.slice(0, 120)}`);
      } else {
        const q = parseQuote(qt.data);
        sharesOut = q.sharesOutstanding;
      }

      const ruleOf40 =
        Number.isFinite(revenueGrowthPct) && Number.isFinite(fcfMarginPct)
          ? revenueGrowthPct + fcfMarginPct
          : Number.NaN;

      const isoNow = new Date().toISOString();

      await db.execute({
        sql: `INSERT INTO ticker_efficiency_metrics
                (ticker, revenue_growth, fcf_margin, annual_fcf, shares_outstanding, rule_of_40, net_cash,
                 source, last_updated_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
              ON CONFLICT(ticker) DO UPDATE SET
                revenue_growth = COALESCE(excluded.revenue_growth, ticker_efficiency_metrics.revenue_growth),
                fcf_margin = COALESCE(excluded.fcf_margin, ticker_efficiency_metrics.fcf_margin),
                annual_fcf = COALESCE(excluded.annual_fcf, ticker_efficiency_metrics.annual_fcf),
                shares_outstanding = COALESCE(excluded.shares_outstanding, ticker_efficiency_metrics.shares_outstanding),
                rule_of_40 = COALESCE(excluded.rule_of_40, ticker_efficiency_metrics.rule_of_40),
                net_cash = COALESCE(excluded.net_cash, ticker_efficiency_metrics.net_cash),
                source = COALESCE(excluded.source, ticker_efficiency_metrics.source),
                last_updated_at = COALESCE(excluded.last_updated_at, ticker_efficiency_metrics.last_updated_at),
                updated_at = datetime('now')`,
        args: [
          sym,
          Number.isFinite(revenueGrowthPct) ? revenueGrowthPct : null,
          Number.isFinite(fcfMarginPct) ? fcfMarginPct : null,
          annualFcf != null && Number.isFinite(annualFcf) ? annualFcf : null,
          sharesOut,
          Number.isFinite(ruleOf40) ? ruleOf40 : null,
          netCash,
          "FMP",
          isoNow,
        ],
      });

      const hasAny =
        Number.isFinite(revenueGrowthPct) ||
        Number.isFinite(fcfMarginPct) ||
        (annualFcf != null && Number.isFinite(annualFcf)) ||
        (sharesOut != null && sharesOut > 0) ||
        (netCash != null && Number.isFinite(netCash));
      if (hasAny) {
        ok += 1;
        const bits: string[] = [];
        if (Number.isFinite(revenueGrowthPct)) bits.push(`revYoY=${revenueGrowthPct.toFixed(2)}%`);
        if (Number.isFinite(fcfMarginPct)) bits.push(`fcfM=${fcfMarginPct.toFixed(2)}%`);
        if (Number.isFinite(ruleOf40)) bits.push(`R40=${ruleOf40.toFixed(2)}`);
        console.log(`[ok] ${sym}: ${bits.join(", ") || "partial columns"}`);
      } else skipped += 1;
    } catch (e) {
      failed += 1;
      console.warn(`[skip] ${sym}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log(`Done. upsert_attempts=${batch.length} ok_metrics=${ok} empty_parse=${skipped} failed=${failed}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
