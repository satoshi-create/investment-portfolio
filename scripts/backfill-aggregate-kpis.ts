/**
 * Recompute `portfolio_aggregate_kpis` for every distinct `snapshot_date` (as_of) per user.
 * Idempotent: same as post-snapshot `updateAggregateKPIs` (30d window).
 *
 * Usage: npx tsx scripts/backfill-aggregate-kpis.ts [userId]
 * Env: TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, optional .env.local
 */
import { config } from "dotenv";

import { defaultProfileUserId } from "../src/lib/authorize-signals";
import { getDb, isDbConfigured } from "../src/lib/db";
import {
  DEFAULT_AGGREGATE_KPI_WINDOW_DAYS,
  backfillAggregateKPIForAsOf,
  listDistinctSnapshotAsOfDates,
} from "../src/lib/portfolio-aggregate-kpis";

config({ path: ".env.local" });
config();

async function main() {
  const userIdArg = process.argv[2];
  const userId = userIdArg && userIdArg.trim().length > 0 ? userIdArg.trim() : defaultProfileUserId();

  if (!isDbConfigured()) {
    console.error("Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN (e.g. .env.local).");
    process.exit(1);
  }

  const db = getDb();
  let dates: string[];
  try {
    dates = await listDistinctSnapshotAsOfDates(db, userId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.toLowerCase().includes("no such table")) {
      console.error("Apply migrations/044_portfolio_aggregate_kpis.sql and ensure portfolio_daily_snapshots exists.");
    }
    throw e;
  }

  console.log(`[backfill-aggregate-kpis] user=${userId} as_of dates=${dates.length} window=${DEFAULT_AGGREGATE_KPI_WINDOW_DAYS}d`);
  for (const d of dates) {
    await backfillAggregateKPIForAsOf(db, userId, d, DEFAULT_AGGREGATE_KPI_WINDOW_DAYS);
    process.stdout.write(".");
  }
  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
