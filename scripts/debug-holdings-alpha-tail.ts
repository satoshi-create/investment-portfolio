/**
 * 保有銘柄の `alpha_history` 末尾を表示（「表示用の最後の日次 Alpha」追跡用）。
 * Usage: npx tsx scripts/debug-holdings-alpha-tail.ts [userId]
 */
import { config } from "dotenv";

import { defaultBenchmarkTickerForTicker } from "../src/lib/alpha-logic";
import { getDb, isDbConfigured } from "../src/lib/db";
import { defaultProfileUserId } from "../src/lib/authorize-signals";
import { fetchHoldingsWithProviderForUser } from "../src/lib/holdings-queries";

config({ path: ".env.local" });
config();

async function main() {
  const userId = (process.argv[2]?.trim() || defaultProfileUserId()) as string;
  if (!isDbConfigured()) {
    console.error("Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN");
    process.exit(1);
  }
  const db = getDb();
  const holdings = await fetchHoldingsWithProviderForUser(db, userId);
  if (holdings.length === 0) {
    console.log("No holdings");
    return;
  }
  for (const h of holdings) {
    const bench = defaultBenchmarkTickerForTicker(h.ticker);
    const rs = await db.execute({
      sql: `SELECT substr(recorded_at,1,10) AS ymd, alpha_value, benchmark_ticker
            FROM alpha_history
            WHERE user_id = ? AND ticker = ? AND benchmark_ticker = ?
            ORDER BY recorded_at DESC
            LIMIT 5`,
      args: [userId, h.ticker, bench],
    });
    const tail = rs.rows.map((r) => `${r.ymd} α=${r.alpha_value} bench=${r.benchmark_ticker}`).join(" | ");
    const last = rs.rows[0];
    console.log(
      `${h.ticker} (bench=${bench})  latestYmd=${last != null ? String(last.ymd) : "—"}  lastAlpha=${last != null ? String(last.alpha_value) : "—"}`,
    );
    console.log(`  tail5: ${tail || "(no rows)"}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
