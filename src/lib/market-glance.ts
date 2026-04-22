/**
 * Market glance "Nenrin" (cumulative change from start) series builder.
 *
 * Server-only: uses Yahoo Finance APIs.
 */
import YahooFinance from "yahoo-finance2";

import { MARKET_GLANCE_MACRO_SYMBOL_SET } from "@/src/lib/market-glance-macros";

const yahooFinance = new YahooFinance();

export type MarketGlancePeriod = "5d" | "1mo";

export type MarketNenrinPoint = {
  /** YYYY-MM-DD (UTC) */
  date: string;
  /** Cumulative change from first day close (%). First point is always 0. */
  changePct: number;
};

function formatDateYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function chartBarDateYmd(q: { date: unknown }): string | null {
  const d = q.date instanceof Date ? q.date : new Date(String(q.date));
  if (Number.isNaN(d.getTime())) return null;
  return formatDateYmd(d);
}

function roundPct(v: number): number {
  return Math.round(v * 100) / 100;
}

function normalizePeriod(raw: string | null): MarketGlancePeriod {
  if (raw === "5d") return "5d";
  return "1mo";
}

export function assertAllowedMacroSymbol(symbol: string): void {
  if (!MARKET_GLANCE_MACRO_SYMBOL_SET.has(symbol)) {
    throw new Error(`Unsupported symbol: ${symbol}`);
  }
}

export async function fetchMarketNenrinSeries(input: {
  symbol: string;
  period?: MarketGlancePeriod;
}): Promise<{ symbol: string; period: MarketGlancePeriod; points: MarketNenrinPoint[] }> {
  const symbol = input.symbol;
  assertAllowedMacroSymbol(symbol);
  const period = normalizePeriod(input.period ?? "1mo");

  const CALENDAR_BUFFER_DAYS = 18;
  const calendarDays = period === "5d" ? 9 : 35; // trading-day targeting with a small buffer
  const periodRangeForCalendarDays = (days: number): { period1: string; period2: string } => {
    const safeDays = Math.max(1, Math.floor(Number.isFinite(days) ? days : 1));
    const period2 = new Date();
    const period1 = new Date(period2.getTime());
    const span = safeDays + CALENDAR_BUFFER_DAYS;
    period1.setUTCDate(period1.getUTCDate() - span);
    let p1 = period1.toISOString().slice(0, 10);
    const p2 = period2.toISOString().slice(0, 10);
    if (p1 >= p2) {
      period1.setUTCDate(period1.getUTCDate() - 1);
      p1 = period1.toISOString().slice(0, 10);
    }
    return { period1: p1, period2: p2 };
  };
  const { period1, period2 } = periodRangeForCalendarDays(calendarDays);

  const result = await yahooFinance.chart(symbol, { period1, period2, interval: "1d" });

  const quotes = result.quotes ?? [];
  const bars: { date: string; close: number }[] = [];
  for (const q of quotes) {
    if (q.close == null || !Number.isFinite(q.close) || q.close <= 0) continue;
    const ymd = chartBarDateYmd(q);
    if (ymd == null) continue;
    bars.push({ date: ymd, close: q.close });
  }

  if (bars.length === 0) {
    return { symbol, period, points: [] };
  }

  const base = bars[0]!.close;
  const points: MarketNenrinPoint[] = bars.map((b, i) => {
    if (i === 0) return { date: b.date, changePct: 0 };
    const pct = ((b.close - base) / base) * 100;
    return { date: b.date, changePct: Number.isFinite(pct) ? roundPct(pct) : 0 };
  });

  return { symbol, period, points };
}

