/**
 * `alpha_history` から、日本株ベンチ（1306.T）の日次 α が異常に大きい行を**物理 DELETE** する（チャートの垂直跳躍用）。
 * 汚れた石垣を取り除き、以降の `fix:jp-alpha` / バックフィルで積み直す前提の基礎工事向け。
 *
 * 既定: recorded_at 暦日が 2026-03-25 〜 2026-04-05、ABS(alpha_value) > 10、benchmark_ticker = 1306.T
 * （|α|>20 は未保存のため、チャートの跳ね残りを 10% 台で掃除する想定。env で上書き可）
 *
 * Usage:
 *   npx tsx scripts/clean-jp-alpha-spike-date-range.ts [--dry-run] [--user-id=<id>]
 * Env: JP_SPIKE_FROM_YMD, JP_SPIKE_TO_YMD, JP_SPIKE_BENCHMARK, JP_SPIKE_MIN_ABS
 */
import { config } from "dotenv";

import { getDb, isDbConfigured } from "../src/lib/db";

config({ path: ".env.local" });
config();

const DEFAULT_FROM = "2026-03-25";
const DEFAULT_TO = "2026-04-05";
const DEFAULT_BENCH = "1306.T";
const DEFAULT_MIN_ABS = 10;

function argVal(name: string): string | null {
  const pre = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(pre));
  return hit != null ? hit.slice(pre.length).trim() : null;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const userId = argVal("user-id")?.trim() ?? process.env.JP_SPIKE_CLEAN_USER_ID?.trim();

  const fromYmd = process.env.JP_SPIKE_FROM_YMD?.trim() || DEFAULT_FROM;
  const toYmd = process.env.JP_SPIKE_TO_YMD?.trim() || DEFAULT_TO;
  const benchmark = process.env.JP_SPIKE_BENCHMARK?.trim() || DEFAULT_BENCH;
  const minAbs = (() => {
    const n = Number(process.env.JP_SPIKE_MIN_ABS ?? DEFAULT_MIN_ABS);
    return Number.isFinite(n) && n >= 0 ? n : DEFAULT_MIN_ABS;
  })();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromYmd) || !/^\d{4}-\d{2}-\d{2}$/.test(toYmd) || fromYmd > toYmd) {
    console.error("Invalid from/to YMD (use JP_SPIKE_FROM_YMD / JP_SPIKE_TO_YMD, YYYY-MM-DD).");
    process.exit(1);
  }

  if (!isDbConfigured()) {
    console.error("Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN (e.g. .env.local).");
    process.exit(1);
  }

  const db = getDb();
  const whereUser = userId != null && userId.length > 0 ? " AND user_id = ?" : "";
  const baseArgs: (string | number)[] = [benchmark, fromYmd, toYmd, minAbs];
  if (userId != null && userId.length > 0) baseArgs.push(userId);

  const countSql = `SELECT COUNT(*) AS c FROM alpha_history
    WHERE benchmark_ticker = ?
      AND substr(recorded_at, 1, 10) >= ?
      AND substr(recorded_at, 1, 10) <= ?
      AND abs(alpha_value) > ?${whereUser}`;

  const countRs = await db.execute({ sql: countSql, args: baseArgs });
  const n = Number(countRs.rows[0]?.c ?? 0);

  console.log(
    `[clean-jp-alpha-spike] candidates=${n} (bench=${benchmark} ymd=${fromYmd}..${toYmd} |alpha|>${minAbs}${
      userId ? ` userId=${userId}` : " all users"
    })${dryRun ? " [dry-run]" : ""}`,
  );

  if (dryRun) {
    console.log("[clean-jp-alpha-spike] dry-run: no DELETE executed.");
    process.exit(0);
  }

  if (n === 0) {
    console.log("0件のスパイク行を浄化しました（該当なし）。");
    process.exit(0);
  }

  const deleteSql = `DELETE FROM alpha_history
    WHERE benchmark_ticker = ?
      AND substr(recorded_at, 1, 10) >= ?
      AND substr(recorded_at, 1, 10) <= ?
      AND abs(alpha_value) > ?${whereUser}`;

  await db.execute({ sql: deleteSql, args: baseArgs });
  console.log(`${n}件のスパイク行を浄化しました。`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
