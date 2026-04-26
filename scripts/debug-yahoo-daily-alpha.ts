/**
 * Yahoo 経由の日次 α（`fetchRecentDatedDailyAlphasVsBenchmark`）をそのまま表示し、
 * 累積 α（`calculateCumulativeAlpha`）の末尾と比較する。DB は使わない。
 *
 * Usage:
 *   npx tsx scripts/debug-yahoo-daily-alpha.ts [ticker] [benchmarkTicker]
 *   npm run debug:yahoo-alpha -- 6701
 *   npm run debug:yahoo-alpha -- 6701 1306.T
 */
import {
  calculateCumulativeAlpha,
  CUMULATIVE_ALPHA_DISPLAY_ANCHOR_YMD,
  defaultBenchmarkTickerForTicker,
} from "../src/lib/alpha-logic";
import { fetchRecentDatedDailyAlphasVsBenchmark } from "../src/lib/price-service";

const TAIL = 25;

function main() {
  const rawTicker = process.argv[2]?.trim() || "6701";
  const rawBench = process.argv[3]?.trim();
  const bench = rawBench && rawBench.length > 0 ? rawBench : defaultBenchmarkTickerForTicker(rawTicker);

  return run(rawTicker, bench);
}

async function run(ticker: string, bench: string) {
  const live = await fetchRecentDatedDailyAlphasVsBenchmark(ticker, 120, bench, null);

  console.log(
    JSON.stringify(
      {
        ticker,
        benchmark: bench,
        lastClose: live.lastClose,
        rowCount: live.rows.length,
      },
      null,
      2,
    ),
  );

  if (live.rows.length < 2) {
    console.log("Not enough rows for daily alpha (need >= 2 observation dates).");
    return;
  }

  const rows = live.rows;
  const tail = rows.slice(-TAIL);
  const maxAbs = Math.max(...rows.map((r) => Math.abs(Number(r.alphaValue))));

  console.log("\n--- Last", TAIL, "dated daily alpha rows (Yahoo + same impute as production) ---");
  for (const r of tail) {
    console.log(r.recordedAt, Number(r.alphaValue).toFixed(4));
  }
  console.log("max |daily alpha| in window:", maxAbs.toFixed(4));

  const firstYmd = rows[0]!.recordedAt.slice(0, 10);
  const startCandidates = [firstYmd, CUMULATIVE_ALPHA_DISPLAY_ANCHOR_YMD].filter(
    (v, i, a) => a.indexOf(v) === i,
  );

  for (const startDate of startCandidates) {
    const cum = calculateCumulativeAlpha(rows, startDate);
    const cumTail = cum.slice(-TAIL);
    console.log(
      "\n--- Cumulative alpha (startDate =",
      startDate,
      ", points =",
      cum.length,
      ") last",
      TAIL,
      "---",
    );
    for (const p of cumTail) {
      console.log(p.date, p.cumulative.toFixed(4));
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
