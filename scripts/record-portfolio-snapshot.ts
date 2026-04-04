/**
 * Record one portfolio_daily_snapshots row (UTC calendar day). For cron / CI.
 * Usage: npm run snapshot:daily [-- <userId>]
 * Env: TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, optional DEFAULT_PROFILE_USER_ID
 */
import { config } from "dotenv";

import { defaultProfileUserId } from "../src/lib/authorize-signals";
import { getDb, isDbConfigured } from "../src/lib/db";
import { recordPortfolioDailySnapshot } from "../src/lib/portfolio-snapshots";

config({ path: ".env.local" });
config();

async function main() {
  const userIdArg = process.argv[2];
  const userId =
    userIdArg && userIdArg.trim().length > 0
      ? userIdArg.trim()
      : process.env.DEFAULT_PROFILE_USER_ID?.trim() || defaultProfileUserId();

  if (!isDbConfigured()) {
    console.error("Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN (e.g. .env.local).");
    process.exit(1);
  }

  const db = getDb();
  const out = await recordPortfolioDailySnapshot(db, userId);
  console.log(
    `portfolio_daily_snapshots: user=${userId} date=${out.snapshotDate} totalJpy=${out.totalMarketValueJpy} replaced=${out.replacedExistingRow}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
