/**
 * Yahoo プロキシからナフサ相当のスポットを 1 行 `commodity_prices` に記録（ cron / 手動）。
 * Usage: npx tsx scripts/ingest-naphtha-price.ts
 * Env: TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, optional NAPHTHA_YAHOO_SYMBOL (default CL=F)
 */
import { randomUUID } from "node:crypto";
import { config } from "dotenv";

import { getDb, isDbConfigured } from "../src/lib/db";
import { fetchLatestPrice } from "../src/lib/price-service";

config({ path: ".env.local" });
config();

const SYMBOL = "NAPHTHA";

async function main() {
  if (!isDbConfigured()) {
    console.error("Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.");
    process.exit(1);
  }
  const yahoo = process.env.NAPHTHA_YAHOO_SYMBOL?.trim() || "CL=F";
  const snap = await fetchLatestPrice(yahoo, null);
  if (snap == null) {
    console.error("[ingest-naphtha] Yahoo fetch failed — leaving DB unchanged");
    process.exit(1);
  }
  const db = getDb();
  const id = randomUUID();
  await db.execute({
    sql: `INSERT INTO commodity_prices (id, symbol, price, timestamp, source_url) VALUES (?, ?, ?, ?, ?)`,
    args: [id, SYMBOL, snap.close, snap.date, `yahoo:${yahoo}:${snap.date.slice(0, 10)}`],
  });
  console.log(`commodity_prices: ${SYMBOL} price=${snap.close} ts=${snap.date} proxy=${yahoo}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
