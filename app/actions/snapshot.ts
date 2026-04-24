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

/**
 * Manual / cron: append or replace today’s patrol row for divergence vs VOO.
 * After a successful `portfolio_daily_snapshots` write, `recordPortfolioDailySnapshot` also upserts
 * `portfolio_aggregate_kpis` (30d window; see `migrations/044_portfolio_aggregate_kpis.sql`).
 */
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
    const reconcileSuffix =
      r.rowsBackfilled > 0
        ? ` · α_hist +${r.rowsBackfilled} rows`
        : ` · α_hist OK (0 new rows)`;
    const staleSuffix =
      out.staleAlphaDataWarning != null && out.staleAlphaDataWarning.length > 0
        ? ` · ${out.staleAlphaDataWarning}`
        : "";
    return {
      ok: true,
      message: `Snapshot ${out.snapshotDate}: ¥${Math.round(out.totalMarketValueJpy).toLocaleString()}${suffix}${reconcileSuffix}${staleSuffix}`,
      snapshotDate: out.snapshotDate,
      totalMarketValueJpy: out.totalMarketValueJpy,
      alphaHistoryRowsBackfilled: r.rowsBackfilled,
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
