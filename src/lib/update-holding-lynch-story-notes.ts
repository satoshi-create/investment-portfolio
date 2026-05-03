import type { Client } from "@libsql/client";

import { EARNINGS_SUMMARY_NOTE_MAX_LEN } from "@/src/lib/earnings-summary-note-meta";
import { patchTickerStoryHub } from "@/src/lib/ticker-story-hub-db";

export type UpdateHoldingLynchStoryNotesResult =
  | { ok: true }
  | { ok: false; code: "NOT_FOUND" | "DB_ERROR"; message: string };

function clipNote(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim().slice(0, EARNINGS_SUMMARY_NOTE_MAX_LEN);
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * リンチストーリー列を正本 `ticker_story_hub` に保存し、`holdings` の該当列は NULL。
 * 空文字は NULL に正規化。`quantity > 0` の行のみ更新対象。
 */
export async function updateHoldingLynchStoryNotes(
  db: Client,
  params: {
    userId: string;
    holdingId: string;
    lynchDriversNarrative: string | null;
    lynchStoryText: string | null;
  },
): Promise<UpdateHoldingLynchStoryNotesResult> {
  const drivers = clipNote(params.lynchDriversNarrative);
  const story = clipNote(params.lynchStoryText);

  try {
    const tkRs = await db.execute({
      sql: `SELECT ticker FROM holdings WHERE id = ? AND user_id = ? AND quantity > 0 LIMIT 1`,
      args: [params.holdingId, params.userId],
    });
    if (tkRs.rows.length === 0) {
      return { ok: false, code: "NOT_FOUND", message: "該当する保有が見つからないか、数量が 0 です" };
    }
    const tk =
      tkRs.rows[0] != null && tkRs.rows[0]["ticker"] != null ? String(tkRs.rows[0]["ticker"]).trim() : "";
    if (tk.length > 0) {
      await patchTickerStoryHub(db, params.userId, tk, {
        lynchDriversNarrative: drivers,
        lynchStoryText: story,
      });
    }
    const rs = await db.execute({
      sql: `UPDATE holdings
            SET lynch_drivers_narrative = NULL, lynch_story_text = NULL
            WHERE id = ? AND user_id = ? AND quantity > 0
            RETURNING id`,
      args: [params.holdingId, params.userId],
    });
    if (rs.rows.length === 0) {
      return { ok: false, code: "NOT_FOUND", message: "該当する保有が見つからないか、数量が 0 です" };
    }
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const lower = message.toLowerCase();
    if (lower.includes("no such column") && lower.includes("lynch_")) {
      return {
        ok: false,
        code: "DB_ERROR",
        message:
          "DB に lynch 列がありません。migrations/058_holdings_lynch_story_notes.sql を適用してください。",
      };
    }
    return { ok: false, code: "DB_ERROR", message };
  }
}
