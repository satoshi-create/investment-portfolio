/**
 * One-off: set holdings.provider_symbol from CLI (requires .env.local with Turso).
 * Usage: npx tsx scripts/set-provider-symbol.ts <holding-id> <yahoo-symbol>
 * Example: npx tsx scripts/set-provider-symbol.ts hold-fang "06311181.T"
 */
import { config } from "dotenv";

import { getDb, isDbConfigured } from "../src/lib/db";

config({ path: ".env.local" });
config();

async function main() {
  const [, , holdingId, yahooSymbol] = process.argv;
  if (!holdingId || !yahooSymbol) {
    console.error("Usage: npx tsx scripts/set-provider-symbol.ts <holding-id> <yahoo-symbol>");
    process.exit(1);
  }
  if (!isDbConfigured()) {
    console.error("Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.");
    process.exit(1);
  }
  const db = getDb();
  await db.execute({
    sql: `UPDATE holdings SET provider_symbol = ? WHERE id = ?`,
    args: [yahooSymbol, holdingId],
  });
  console.log(`Updated holdings.provider_symbol for id=${holdingId} → ${yahooSymbol}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
