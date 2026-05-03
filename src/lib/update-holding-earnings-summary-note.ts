import type { Client } from "@libsql/client";

import { EARNINGS_SUMMARY_NOTE_MAX_LEN } from "@/src/lib/earnings-summary-note-meta";
import { patchTickerStoryHub } from "@/src/lib/ticker-story-hub-db";

export type UpdateHoldingEarningsSummaryNoteResult =
  | { ok: true }
  | { ok: false; code: "NOT_FOUND" | "DB_ERROR"; message: string };

/**
 * 決算要約を正本 `ticker_story_hub` に保存し、`holdings.earnings_summary_note` は NULL。
 * 空文字は NULL に正規化。`quantity > 0` の行のみ更新対象。
 */
export async function updateHoldingEarningsSummaryNote(
  db: Client,
  params: { userId: string; holdingId: string; note: string | null },
): Promise<UpdateHoldingEarningsSummaryNoteResult> {
  const raw = params.note ?? "";
  const trimmed = raw.trim().slice(0, EARNINGS_SUMMARY_NOTE_MAX_LEN);
  const value = trimmed.length > 0 ? trimmed : null;

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
      await patchTickerStoryHub(db, params.userId, tk, { earningsSummaryNote: value });
    }
    const rs = await db.execute({
      sql: `UPDATE holdings
            SET earnings_summary_note = NULL
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
    return { ok: false, code: "DB_ERROR", message };
  }
}
