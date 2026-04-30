import type { Client } from "@libsql/client";

import { EARNINGS_SUMMARY_NOTE_MAX_LEN } from "@/src/lib/earnings-summary-note-meta";
import type { LynchCategory } from "@/src/types/investment";

export type UpdateHoldingStoryHubResult =
  | { ok: true }
  | { ok: false; code: "NOT_FOUND" | "DB_ERROR"; message: string };

function clipEarningsNote(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim().slice(0, EARNINGS_SUMMARY_NOTE_MAX_LEN);
  return trimmed.length > 0 ? trimmed : null;
}

function clipLynchNote(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim().slice(0, EARNINGS_SUMMARY_NOTE_MAX_LEN);
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeMemo(memo: string | null | undefined): string | null {
  if (memo == null) return null;
  const t = String(memo).trim();
  return t.length > 0 ? t : null;
}

/**
 * Story サイドパネル用: `memo` / `earnings_summary_note` / lynch 列を 1 文の UPDATE で更新する。
 * `patchHoldingMemo` と同様に `quantity` は見ない（保有行は id + user_id で特定）。
 */
export async function updateHoldingStoryHub(
  db: Client,
  params: {
    userId: string;
    holdingId: string;
    memo: string | null;
    earningsSummaryNote: string | null;
    lynchDriversNarrative: string | null;
    lynchStoryText: string | null;
    /** 未送信時は expectation_category 列を更新しない */
    expectationCategory?: LynchCategory | null;
  },
): Promise<UpdateHoldingStoryHubResult> {
  const memo = normalizeMemo(params.memo);
  const earnings = clipEarningsNote(params.earningsSummaryNote);
  const drivers = clipLynchNote(params.lynchDriversNarrative);
  const story = clipLynchNote(params.lynchStoryText);

  const sets = ["memo = ?", "earnings_summary_note = ?", "lynch_drivers_narrative = ?", "lynch_story_text = ?"];
  const args: (string | null)[] = [memo, earnings, drivers, story];
  if (params.expectationCategory !== undefined) {
    sets.push("expectation_category = ?");
    args.push(params.expectationCategory);
  }

  try {
    const rs = await db.execute({
      sql: `UPDATE holdings SET ${sets.join(", ")} WHERE id = ? AND user_id = ? RETURNING id`,
      args: [...args, params.holdingId, params.userId],
    });
    if (rs.rows.length === 0) {
      return { ok: false, code: "NOT_FOUND", message: "保有行が見つからないか、権限がありません。" };
    }
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const lower = message.toLowerCase();
    if (
      lower.includes("no such column") &&
      (lower.includes("lynch_") || lower.includes("earnings_summary") || lower.includes("expectation_category"))
    ) {
      return {
        ok: false,
        code: "DB_ERROR",
        message:
          "DB に必要な列がありません。holdings 用の最新マイグレーション（memo / earnings / lynch）を適用してください。",
      };
    }
    return { ok: false, code: "DB_ERROR", message };
  }
}
