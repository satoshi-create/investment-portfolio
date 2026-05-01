/**
 * Backfill theme_ecosystem_members.is_compounding_ignited (close-only baseline).
 * Usage: npm run backfill:ecosystem-ignition [-- <userId>] [--limit N]
 * Env: .env.local with DB credentials (same as other scripts).
 */
import { config } from "dotenv";

import { defaultProfileUserId } from "../src/lib/authorize-signals";
import { runEcosystemCompoundingIgnitionBackfill } from "../src/lib/ecosystem-compounding-backfill";
import { getDb, isDbConfigured } from "../src/lib/db";

config({ path: ".env.local" });
config();

function parseArgs(argv: string[]): { userId: string; limit: number | undefined } {
  const rest = argv.slice(2);
  let limit: number | undefined;
  const loose: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (a === "--limit" || a === "-l") {
      const n = Number(rest[i + 1]);
      i += 1;
      if (Number.isFinite(n)) limit = Math.floor(n);
      continue;
    }
    loose.push(a);
  }
  const userId =
    loose[0] && loose[0]!.trim().length > 0 ? loose[0]!.trim() : defaultProfileUserId();
  return { userId, limit };
}

async function main() {
  const { userId, limit } = parseArgs(process.argv);

  if (!isDbConfigured()) {
    console.error("Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN (e.g. .env.local).");
    process.exit(1);
  }

  const db = getDb();
  console.log(`Backfill is_compounding_ignited: userId=${userId}${limit != null ? ` limit=${limit}` : ""}`);
  const out = await runEcosystemCompoundingIgnitionBackfill(db, userId, { memberLimit: limit });
  console.log(`Done. processed=${out.processed} ignited=${out.ignitedCount}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
