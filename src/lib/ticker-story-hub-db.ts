import type { Client } from "@libsql/client";

import { EARNINGS_SUMMARY_NOTE_MAX_LEN } from "@/src/lib/earnings-summary-note-meta";
import type { StoryHubPersistFields } from "@/src/lib/story-hub-optimistic";

/** ストーリー正本 `ticker_story_hub` の部分更新。キーが無い列は現状維持、キーありで null はクリア。 */
export type TickerStoryHubFieldPatch = Partial<{
  memo: string | null;
  earningsSummaryNote: string | null;
  lynchDriversNarrative: string | null;
  lynchStoryText: string | null;
}>;

function clipNote(raw: string | null | undefined, max: number): string | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim().slice(0, max);
  return trimmed.length > 0 ? trimmed : null;
}

export type TickerStoryHubRow = {
  memo: string | null;
  earningsSummaryNote: string | null;
  lynchDriversNarrative: string | null;
  lynchStoryText: string | null;
};

export async function fetchTickerStoryHubMapForUser(
  db: Client,
  userId: string,
): Promise<Map<string, TickerStoryHubRow>> {
  const out = new Map<string, TickerStoryHubRow>();
  try {
    const rs = await db.execute({
      sql: `SELECT ticker, memo, earnings_summary_note, lynch_drivers_narrative, lynch_story_text
            FROM ticker_story_hub WHERE user_id = ?`,
      args: [userId],
    });
    for (const r of rs.rows as Record<string, unknown>[]) {
      const t = String(r["ticker"] ?? "").trim().toUpperCase();
      if (t.length === 0) continue;
      out.set(t, {
        memo: r["memo"] != null ? String(r["memo"]) : null,
        earningsSummaryNote: r["earnings_summary_note"] != null ? String(r["earnings_summary_note"]) : null,
        lynchDriversNarrative: r["lynch_drivers_narrative"] != null ? String(r["lynch_drivers_narrative"]) : null,
        lynchStoryText: r["lynch_story_text"] != null ? String(r["lynch_story_text"]) : null,
      });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.toLowerCase().includes("no such table") && msg.toLowerCase().includes("ticker_story_hub")) {
      return out;
    }
    throw e;
  }
  return out;
}

/** ユーザー×ティッカーのストーリー正本へ全文 upsert（部分更新は `patchTickerStoryHub`）。 */
export async function upsertTickerStoryHub(
  db: Client,
  params: { userId: string; ticker: string } & StoryHubPersistFields,
): Promise<void> {
  const ticker = params.ticker.trim().toUpperCase();
  if (ticker.length === 0) return;

  const memo = params.memo != null && String(params.memo).trim().length > 0 ? String(params.memo).trim() : null;
  const earnings = clipNote(params.earningsSummaryNote ?? null, EARNINGS_SUMMARY_NOTE_MAX_LEN);
  const drivers = clipNote(params.lynchDriversNarrative ?? null, EARNINGS_SUMMARY_NOTE_MAX_LEN);
  const story = clipNote(params.lynchStoryText ?? null, EARNINGS_SUMMARY_NOTE_MAX_LEN);

  try {
    await db.execute({
      sql: `INSERT INTO ticker_story_hub (user_id, ticker, memo, earnings_summary_note, lynch_drivers_narrative, lynch_story_text, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(user_id, ticker) DO UPDATE SET
              memo = excluded.memo,
              earnings_summary_note = excluded.earnings_summary_note,
              lynch_drivers_narrative = excluded.lynch_drivers_narrative,
              lynch_story_text = excluded.lynch_story_text,
              updated_at = datetime('now')`,
      args: [params.userId, ticker, memo, earnings, drivers, story],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.toLowerCase().includes("no such table") && msg.toLowerCase().includes("ticker_story_hub")) {
      return;
    }
    throw e;
  }
}

/** 単一ティッカーのストーリー正本行（無ければ null）。 */
export async function fetchTickerStoryHubRow(
  db: Client,
  userId: string,
  ticker: string,
): Promise<TickerStoryHubRow | null> {
  const t = ticker.trim().toUpperCase();
  if (t.length === 0) return null;
  try {
    const rs = await db.execute({
      sql: `SELECT memo, earnings_summary_note, lynch_drivers_narrative, lynch_story_text
            FROM ticker_story_hub WHERE user_id = ? AND ticker = ? LIMIT 1`,
      args: [userId, t],
    });
    const r = rs.rows[0] as Record<string, unknown> | undefined;
    if (r == null) return null;
    return {
      memo: r["memo"] != null ? String(r["memo"]) : null,
      earningsSummaryNote: r["earnings_summary_note"] != null ? String(r["earnings_summary_note"]) : null,
      lynchDriversNarrative: r["lynch_drivers_narrative"] != null ? String(r["lynch_drivers_narrative"]) : null,
      lynchStoryText: r["lynch_story_text"] != null ? String(r["lynch_story_text"]) : null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.toLowerCase().includes("no such table") && msg.toLowerCase().includes("ticker_story_hub")) {
      return null;
    }
    throw e;
  }
}

function patchHasAnyField(patch: TickerStoryHubFieldPatch): boolean {
  return (
    Object.prototype.hasOwnProperty.call(patch, "memo") ||
    Object.prototype.hasOwnProperty.call(patch, "earningsSummaryNote") ||
    Object.prototype.hasOwnProperty.call(patch, "lynchDriversNarrative") ||
    Object.prototype.hasOwnProperty.call(patch, "lynchStoryText")
  );
}

function normalizeMemoForHub(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = String(raw).trim();
  return t.length > 0 ? t : null;
}

/**
 * 正本 `ticker_story_hub` の部分更新。未指定の列は既存値を維持。
 * 呼び出し側は `holdings` / `theme_ecosystem_members` の重複列を NULL にする責務を持つ（065 以降の方針）。
 */
export async function patchTickerStoryHub(
  db: Client,
  userId: string,
  ticker: string,
  patch: TickerStoryHubFieldPatch,
): Promise<void> {
  if (!patchHasAnyField(patch)) return;
  const base = (await fetchTickerStoryHubRow(db, userId, ticker)) ?? {
    memo: null,
    earningsSummaryNote: null,
    lynchDriversNarrative: null,
    lynchStoryText: null,
  };
  const memo = Object.prototype.hasOwnProperty.call(patch, "memo")
    ? normalizeMemoForHub(patch.memo)
    : base.memo;
  const earningsSummaryNote = Object.prototype.hasOwnProperty.call(patch, "earningsSummaryNote")
    ? clipNote(patch.earningsSummaryNote ?? null, EARNINGS_SUMMARY_NOTE_MAX_LEN)
    : base.earningsSummaryNote;
  const lynchDriversNarrative = Object.prototype.hasOwnProperty.call(patch, "lynchDriversNarrative")
    ? clipNote(patch.lynchDriversNarrative ?? null, EARNINGS_SUMMARY_NOTE_MAX_LEN)
    : base.lynchDriversNarrative;
  const lynchStoryText = Object.prototype.hasOwnProperty.call(patch, "lynchStoryText")
    ? clipNote(patch.lynchStoryText ?? null, EARNINGS_SUMMARY_NOTE_MAX_LEN)
    : base.lynchStoryText;
  await upsertTickerStoryHub(db, {
    userId,
    ticker,
    memo,
    earningsSummaryNote,
    lynchDriversNarrative,
    lynchStoryText,
  });
}
