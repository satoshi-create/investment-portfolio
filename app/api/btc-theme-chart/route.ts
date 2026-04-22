import { NextResponse } from "next/server";

import {
  fetchDailyClosesByDate,
  mergeCloseMapsToNenrinRows,
  normalizeBtcThemePeriod,
  type BtcThemeChartPeriod,
} from "@/src/lib/btc-theme-chart-series";

export const dynamic = "force-dynamic";

const BTC_SYMBOL = "BTC-USD";
const MAX_SYMBOLS = 14;
const TICKER_RE = /^[A-Z0-9^=\-.]+$/i;
const REQUEST_GAP_MS = 400;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function parseTickersParam(raw: string | null): string[] {
  if (raw == null || raw.trim().length === 0) return [];
  const parts = raw.split(",").map((s) => s.trim().toUpperCase());
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    if (p.length === 0 || p.length > 16) continue;
    if (!TICKER_RE.test(p)) continue;
    if (seen.has(p)) continue;
    seen.add(p);
    out.push(p);
    if (out.length >= MAX_SYMBOLS) break;
  }
  return out;
}

/**
 * GET ?tickers=MSTR,COIN&period=1mo|5d|3mo
 * 常に BTC-USD を含め、複数シンボルの **共通日付** 上で期間初日比累積％を返す。
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const period = normalizeBtcThemePeriod(searchParams.get("period"));
  const requested = parseTickersParam(searchParams.get("tickers"));

  const withBtc = [BTC_SYMBOL, ...requested.filter((t) => t !== BTC_SYMBOL)];
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const t of withBtc) {
    if (seen.has(t)) continue;
    seen.add(t);
    unique.push(t);
    if (unique.length >= MAX_SYMBOLS) break;
  }

  if (unique.length === 0) {
    return NextResponse.json({ error: "No valid tickers" }, { status: 400 });
  }

  const errors: { ticker: string; message: string }[] = [];
  const byTicker = new Map<string, Map<string, number>>();

  for (let i = 0; i < unique.length; i++) {
    const tk = unique[i]!;
    try {
      const closes = await fetchDailyClosesByDate(tk, period);
      if (closes.size === 0) {
        errors.push({ ticker: tk, message: "no bars" });
      } else {
        byTicker.set(tk, closes);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push({ ticker: tk, message: msg });
    }
    if (i < unique.length - 1 && REQUEST_GAP_MS > 0) await sleep(REQUEST_GAP_MS);
  }

  if (byTicker.size === 0) {
    return NextResponse.json(
      { period, rows: [], tickers: [], errors, error: "All fetches failed" },
      { status: 502 },
    );
  }

  const { rows, tickers } = mergeCloseMapsToNenrinRows(byTicker);

  return NextResponse.json({
    period,
    tickers,
    rows,
    errors,
    asOf: new Date().toISOString(),
  });
}
