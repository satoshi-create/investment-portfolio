/**
 * Surgically DELETE extreme `alpha_history` rows (1306.T / 2026-03-30 spike).
 *
 * Usage:
 *   npx tsx scripts/clean-alpha-history-extreme-rows.ts [--dry-run] [--user-id=<id>]
 *
 * Default predicate matches the incident: recorded date 2026-03-30, benchmark 1306.T, alpha_value > 20.
 * Override with env: CLEAN_ALPHA_YMD, CLEAN_ALPHA_BENCHMARK, CLEAN_ALPHA_MIN_ABS (exclusive floor for deletion).
 */
import { config } from "dotenv";

import { getDb, isDbConfigured } from "../src/lib/db";

config({ path: ".env.local" });
config();

const DEFAULT_YMD = "2026-03-30";
const DEFAULT_BENCHMARK = "1306.T";
const DEFAULT_MIN_ALPHA = 20;

function argVal(name: string): string | null {
  const pre = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(pre));
  return hit != null ? hit.slice(pre.length).trim() : null;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const userId = argVal("user-id")?.trim() ?? process.env.CLEAN_ALPHA_USER_ID?.trim();
  const ymd = process.env.CLEAN_ALPHA_YMD?.trim() || DEFAULT_YMD;
  const benchmark = process.env.CLEAN_ALPHA_BENCHMARK?.trim() || DEFAULT_BENCHMARK;
  const minAlpha = Math.max(
    0,
    Number.isFinite(Number(process.env.CLEAN_ALPHA_MIN_ABS))
      ? Number(process.env.CLEAN_ALPHA_MIN_ABS)
      : DEFAULT_MIN_ALPHA,
  );

  if (!isDbConfigured()) {
    console.error("Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN (e.g. .env.local).");
    process.exit(1);
  }

  const db = getDb();

  const whereUser = userId != null && userId.length > 0 ? " AND user_id = ?" : "";
  const args: (string | number)[] = [ymd, benchmark, minAlpha];
  if (userId != null && userId.length > 0) args.push(userId);

  const countSql = `SELECT COUNT(*) AS c FROM alpha_history
    WHERE substr(recorded_at, 1, 10) = ?
      AND benchmark_ticker = ?
      AND alpha_value > ?${whereUser}`;

  const countRs = await db.execute({ sql: countSql, args });
  const n = Number(countRs.rows[0]?.c ?? 0);
  console.log(
    `[clean-alpha-history] matching rows=${n} (ymd=${ymd} benchmark=${benchmark} alpha_value>${minAlpha}${userId ? ` userId=${userId}` : " all users"})`,
  );

  if (dryRun) {
    console.log("[clean-alpha-history] dry-run: no DELETE executed.");
    process.exit(0);
  }

  if (n === 0) {
    console.log("[clean-alpha-history] nothing to delete.");
    process.exit(0);
  }

  const deleteSql = `DELETE FROM alpha_history
    WHERE substr(recorded_at, 1, 10) = ?
      AND benchmark_ticker = ?
      AND alpha_value > ?${whereUser}`;

  await db.execute({ sql: deleteSql, args });
  console.log(`[clean-alpha-history] deleted ${n} row(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
