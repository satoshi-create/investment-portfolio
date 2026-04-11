/**
 * Cron / 外部から呼ぶ日次ジョブのエントリ（Alpha バックフィルは `npm run backfill:alpha`）。
 */
import type { Client } from "@libsql/client";

import { recordPortfolioDailySnapshot, type RecordPortfolioSnapshotResult } from "@/src/lib/portfolio-snapshots";

export async function runDailySnapshotJob(db: Client, userId: string): Promise<RecordPortfolioSnapshotResult> {
  return recordPortfolioDailySnapshot(db, userId);
}
