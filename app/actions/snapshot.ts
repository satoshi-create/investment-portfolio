"use server";

import { revalidatePath } from "next/cache";

import { defaultProfileUserId } from "@/src/lib/authorize-signals";
import { getDb, isDbConfigured } from "@/src/lib/db";
import { recordPortfolioDailySnapshot } from "@/src/lib/portfolio-snapshots";

export type RecordPortfolioSnapshotActionResult = {
  ok: boolean;
  message: string;
  snapshotDate?: string;
  totalMarketValueJpy?: number;
};

/** Manual / cron: append or replace today’s patrol row for divergence vs VOO. */
export async function recordPortfolioSnapshotAction(userId?: string): Promise<RecordPortfolioSnapshotActionResult> {
  if (!isDbConfigured()) {
    return {
      ok: false,
      message: "Database not configured (set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN).",
    };
  }
  const uid = userId && userId.length > 0 ? userId : defaultProfileUserId();
  try {
    const db = getDb();
    const out = await recordPortfolioDailySnapshot(db, uid);
    revalidatePath("/");
    const suffix = out.replacedExistingRow ? " (updated today’s row)" : "";
    return {
      ok: true,
      message: `Snapshot ${out.snapshotDate}: ¥${Math.round(out.totalMarketValueJpy).toLocaleString()}${suffix}`,
      snapshotDate: out.snapshotDate,
      totalMarketValueJpy: out.totalMarketValueJpy,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Snapshot failed.";
    if (
      msg.includes("no such table") ||
      msg.toLowerCase().includes("portfolio_daily_snapshots") ||
      msg.toLowerCase().includes("holding_daily_snapshots")
    ) {
      return {
        ok: false,
        message:
          "Table missing: apply migrations/003_portfolio_daily_snapshots.sql and 004_holding_daily_snapshots.sql on Turso.",
      };
    }
    return { ok: false, message: `Snapshot failed: ${msg}` };
  }
}
