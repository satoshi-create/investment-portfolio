/**
 * Adds IPO observation columns to `theme_ecosystem_members`.
 * Run: npx tsx scripts/migrate-theme-ecosystem-unlisted.ts
 */
import { config } from "dotenv";

import { getDb, isDbConfigured } from "../src/lib/db";

config({ path: ".env.local" });
config();

async function addColumn(sql: string) {
  const db = getDb();
  try {
    await db.execute({ sql });
    return { ok: true as const, skipped: false as const };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Turso/libSQL wraps sqlite errors; column exists shows up as "duplicate column name"
    if (msg.toLowerCase().includes("duplicate column") || msg.toLowerCase().includes("already exists")) {
      return { ok: true as const, skipped: true as const };
    }
    // Table missing (older setups)
    if (msg.toLowerCase().includes("no such table") && msg.toLowerCase().includes("theme_ecosystem_members")) {
      throw new Error("theme_ecosystem_members table missing. Create it first, then re-run migration.");
    }
    throw e;
  }
}

async function main() {
  if (!isDbConfigured()) {
    console.error("Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN (e.g. .env.local).");
    process.exit(1);
  }

  const ops = [
    `ALTER TABLE theme_ecosystem_members ADD COLUMN is_unlisted INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE theme_ecosystem_members ADD COLUMN proxy_ticker TEXT`,
    `ALTER TABLE theme_ecosystem_members ADD COLUMN estimated_ipo_date TEXT`,
    `ALTER TABLE theme_ecosystem_members ADD COLUMN estimated_valuation TEXT`,
    `ALTER TABLE theme_ecosystem_members ADD COLUMN observation_notes TEXT`,
  ];

  for (const s of ops) {
    const r = await addColumn(s);
    console.log(`${r.skipped ? "SKIP" : "OK  "} ${s}`);
  }

  console.log("Migration complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

