/**
 * 日本株ベンチマーク（1306.T）向け `alpha_history` の再計算（Yahoo 調整後終値＋日付 merge＋スパイク impute 済みの `backfillAlphaHistoryForTicker`）。
 * DB に残った異常日次 Alpha を上書きで整える。ネットワーク負荷があるため遅延を挟む。
 *
 * Usage:
 *   npx tsx scripts/fix-jp-alpha-spikes.ts [--dry-run] [--user-id=<id>] [--days=150] [--max-tickers=200] [--delay-ms=500]
 */
import { config } from "dotenv";

import { reconcileAlphaHistoryForWatchlistTickers, type AlphaWatchTarget } from "../src/lib/alpha-history-reconcile";
import { getDb, isDbConfigured } from "../src/lib/db";
import { THEME_STRUCTURAL_TREND_LOOKBACK_DAYS } from "../src/lib/alpha-logic";

config({ path: ".env.local" });
config();

const BENCH = "1306.T";

function argVal(name: string): string | null {
  const pre = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(pre));
  return hit != null ? hit.slice(pre.length).trim() : null;
}

function toInt(s: string | null, fallback: number): number {
  if (s == null || s.length === 0) return fallback;
  const n = Number(s);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function uniqSorted(xs: string[]): string[] {
  return [...new Set(xs)].sort();
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const userIdFilter = argVal("user-id")?.trim();
  const days = Math.max(
    15,
    Math.min(200, toInt(argVal("days") ?? null, THEME_STRUCTURAL_TREND_LOOKBACK_DAYS + 60)),
  );
  const maxTickers = Math.max(1, Math.min(500, toInt(argVal("max-tickers") ?? null, 200)));
  const delayMs = Math.max(0, Math.min(10_000, toInt(argVal("delay-ms") ?? null, 500)));

  if (!isDbConfigured()) {
    console.error("Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN (e.g. .env.local).");
    process.exit(1);
  }

  const db = getDb();

  const whereUser = userIdFilter != null && userIdFilter.length > 0 ? " AND user_id = ?" : "";
  const listArgs: string[] = [];
  if (userIdFilter != null && userIdFilter.length > 0) listArgs.push(userIdFilter);

  const listRs = await db.execute({
    sql: `SELECT DISTINCT user_id, ticker
          FROM alpha_history
          WHERE benchmark_ticker = ?${whereUser}`,
    args: [BENCH, ...listArgs],
  });

  const byUser = new Map<string, string[]>();
  for (const row of listRs.rows) {
    const r = row as { user_id?: unknown; ticker?: unknown };
    const u = String(r.user_id ?? "").trim();
    const t = String(r.ticker ?? "").trim();
    if (u.length === 0 || t.length === 0) continue;
    if (!byUser.has(u)) byUser.set(u, []);
    byUser.get(u)!.push(t);
  }
  for (const [u, tickers] of byUser) {
    byUser.set(u, uniqSorted(tickers));
  }

  if (byUser.size === 0) {
    console.log(`[fix-jp-alpha-spikes] no rows with benchmark_ticker=${BENCH}. Nothing to do.`);
    return;
  }

  console.log(
    `[fix-jp-alpha-spikes] users=${byUser.size} benchmark=${BENCH} days=${days} maxTickers=${maxTickers} delayMs=${delayMs} dryRun=${dryRun}` +
      (userIdFilter ? ` userId=${userIdFilter}` : ""),
  );

  for (const [userId, tickers] of byUser) {
    const capped = tickers.slice(0, maxTickers);
    if (capped.length < tickers.length) {
      console.log(`[fix-jp-alpha-spikes] userId=${userId} tickers truncated: ${capped.length}/${tickers.length}`);
    }

    const provRs = await db.execute({
      sql: `SELECT ticker, provider_symbol FROM holdings WHERE user_id = ?`,
      args: [userId],
    });
    const provBy = new Map<string, string | null>();
    for (const row of provRs.rows) {
      const r = row as { ticker?: unknown; provider_symbol?: unknown };
      const t = String(r.ticker ?? "").trim();
      if (t.length === 0) continue;
      const ps = r.provider_symbol;
      const sym = ps != null && String(ps).trim().length > 0 ? String(ps).trim() : null;
      provBy.set(t.toUpperCase(), sym);
    }

    const targets: AlphaWatchTarget[] = capped.map((t) => ({
      ticker: t,
      providerSymbol: provBy.get(t.toUpperCase()) ?? null,
    }));

    console.log(
      `[fix-jp-alpha-spikes] userId=${userId} recompute ${targets.length} ticker(s): ${capped.join(", ")}`,
    );

    if (dryRun) {
      console.log(`[fix-jp-alpha-spikes] dry-run: would reconcileAlphaHistoryForWatchlistTickers (force full)`);
      continue;
    }

    const result = await reconcileAlphaHistoryForWatchlistTickers(db, userId, targets, {
      days,
      delayMs,
      maxTickers,
      forceFullRebackfill: true,
    });
    console.log(`[fix-jp-alpha-spikes] userId=${userId} done:`, result);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
