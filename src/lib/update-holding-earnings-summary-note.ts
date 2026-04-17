import type { Client } from "@libsql/client";

import { EARNINGS_SUMMARY_NOTE_MAX_LEN } from "@/src/lib/earnings-summary-note-meta";

export type UpdateHoldingEarningsSummaryNoteResult =
  | { ok: true }
  | { ok: false; code: "NOT_FOUND" | "DB_ERROR"; message: string };

/**
 * `holdings.earnings_summary_note` を更新する。空文字は NULL に正規化。
 * `quantity > 0` の行のみ更新対象。
 */
export async function updateHoldingEarningsSummaryNote(
  db: Client,
  params: { userId: string; holdingId: string; note: string | null },
): Promise<UpdateHoldingEarningsSummaryNoteResult> {
  const raw = params.note ?? "";
  const trimmed = raw.trim().slice(0, EARNINGS_SUMMARY_NOTE_MAX_LEN);
  const value = trimmed.length > 0 ? trimmed : null;

  try {
    const rs = await db.execute({
      sql: `UPDATE holdings
            SET earnings_summary_note = ?
            WHERE id = ? AND user_id = ? AND quantity > 0
            RETURNING id`,
      args: [value, params.holdingId, params.userId],
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
