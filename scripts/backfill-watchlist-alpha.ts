/**
 * Backfill alpha_history for watchlist tickers (theme ecosystem members, etc).
 *
 * Safe-by-default:
 * - uses defaultBenchmarkTickerForTicker(ticker) for DB reads/writes
 * - supports dry-run mode
 * - optional cleanup: delete duplicated JP VOO rows when 1306.T exists on same day
 *
 * Usage examples:
 *   npx tsx scripts/backfill-watchlist-alpha.ts --tickers 3994,4478,4443
 *   npx tsx scripts/backfill-watchlist-alpha.ts --tickers-file scripts/tickers-saas.txt --days 120 --delay-ms 500
 *   npx tsx scripts/backfill-watchlist-alpha.ts --tickers 2782,3002 --cleanup --dry-run
 */

import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

import { defaultBenchmarkTickerForTicker } from "../src/lib/alpha-logic";
import { reconcileAlphaHistoryForWatchlistTickers } from "../src/lib/alpha-history-reconcile";
import { defaultProfileUserId } from "../src/lib/authorize-signals";
import { getDb, isDbConfigured } from "../src/lib/db";

type Args = {
  userId: string;
  tickers: string[];
  days: number;
  delayMs: number;
  maxTickers: number;
  dryRun: boolean;
  cleanup: boolean;
};

function parseArgValue(argv: string[], key: string): string | null {
  const idx = argv.indexOf(key);
  if (idx === -1) return null;
  return argv[idx + 1] ?? null;
}

function hasFlag(argv: string[], flag: string): boolean {
  return argv.includes(flag);
}

function parseTickers(raw: string): string[] {
  return raw
    .split(/[,\s]+/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function readTickersFile(filePath: string): string[] {
  const abs = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  const text = fs.readFileSync(abs, "utf-8");
  return text
    .split(/\r?\n/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("#"));
}

function uniq(xs: string[]): string[] {
  return [...new Set(xs)];
}

function toInt(raw: string | null, fallback: number): number {
  const n = raw != null ? Number(raw) : Number.NaN;
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function buildArgs(argv: string[]): Args {
  const userId = (parseArgValue(argv, "--user-id") ?? "").trim() || defaultProfileUserId();

  const tickersInline = parseArgValue(argv, "--tickers");
  const tickersFile = parseArgValue(argv, "--tickers-file");

  const tickers =
    tickersFile != null && tickersFile.trim().length > 0
      ? readTickersFile(tickersFile.trim())
      : tickersInline != null && tickersInline.trim().length > 0
        ? parseTickers(tickersInline.trim())
        : [];

  const days = Math.max(15, Math.min(200, toInt(parseArgValue(argv, "--days"), 120)));
  const delayMs = Math.max(0, Math.min(10_000, toInt(parseArgValue(argv, "--delay-ms"), 500)));
  const maxTickers = Math.max(1, Math.min(200, toInt(parseArgValue(argv, "--max"), 48)));

  const dryRun = hasFlag(argv, "--dry-run");
  const cleanup = hasFlag(argv, "--cleanup");

  return {
    userId,
    tickers: uniq(tickers),
    days,
    delayMs,
    maxTickers,
    dryRun,
    cleanup,
  };
}

async function cleanupDuplicatedVooRowsForJpTickers(
  db: ReturnType<typeof getDb>,
  userId: string,
  tickers: string[],
): Promise<void> {
  const jpTickers = tickers.filter((t) => defaultBenchmarkTickerForTicker(t) === "1306.T");
  if (jpTickers.length === 0) {
    console.log("[cleanup] JP tickers none; skip.");
    return;
  }

  const placeholders = jpTickers.map(() => "?").join(",");

  const countRs = await db.execute({
    sql: `SELECT COUNT(*) AS c
          FROM alpha_history h
          WHERE h.user_id = ?
            AND h.ticker IN (${placeholders})
            AND h.benchmark_ticker = 'VOO'
            AND EXISTS (
              SELECT 1 FROM alpha_history h2
              WHERE h2.user_id = h.user_id
                AND h2.ticker = h.ticker
                AND substr(h2.recorded_at,1,10) = substr(h.recorded_at,1,10)
                AND h2.benchmark_ticker = '1306.T'
            )`,
    args: [userId, ...jpTickers],
  });

  const n = Number(countRs.rows[0]?.c ?? 0);
  console.log(`[cleanup] delete candidates (duplicated VOO rows): ${n}`);
  if (n <= 0) return;

  // Delete only when 1306.T exists on the same calendar day (safe cleanup).
  await db.execute({
    sql: `DELETE FROM alpha_history
          WHERE user_id = ?
            AND ticker IN (${placeholders})
            AND benchmark_ticker = 'VOO'
            AND EXISTS (
              SELECT 1 FROM alpha_history h2
              WHERE h2.user_id = alpha_history.user_id
                AND h2.ticker = alpha_history.ticker
                AND substr(h2.recorded_at,1,10) = substr(alpha_history.recorded_at,1,10)
                AND h2.benchmark_ticker = '1306.T'
            )`,
    args: [userId, ...jpTickers],
  });

  console.log("[cleanup] delete executed.");
}

async function main() {
  dotenv.config({ path: ".env.local" });
  dotenv.config();

  const args = buildArgs(process.argv.slice(2));

  if (!isDbConfigured()) {
    throw new Error("Database not configured (set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN).");
  }

  if (args.tickers.length === 0) {
    console.log("No tickers provided. Use --tickers or --tickers-file.");
    process.exit(1);
  }

  const tickers = args.tickers.slice(0, args.maxTickers);
  const db = getDb();

  console.log(
    `[watchlist-backfill] userId=${args.userId} tickers=${tickers.length}/${args.tickers.length} days=${args.days} delayMs=${args.delayMs} dryRun=${args.dryRun} cleanup=${args.cleanup}`,
  );

  const benchMap = new Map<string, string[]>();
  for (const t of tickers) {
    const b = defaultBenchmarkTickerForTicker(t);
    benchMap.set(b, [...(benchMap.get(b) ?? []), t]);
  }
  for (const [b, ts] of benchMap) {
    console.log(`[watchlist-backfill] bench=${b} tickers=${ts.join(",")}`);
  }

  if (args.cleanup) {
    if (args.dryRun) {
      console.log("[cleanup] dry-run: would cleanup duplicated JP VOO rows (when 1306.T exists).");
    } else {
      await cleanupDuplicatedVooRowsForJpTickers(db, args.userId, tickers);
    }
  }

  if (args.dryRun) {
    console.log("[backfill] dry-run: skip reconcileAlphaHistoryForWatchlistTickers execution.");
    return;
  }

  const targets = tickers.map((t) => ({ ticker: t, providerSymbol: null as string | null }));
  const result = await reconcileAlphaHistoryForWatchlistTickers(db, args.userId, targets, {
    days: args.days,
    delayMs: args.delayMs,
    maxTickers: args.maxTickers,
  });

  console.log("[backfill] finished:", result);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});

