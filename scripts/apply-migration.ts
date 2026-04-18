import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";

import { getDb, isDbConfigured } from "@/src/lib/db";

function resolveSqlPath(): string {
  const arg = process.argv.slice(2).find((a) => !a.startsWith("--"));
  if (!arg) {
    throw new Error("Usage: tsx scripts/apply-migration.ts <path-to-sql>");
  }
  return path.isAbsolute(arg) ? arg : path.join(process.cwd(), arg);
}

function splitSqlStatements(sql: string): string[] {
  // Minimal splitter: drop comment-only lines, split by ';' (no support for ';' inside strings).
  const cleaned = sql
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("--"))
    .join("\n");
  return cleaned
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function main() {
  dotenv.config({ path: path.join(process.cwd(), ".env.local") });

  if (!isDbConfigured()) {
    throw new Error("Database not configured (set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN)");
  }

  const sqlPath = resolveSqlPath();
  const raw = fs.readFileSync(sqlPath, "utf-8");
  const statements = splitSqlStatements(raw);
  if (statements.length === 0) {
    console.log("No SQL statements.");
    return;
  }

  const db = getDb();
  for (const st of statements) {
    await db.execute({ sql: st, args: [] });
  }

  console.log(`Applied ${statements.length} statements from ${path.relative(process.cwd(), sqlPath)}.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});

