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
  alphaHistoryRowsBackfilled?: number;
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
    revalidatePath("/logs");
    revalidatePath("/themes", "layout");
    const suffix = out.replacedExistingRow ? " (updated today’s row)" : "";
    const r = out.alphaHistoryReconcile;
    // Reconcile runs before snapshot; new INSERTs only when history is empty/thin (see alpha-history-reconcile).
    // If reconcile threw, r is undefined — still surface that so it is not confused with "0 new rows".
    const reconcileSuffix =
      r != null
        ? r.rowsBackfilled > 0
          ? ` · α_hist +${r.rowsBackfilled} rows`
          : ` · α_hist OK (0 new rows)`
        : ` · α_hist reconcile error (check server log)`;
    return {
      ok: true,
      message: `Snapshot ${out.snapshotDate}: ¥${Math.round(out.totalMarketValueJpy).toLocaleString()}${suffix}${reconcileSuffix}`,
      snapshotDate: out.snapshotDate,
      totalMarketValueJpy: out.totalMarketValueJpy,
      alphaHistoryRowsBackfilled: r?.rowsBackfilled,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Snapshot failed.";
    if (
      msg.includes("no such table") ||
      msg.toLowerCase().includes("portfolio_daily_snapshots") ||
      msg.toLowerCase().includes("holding_daily_snapshots") ||
      msg.toLowerCase().includes("market_glance_snapshots")
    ) {
      return {
        ok: false,
        message:
          "Table missing: apply migrations/003–004 and 009_market_glance_snapshots.sql (portfolio, holding, market glance) on Turso.",
      };
    }
    return { ok: false, message: `Snapshot failed: ${msg}` };
  }
}
