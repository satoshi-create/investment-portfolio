/**
 * Backfill `alpha_history` for periodic_table_watchlist tickers (VOO benchmark).
 * Usage: npx tsx scripts/backfill-periodic-table.ts [userId]
 * Env: BACKFILL_DAYS (default 60), BACKFILL_DELAY_MS (default 250)
 *
 * Requires:
 * - TURSO_DATABASE_URL / TURSO_AUTH_TOKEN in .env.local
 * - periodic_table_watchlist table with `ticker` column (NULL/empty ignored)
 */
import { config } from "dotenv";

import { defaultProfileUserId } from "../src/lib/authorize-signals";
import {
  computeAlphaPercent,
  dailyReturnPercent,
  SIGNAL_BENCHMARK_TICKER,
} from "../src/lib/alpha-logic";
import { upsertAlphaHistoryRow } from "../src/lib/db-operations";
import { getDb, isDbConfigured } from "../src/lib/db";
import { fetchPriceHistory } from "../src/lib/price-service";

config({ path: ".env.local" });
config();

type WatchRow = { ticker: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function sharedSortedDates(
  stockBars: { date: string; close: number }[],
  vooBars: { date: string; close: number }[],
): string[] {
  const vooSet = new Set(vooBars.map((b) => b.date));
  return [...new Set(stockBars.map((b) => b.date).filter((d) => vooSet.has(d)))].sort();
}

async function fetchPeriodicTableTickers(db: Awaited<ReturnType<typeof getDb>>): Promise<string[]> {
  const rs = await db.execute({
    sql: `SELECT ticker FROM periodic_table_watchlist WHERE ticker IS NOT NULL AND TRIM(ticker) <> ''`,
    args: [],
  });
  const tickers = (rs.rows as unknown as WatchRow[])
    .map((r) => String((r as any).ticker ?? "").trim())
    .filter((t) => t.length > 0)
    .map((t) => t.toUpperCase());
  return [...new Set(tickers)].sort();
}

async function backfillOneTicker(
  db: Awaited<ReturnType<typeof getDb>>,
  userId: string,
  ticker: string,
  vooBars: { date: string; close: number }[],
  days: number,
): Promise<number> {
  const vooByDate = new Map(vooBars.map((b) => [b.date, b.close]));
  const stockBars = await fetchPriceHistory(ticker, days, null);

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
      ticker,
      holdingId: null, // periodic-table watch tickers are not holdings
      recordedAtYmd: dCur,
      closePrice: s1,
      alphaValue: alpha,
      benchmarkTicker: SIGNAL_BENCHMARK_TICKER,
    });
    written += 1;
  }
  return written;
}

const backfillDays = Math.max(10, Math.min(240, Math.floor(Number(process.env.BACKFILL_DAYS ?? "60") || 60)));
const delayMs = Math.max(0, Math.floor(Number(process.env.BACKFILL_DELAY_MS ?? "250") || 250));

async function main() {
  const userIdArg = process.argv[2];
  const userId = userIdArg && userIdArg.trim().length > 0 ? userIdArg.trim() : defaultProfileUserId();

  if (!isDbConfigured()) {
    console.error("Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN (e.g. .env.local).");
    process.exit(1);
  }

  const db = getDb();

  const tickers = await fetchPeriodicTableTickers(db);
  if (tickers.length === 0) {
    console.log("No tickers in periodic_table_watchlist. Seed it first.");
    process.exit(0);
  }

  console.log(
    `Backfill alpha_history (periodic table): userId=${userId}, tickers=${tickers.length}, days≈${backfillDays}, delay=${delayMs}ms, benchmark=${SIGNAL_BENCHMARK_TICKER}`,
  );

  console.log(`Fetching ${SIGNAL_BENCHMARK_TICKER} history…`);
  const vooBars = await fetchPriceHistory(SIGNAL_BENCHMARK_TICKER, backfillDays, null);
  if (vooBars.length < 2) {
    console.error(`Benchmark ${SIGNAL_BENCHMARK_TICKER} returned insufficient bars (${vooBars.length}). Abort.`);
    process.exit(1);
  }
  console.log(`VOO: ${vooBars.length} daily bars (${vooBars[0]!.date} … ${vooBars[vooBars.length - 1]!.date})`);

  let grand = 0;
  for (let i = 0; i < tickers.length; i++) {
    const tk = tickers[i]!;
    process.stdout.write(`Processing ${tk} (${i + 1}/${tickers.length})… `);
    try {
      const n = await backfillOneTicker(db, userId, tk, vooBars, backfillDays);
      grand += n;
      console.log(`Done (${n} row(s) upserted)`);
    } catch (e) {
      console.log(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (i < tickers.length - 1 && delayMs > 0) await sleep(delayMs);
  }

  console.log(`Finished. Total upserts this run: ${grand}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});