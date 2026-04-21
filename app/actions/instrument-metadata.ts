"use server";

import { revalidatePath } from "next/cache";

import { defaultProfileUserId } from "@/src/lib/authorize-signals";
import { invalidateDashboardCacheForUser } from "@/src/lib/dashboard-api-cache";
import { getDb, isDbConfigured } from "@/src/lib/db";
import { syncStockMetadata, type SyncStockMetadataResult } from "@/src/lib/instrument-metadata-sync";

/**
 * Yahoo から時価総額・上場日・（欠損時のみ）上場時価格を取得し、該当ティッカーの holdings / theme_ecosystem_members を更新。
 */
export async function syncStockMetadataAction(
  ticker: string,
  options?: { userId?: string; providerSymbol?: string | null },
): Promise<SyncStockMetadataResult> {
  if (!isDbConfigured()) {
    return { ok: false, listingDate: null, marketCap: null, listingPrice: null, error: "Database not configured." };
  }
  const uid = options?.userId && options.userId.length > 0 ? options.userId : defaultProfileUserId();
  const tk = String(ticker ?? "").trim();
  if (tk.length === 0) {
    return { ok: false, listingDate: null, marketCap: null, listingPrice: null, error: "ticker is required." };
  }
  try {
    const res = await syncStockMetadata(getDb(), uid, tk, options?.providerSymbol ?? null);
    if (res.ok) {
      invalidateDashboardCacheForUser(uid);
      revalidatePath("/");
    }
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, listingDate: null, marketCap: null, listingPrice: null, error: msg };
  }
}
