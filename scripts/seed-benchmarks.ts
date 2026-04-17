/**
 * Applies `seed/benchmarks.sql` intent via parameterized INSERT (requires .env.local / Turso).
 * Run: npm run seed:benchmarks
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
  const db = getDb();
  await db.execute({
    sql: `INSERT OR IGNORE INTO benchmarks (ticker, name) VALUES (?, ?)`,
    args: ["VOO", "Vanguard S&P 500 ETF"],
  });
  console.log("Benchmark seed OK: VOO");

  await db.execute({
    sql: `INSERT OR IGNORE INTO benchmarks (ticker, name) VALUES (?, ?)`,
    args: ["1306.T", "TOPIX ETF (1306.T)"],
  });
  console.log("Benchmark seed OK: 1306.T");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
