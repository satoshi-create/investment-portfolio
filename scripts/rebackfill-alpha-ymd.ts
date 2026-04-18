/**
 * Force recompute + upsert `alpha_history` for each holding on a single calendar end-date (e.g. after cleaning bad rows).
 * Uses Yahoo prices; rows that still compute to |alpha| > ALPHA_HISTORY_PERSIST_ABS_MAX are skipped by upsert (see db-operations).
 *
 * Usage:
 *   npx tsx scripts/rebackfill-alpha-ymd.ts <YYYY-MM-DD> [userId]
 *
 * Env: BACKFILL_DAYS window for price fetch (default 120, clamped 5–120).
 */
import { config } from "dotenv";

import { defaultProfileUserId } from "../src/lib/authorize-signals";
import { reconcileAlphaHistoryForUser } from "../src/lib/alpha-history-reconcile";
import { getDb, isDbConfigured } from "../src/lib/db";

config({ path: ".env.local" });
config();

async function main() {
  const ymd = process.argv[2]?.trim();
  const userId =
    process.argv[3] != null && process.argv[3]!.trim().length > 0
      ? process.argv[3]!.trim()
      : defaultProfileUserId();

  if (ymd == null || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    console.error("Usage: npx tsx scripts/rebackfill-alpha-ymd.ts <YYYY-MM-DD> [userId]");
    process.exit(1);
  }

  if (!isDbConfigured()) {
    console.error("Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN (e.g. .env.local).");
    process.exit(1);
  }

  const db = getDb();
  const days = Math.max(5, Math.min(120, Math.floor(Number(process.env.BACKFILL_DAYS ?? "120") || 120)));

  console.log(`[rebackfill-alpha-ymd] userId=${userId} forceYmd=${ymd} days=${days}`);

  const r = await reconcileAlphaHistoryForUser(userId, db, { forceRebackfillYmd: ymd, days });
  console.log("[rebackfill-alpha-ymd] reconcileAlphaHistoryForUser done:", r);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
