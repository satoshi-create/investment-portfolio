/**
 * Backfill `alpha_history` for all holdings (VOO benchmark) using Yahoo + alpha-logic.
 * Usage: npm run backfill:alpha [-- <userId>]
 * Env: NEXT_PUBLIC_DEFAULT_PROFILE_USER_ID, BACKFILL_DAYS (default 30), BACKFILL_DELAY_MS (default 1000)
 */
import { config } from "dotenv";

import { defaultProfileUserId } from "../src/lib/authorize-signals";
import { computeAlphaPercent, dailyReturnPercent, SIGNAL_BENCHMARK_TICKER } from "../src/lib/alpha-logic";
import { upsertAlphaHistoryRow } from "../src/lib/db-operations";
import { getDb, isDbConfigured } from "../src/lib/db";
import { generateSignalsForUser } from "../src/lib/generate-signals";
import { fetchHoldingsWithProviderForUser } from "../src/lib/holdings-queries";
import type { PriceBar } from "../src/lib/price-service";
import { fetchPriceHistory } from "../src/lib/price-service";
import type { Holding } from "../src/types/investment";

config({ path: ".env.local" });
config();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function sharedSortedDates(stockBars: PriceBar[], vooBars: PriceBar[]): string[] {
  const vooSet = new Set(vooBars.map((b) => b.date));
  return [...new Set(stockBars.map((b) => b.date).filter((d) => vooSet.has(d)))].sort();
}

async function backfillOneHolding(
  db: Awaited<ReturnType<typeof getDb>>,
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

const backfillDays = Math.max(5, Math.min(120, Math.floor(Number(process.env.BACKFILL_DAYS ?? "30") || 30)));
const delayMs = Math.max(0, Math.floor(Number(process.env.BACKFILL_DELAY_MS ?? "1000") || 1000));

async function main() {
  const userIdArg = process.argv[2];
  const userId =
    userIdArg && userIdArg.trim().length > 0 ? userIdArg.trim() : defaultProfileUserId();

  if (!isDbConfigured()) {
    console.error("Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN (e.g. .env.local).");
    process.exit(1);
  }

  const db = getDb();
  const holdings = await fetchHoldingsWithProviderForUser(db, userId);
  if (holdings.length === 0) {
    console.log(`No holdings for userId=${userId}`);
    process.exit(0);
  }

  console.log(
    `Backfill alpha_history: userId=${userId}, days≈${backfillDays} bars/holding, delay=${delayMs}ms, benchmark=${SIGNAL_BENCHMARK_TICKER}`,
  );

  console.log(`Fetching ${SIGNAL_BENCHMARK_TICKER} history…`);
  const vooBars = await fetchPriceHistory(SIGNAL_BENCHMARK_TICKER, backfillDays, null);
  if (vooBars.length < 2) {
    console.error(`Benchmark ${SIGNAL_BENCHMARK_TICKER} returned insufficient bars (${vooBars.length}). Abort.`);
    process.exit(1);
  }
  console.log(`VOO: ${vooBars.length} daily bars (${vooBars[0]!.date} … ${vooBars[vooBars.length - 1]!.date})`);

  const total = holdings.length;
  let grandTotalRows = 0;

  for (let i = 0; i < holdings.length; i++) {
    const h = holdings[i]!;
    const label = `${h.ticker}${h.providerSymbol ? ` [${h.providerSymbol}]` : ""}`;
    process.stdout.write(`Processing ${label} (${i + 1}/${total})… `);
    try {
      const n = await backfillOneHolding(db, userId, h, vooBars, backfillDays);
      grandTotalRows += n;
      console.log(`Done (${n} row(s) upserted)`);
    } catch (e) {
      console.log(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (i < holdings.length - 1 && delayMs > 0) await sleep(delayMs);
  }

  console.log(`Finished. Total upserts this run: ${grandTotalRows}`);

  console.log("Running generateSignalsForUser for smoke test…");
  const sig = await generateSignalsForUser(userId, db);
  console.log(
    `Signals: inserted=${sig.inserted}`,
    sig.details.length ? sig.details : "",
    `reconcile rows=${sig.reconcile.rowsBackfilled}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
