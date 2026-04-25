"use server";

import { revalidatePath } from "next/cache";

import { defaultProfileUserId } from "@/src/lib/authorize-signals";
import { invalidateDashboardCacheForUser } from "@/src/lib/dashboard-api-cache";
import { getDb, isDbConfigured } from "@/src/lib/db";
import { fetchEquityResearchSnapshots } from "@/src/lib/price-service";
import {
  syncStockMetadata,
  syncYahooEquityResearchForTicker,
  type SyncStockMetadataResult,
} from "@/src/lib/instrument-metadata-sync";

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

export type DividendResearchDatesResult = {
  ok: boolean;
  exDividendDate: string | null;
  recordDate: string | null;
  error?: string;
};

/**
 * Yahoo から配当関連日付（権利落ち日 / 権利確定日）を取得する。
 * `persist: true` のとき `syncYahooEquityResearchForTicker` 経由で DB にも反映（既存非 null は保持）。
 */
export async function fetchDividendResearchDatesAction(
  ticker: string,
  options?: { providerSymbol?: string | null; persist?: boolean; userId?: string },
): Promise<DividendResearchDatesResult> {
  const tk = String(ticker ?? "").trim();
  if (tk.length === 0) return { ok: false, exDividendDate: null, recordDate: null, error: "ticker is required." };
  try {
    if (options?.persist === true && isDbConfigured()) {
      const uid = options.userId && options.userId.length > 0 ? options.userId : defaultProfileUserId();
      const wr = await syncYahooEquityResearchForTicker(getDb(), uid, tk, options?.providerSymbol ?? null);
      if (wr.ok) {
        invalidateDashboardCacheForUser(uid);
        revalidatePath("/");
      }
      const snap = wr.snapshot ?? null;
      return {
        ok: wr.ok,
        exDividendDate: snap?.exDividendDate ?? null,
        recordDate: snap?.recordDate ?? null,
        error: wr.ok ? undefined : wr.error,
      };
    }
    const m = await fetchEquityResearchSnapshots([{ ticker: tk, providerSymbol: options?.providerSymbol ?? null }], {
      concurrency: 1,
      batchDelayMs: 0,
    });
    const snap = m.get(tk.toUpperCase()) ?? null;
    return { ok: true, exDividendDate: snap?.exDividendDate ?? null, recordDate: snap?.recordDate ?? null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, exDividendDate: null, recordDate: null, error: msg };
  }
}

/** Yahoo リサーチ列のみ同期（上場メタは触れない）。 */
export async function syncYahooEquityResearchAction(
  ticker: string,
  options?: { userId?: string; providerSymbol?: string | null },
): Promise<{ ok: boolean; syncedAt: string | null; error?: string }> {
  if (!isDbConfigured()) {
    return { ok: false, syncedAt: null, error: "Database not configured." };
  }
  const uid = options?.userId && options.userId.length > 0 ? options.userId : defaultProfileUserId();
  const tk = String(ticker ?? "").trim();
  if (tk.length === 0) return { ok: false, syncedAt: null, error: "ticker is required." };
  try {
    const res = await syncYahooEquityResearchForTicker(getDb(), uid, tk, options?.providerSymbol ?? null);
    if (res.ok) {
      invalidateDashboardCacheForUser(uid);
      revalidatePath("/");
    }
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, syncedAt: null, error: msg };
  }
}
