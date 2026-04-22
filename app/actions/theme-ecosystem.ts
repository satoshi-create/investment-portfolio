"use server";

import { revalidatePath } from "next/cache";

import { defaultProfileUserId } from "@/src/lib/authorize-signals";
import { getDb, isDbConfigured } from "@/src/lib/db";

export type ToggleThemeEcosystemKeptResult = {
  ok: boolean;
  isKept?: boolean;
  message?: string;
};

/**
 * `theme_ecosystem_members.is_kept` をトグル。呼び出しユーザーのテーマに紐づく行のみ更新。
 */
export async function toggleThemeEcosystemMemberKept(
  memberId: string,
  options?: { userId?: string; themeSlugForRevalidate?: string },
): Promise<ToggleThemeEcosystemKeptResult> {
  if (!isDbConfigured()) {
    return { ok: false, message: "Database not configured (set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN)." };
  }
  const uid = options?.userId && options.userId.length > 0 ? options.userId : defaultProfileUserId();
  const id = String(memberId ?? "").trim();
  if (id.length === 0) return { ok: false, message: "member id is required." };

  try {
    const db = getDb();
    const rs = await db.execute({
      sql: `UPDATE theme_ecosystem_members
            SET is_kept = CASE WHEN COALESCE(is_kept, 0) = 1 THEN 0 ELSE 1 END
            WHERE id = ?
              AND theme_id IN (SELECT id FROM investment_themes WHERE user_id = ?)
            RETURNING is_kept`,
      args: [id, uid],
    });
    const row = rs.rows[0];
    if (row == null) {
      return { ok: false, message: "対象のエコシステム行が見つからないか、権限がありません。" };
    }
    const raw = row["is_kept"];
    const isKept = Number(raw) === 1;

    revalidatePath("/");
    revalidatePath("/themes", "layout");
    revalidatePath("/themes/bookmarks");
    const slug = options?.themeSlugForRevalidate?.trim();
    if (slug != null && slug.length > 0) {
      revalidatePath(`/themes/${encodeURIComponent(slug)}`);
    }

    return { ok: true, isKept };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.toLowerCase().includes("no such column") && msg.toLowerCase().includes("is_kept")) {
      return {
        ok: false,
        message: "DB に is_kept 列がありません。migrations/036_theme_ecosystem_members_is_kept.sql を適用してください。",
      };
    }
    return { ok: false, message: msg };
  }
}

export type ToggleThemeEcosystemBookmarkResult = {
  ok: boolean;
  isBookmarked?: boolean;
  message?: string;
};

/**
 * `theme_ecosystem_members.is_bookmarked` をトグル（`is_kept` とは独立）。
 */
export async function toggleThemeEcosystemMemberBookmark(
  memberId: string,
  options?: { userId?: string; themeSlugForRevalidate?: string },
): Promise<ToggleThemeEcosystemBookmarkResult> {
  if (!isDbConfigured()) {
    return { ok: false, message: "Database not configured (set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN)." };
  }
  const uid = options?.userId && options.userId.length > 0 ? options.userId : defaultProfileUserId();
  const id = String(memberId ?? "").trim();
  if (id.length === 0) return { ok: false, message: "member id is required." };

  try {
    const db = getDb();
    const rs = await db.execute({
      sql: `UPDATE theme_ecosystem_members
            SET is_bookmarked = CASE WHEN COALESCE(is_bookmarked, 0) = 1 THEN 0 ELSE 1 END
            WHERE id = ?
              AND theme_id IN (SELECT id FROM investment_themes WHERE user_id = ?)
            RETURNING is_bookmarked`,
      args: [id, uid],
    });
    const row = rs.rows[0];
    if (row == null) {
      return { ok: false, message: "対象のエコシステム行が見つからないか、権限がありません。" };
    }
    const raw = row["is_bookmarked"];
    const isBookmarked = Number(raw) === 1;

    revalidatePath("/");
    revalidatePath("/themes", "layout");
    revalidatePath("/themes/bookmarks");
    const slug = options?.themeSlugForRevalidate?.trim();
    if (slug != null && slug.length > 0) {
      revalidatePath(`/themes/${encodeURIComponent(slug)}`);
    }

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
