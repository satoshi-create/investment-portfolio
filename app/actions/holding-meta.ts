"use server";

import { revalidatePath } from "next/cache";

import { defaultProfileUserId } from "@/src/lib/authorize-signals";
import { invalidateDashboardCacheForUser } from "@/src/lib/dashboard-api-cache";
import { getDb, isDbConfigured } from "@/src/lib/db";
import { parseExpectationCategory } from "@/src/lib/expectation-category";

export type ToggleHoldingBookmarkResult = {
  ok: boolean;
  isBookmarked?: boolean;
  message?: string;
};

export async function toggleHoldingBookmark(
  holdingId: string,
  options?: { userId?: string },
): Promise<ToggleHoldingBookmarkResult> {
  if (!isDbConfigured()) {
    return { ok: false, message: "Database not configured." };
  }
  const uid = options?.userId && options.userId.length > 0 ? options.userId : defaultProfileUserId();
  const id = String(holdingId ?? "").trim();
  if (id.length === 0) return { ok: false, message: "holding id is required." };

  try {
    const db = getDb();
    const rs = await db.execute({
      sql: `UPDATE holdings
            SET is_bookmarked = CASE WHEN COALESCE(is_bookmarked, 0) = 1 THEN 0 ELSE 1 END
            WHERE id = ? AND user_id = ?
            RETURNING is_bookmarked`,
      args: [id, uid],
    });
    const row = rs.rows[0];
    if (row == null) {
      return { ok: false, message: "保有行が見つからないか、権限がありません。" };
    }
    const raw = row["is_bookmarked"];
    const isBookmarked = Number(raw) === 1;
    invalidateDashboardCacheForUser(uid);
    revalidatePath("/");
    return { ok: true, isBookmarked };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.toLowerCase().includes("no such column") && msg.toLowerCase().includes("is_bookmarked")) {
      return {
        ok: false,
        message: "DB に is_bookmarked 列がありません。migrations/042_investment_instrument_meta.sql を適用してください。",
      };
    }
    return { ok: false, message: msg };
  }
}

export type PatchHoldingMemoResult = { ok: boolean; message?: string };

/** `holdings.memo`（短文メモ）。空文字は NULL にします。 */
export async function patchHoldingMemo(
  holdingId: string,
  memo: string | null,
  options?: { userId?: string },
): Promise<PatchHoldingMemoResult> {
  if (!isDbConfigured()) {
    return { ok: false, message: "Database not configured." };
  }
  const uid = options?.userId && options.userId.length > 0 ? options.userId : defaultProfileUserId();
  const id = String(holdingId ?? "").trim();
  if (id.length === 0) return { ok: false, message: "holding id is required." };
  const normalized =
    memo == null ? null : typeof memo === "string" ? (memo.trim().length > 0 ? memo.trim() : null) : null;

  try {
    const db = getDb();
    const rs = await db.execute({
      sql: `UPDATE holdings SET memo = ? WHERE id = ? AND user_id = ? RETURNING id`,
      args: [normalized, id, uid],
    });
    if (rs.rows.length === 0) {
      return { ok: false, message: "保有行が見つからないか、権限がありません。" };
    }
    invalidateDashboardCacheForUser(uid);
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.toLowerCase().includes("no such column") && msg.toLowerCase().includes("memo")) {
      return {
        ok: false,
        message: "DB に memo 列がありません。migrations/042_investment_instrument_meta.sql を適用してください。",
      };
    }
    return { ok: false, message: msg };
  }
}

export type PatchHoldingExpectationCategoryResult = { ok: boolean; message?: string };

/** `holdings.expectation_category`（リンチ分類）。空文字・null は NULL にクリア。 */
export async function patchHoldingExpectationCategory(
  holdingId: string,
  expectationCategoryRaw: string | null,
  options?: { userId?: string },
): Promise<PatchHoldingExpectationCategoryResult> {
  if (!isDbConfigured()) {
    return { ok: false, message: "Database not configured." };
  }
  const uid = options?.userId && options.userId.length > 0 ? options.userId : defaultProfileUserId();
  const id = String(holdingId ?? "").trim();
  if (id.length === 0) return { ok: false, message: "holding id is required." };

  const t = expectationCategoryRaw == null ? "" : String(expectationCategoryRaw).trim();
  let dbValue: string | null;
  if (t.length === 0) {
    dbValue = null;
  } else {
    const parsed = parseExpectationCategory(t);
    if (parsed == null) {
      return { ok: false, message: "無効なリンチ分類です。" };
    }
    dbValue = parsed;
  }

  try {
    const db = getDb();
    const rs = await db.execute({
      sql: `UPDATE holdings SET expectation_category = ? WHERE id = ? AND user_id = ? RETURNING id`,
      args: [dbValue, id, uid],
    });
    if (rs.rows.length === 0) {
      return { ok: false, message: "保有行が見つからないか、権限がありません。" };
    }
    invalidateDashboardCacheForUser(uid);
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.toLowerCase().includes("no such column") && msg.toLowerCase().includes("expectation_category")) {
      return {
        ok: false,
        message:
          "DB に expectation_category 列がありません。migrations/020_expectation_category.sql（および 049）を適用してください。",
      };
    }
    return { ok: false, message: msg };
  }
}
