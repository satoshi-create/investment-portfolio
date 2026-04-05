import type { Client } from "@libsql/client";

import { computeAlphaPercent, dailyReturnPercent, SIGNAL_BENCHMARK_TICKER } from "@/src/lib/alpha-logic";
import { linkAlphaHistoryHoldingForTicker, upsertAlphaHistoryRow } from "@/src/lib/db-operations";
import { fetchHoldingsWithProviderForUser } from "@/src/lib/holdings-queries";
import type { Holding } from "@/src/types/investment";
import type { PriceBar } from "@/src/lib/price-service";
import { fetchPriceHistory } from "@/src/lib/price-service";

/** Total rows below this ⇒ treat as “too thin” and backfill. */
const MIN_TOTAL_ALPHA_ROWS = 20;
/** Rough proxy for “missing ~30 trading days” of recent coverage (~40 calendar days in SQL). */
const MIN_RECENT_ALPHA_ROWS = 12;

function sharedSortedDates(stockBars: PriceBar[], vooBars: PriceBar[]): string[] {
  const vooSet = new Set(vooBars.map((b) => b.date));
  return [...new Set(stockBars.map((b) => b.date).filter((d) => vooSet.has(d)))].sort();
}

async function countAlphaHistoryTotal(
  db: Client,
  userId: string,
  ticker: string,
  benchmark: string,
): Promise<number> {
  const rs = await db.execute({
    sql: `SELECT COUNT(*) AS c FROM alpha_history
          WHERE user_id = ? AND ticker = ? AND benchmark_ticker = ?`,
    args: [userId, ticker, benchmark],
  });
  return Number(rs.rows[0]?.c ?? 0);
}

async function countAlphaHistoryRecent(
  db: Client,
  userId: string,
  ticker: string,
  benchmark: string,
): Promise<number> {
  const rs = await db.execute({
    sql: `SELECT COUNT(*) AS c FROM alpha_history
          WHERE user_id = ? AND ticker = ? AND benchmark_ticker = ?
            AND date(recorded_at) >= date('now', '-40 days')`,
    args: [userId, ticker, benchmark],
  });
  return Number(rs.rows[0]?.c ?? 0);
}

function needsBackfill(total: number, recent: number): boolean {
  if (total === 0) return true;
  if (total < MIN_TOTAL_ALPHA_ROWS) return true;
  if (recent < MIN_RECENT_ALPHA_ROWS) return true;
  return false;
}

async function backfillOneHolding(
  db: Client,
  userId: string,
  holding: Holding,
  vooBars: PriceBar[],
  days: number,
): Promise<number> {
  const vooByDate = new Map(vooBars.map((b) => [b.date, b.close]));
  const stockBars = await fetchPriceHistory(holding.ticker, days, holding.providerSymbol);
  const stockBy = new Map(stockBars.map((b) => [b.date, b.close]));
  const shared = sharedSortedDates(stockBars, vooBars);
  if (shared.length < 2) return 0;

  let written = 0;
  for (let i = 1; i < shared.length; i++) {
    const dPrev = shared[i - 1]!;
    const dCur = shared[i]!;
    const s0 = stockBy.get(dPrev);
    const s1 = stockBy.get(dCur);
    const b0 = vooByDate.get(dPrev);
    const b1 = vooByDate.get(dCur);
    if (s0 == null || s1 == null || b0 == null || b1 == null) continue;

    const rStock = dailyReturnPercent(s0, s1);
    const rBench = dailyReturnPercent(b0, b1);
    const alpha = computeAlphaPercent(rStock, rBench);
    if (alpha === null) continue;

    await upsertAlphaHistoryRow(db, {
      userId,
      ticker: holding.ticker,
      holdingId: holding.id,
      recordedAtYmd: dCur,
      closePrice: s1,
      alphaValue: alpha,
      benchmarkTicker: SIGNAL_BENCHMARK_TICKER,
    });
    written += 1;
  }
  return written;
}

export type ReconcileAlphaHistoryResult = {
  /** Tickers that had `holding_id` bulk-updated to the current holding row */
  linkedTickers: string[];
  backfilledTickers: string[];
  rowsBackfilled: number;
};

/**
 * For each holding: set `holding_id` on all matching `alpha_history` rows (re-link after re-add),
 * then backfill from Yahoo when history is empty or too thin vs recent window.
 */
export async function reconcileAlphaHistoryForUser(
  userId: string,
  db: Client,
  options?: { days?: number },
): Promise<ReconcileAlphaHistoryResult> {
  const holdings = await fetchHoldingsWithProviderForUser(db, userId);
  const linkedTickers: string[] = [];
  const backfilledTickers: string[] = [];
  let rowsBackfilled = 0;

  const days = options?.days ?? Math.max(5, Math.min(120, Math.floor(Number(process.env.BACKFILL_DAYS ?? "30") || 30)));

  let vooBars: PriceBar[] | null = null;

  for (const h of holdings) {
    await linkAlphaHistoryHoldingForTicker(db, userId, h.ticker, h.id);
    linkedTickers.push(h.ticker);

    const total = await countAlphaHistoryTotal(db, userId, h.ticker, SIGNAL_BENCHMARK_TICKER);
    const recent = await countAlphaHistoryRecent(db, userId, h.ticker, SIGNAL_BENCHMARK_TICKER);
    if (!needsBackfill(total, recent)) continue;

    if (!vooBars) {
      vooBars = await fetchPriceHistory(SIGNAL_BENCHMARK_TICKER, days, null);
    }
    if (vooBars.length < 2) break;

    const n = await backfillOneHolding(db, userId, h, vooBars, days);
    rowsBackfilled += n;
    if (n > 0) backfilledTickers.push(h.ticker);
  }

  return { linkedTickers, backfilledTickers, rowsBackfilled };
}
