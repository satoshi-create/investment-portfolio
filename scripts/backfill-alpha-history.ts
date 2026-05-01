/**
 * Backfill `alpha_history` for all holdings (VOO benchmark) using Yahoo + alpha-logic.
 * Usage: npm run backfill:alpha [-- <userId>]
 * Env: NEXT_PUBLIC_DEFAULT_PROFILE_USER_ID, BACKFILL_DAYS (default 30), BACKFILL_DELAY_MS (default 1000)
 */
import { config } from "dotenv";

import { defaultProfileUserId } from "../src/lib/authorize-signals";
import { backfillAlphaHistoryForTicker } from "../src/lib/alpha-history-reconcile";
import { defaultBenchmarkTickerForTicker, SIGNAL_BENCHMARK_TICKER } from "../src/lib/alpha-logic";
import { getDb, isDbConfigured } from "../src/lib/db";
import { generateSignalsForUser } from "../src/lib/generate-signals";
import { runEcosystemCompoundingIgnitionBackfill } from "../src/lib/ecosystem-compounding-backfill";
import { fetchHoldingsWithProviderForUser } from "../src/lib/holdings-queries";
import type { PriceBar } from "../src/lib/price-service";
import { fetchPriceHistory } from "../src/lib/price-service";
import type { Holding } from "../src/types/investment";

config({ path: ".env.local" });
config();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function backfillOneHolding(
  db: Awaited<ReturnType<typeof getDb>>,
  userId: string,
  holding: Holding,
  benchBars: PriceBar[],
  benchmarkTicker: string,
  days: number,
): Promise<number> {
  return backfillAlphaHistoryForTicker(
    db,
    userId,
    { ticker: holding.ticker, providerSymbol: holding.providerSymbol, holdingId: holding.id },
    benchBars,
    benchmarkTicker,
    days,
  );
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
    `Backfill alpha_history: userId=${userId}, days≈${backfillDays} bars/holding, delay=${delayMs}ms, defaultBenchmarkFallback=${SIGNAL_BENCHMARK_TICKER}`,
  );

  const benchBarsCache = new Map<string, PriceBar[]>();

  const total = holdings.length;
  let grandTotalRows = 0;

  for (let i = 0; i < holdings.length; i++) {
    const h = holdings[i]!;
    const label = `${h.ticker}${h.providerSymbol ? ` [${h.providerSymbol}]` : ""}`;
    process.stdout.write(`Processing ${label} (${i + 1}/${total})… `);
    try {
      const benchmarkTicker = defaultBenchmarkTickerForTicker(h.ticker);
      let benchBars = benchBarsCache.get(benchmarkTicker) ?? null;
      if (!benchBars) {
        process.stdout.write(`(fetch ${benchmarkTicker}) `);
        benchBars = await fetchPriceHistory(benchmarkTicker, backfillDays, null, { forAlpha: true });
        benchBarsCache.set(benchmarkTicker, benchBars);
      }
      if (benchBars.length < 2) {
        console.log(`Skip (benchmark ${benchmarkTicker} insufficient bars: ${benchBars.length})`);
      } else {
        const n = await backfillOneHolding(db, userId, h, benchBars, benchmarkTicker, backfillDays);
        grandTotalRows += n;
        console.log(`Done (${n} row(s) upserted, benchmark=${benchmarkTicker})`);
      }
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

  if (process.argv.includes("--ecosystem-ignition")) {
    console.log("Running ecosystem compounding ignition backfill (--ecosystem-ignition)…");
    const eco = await runEcosystemCompoundingIgnitionBackfill(db, userId);
    console.log(`Ecosystem ignition: processed=${eco.processed} ignited=${eco.ignitedCount}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
