/**
 * Adds `benchmark_change_pct` to `portfolio_daily_snapshots`.
 * Run: npx tsx scripts/migrate-portfolio-benchmark-change-pct.ts
 */
import { config } from "dotenv";

import { getDb, isDbConfigured } from "../src/lib/db";

config({ path: ".env.local" });
config();

async function main() {
  if (!isDbConfigured()) {
    console.error("Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN (e.g. .env.local).");
    process.exit(1);
  }

  const sql = `ALTER TABLE portfolio_daily_snapshots ADD COLUMN benchmark_change_pct REAL`;
  try {
    await getDb().execute({ sql });
    console.log("OK   ", sql);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.toLowerCase().includes("duplicate column") || msg.toLowerCase().includes("already exists")) {
      console.log("SKIP ", sql, "(column already present)");
      return;
    }
    throw e;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
