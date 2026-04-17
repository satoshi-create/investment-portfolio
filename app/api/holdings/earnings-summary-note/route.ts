import { NextResponse } from "next/server";

import { defaultProfileUserId } from "@/src/lib/authorize-signals";
import { invalidateDashboardCacheForUser } from "@/src/lib/dashboard-api-cache";
import { getDb, isDbConfigured } from "@/src/lib/db";
import { EARNINGS_SUMMARY_NOTE_MAX_LEN } from "@/src/lib/earnings-summary-note-meta";
import { updateHoldingEarningsSummaryNote } from "@/src/lib/update-holding-earnings-summary-note";

export const dynamic = "force-dynamic";

type Body = {
  userId?: string;
  holdingId?: string;
  /** 空にすると DB を NULL にする */
  earningsSummaryNote?: string | null;
};

export async function PATCH(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: "Database not configured", hint: "Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN" },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const userId =
    typeof body.userId === "string" && body.userId.trim().length > 0 ? body.userId.trim() : defaultProfileUserId();
  const holdingId = typeof body.holdingId === "string" ? body.holdingId.trim() : "";
  if (!holdingId) {
    return NextResponse.json({ error: "holdingId is required" }, { status: 400 });
  }

  const noteRaw = body.earningsSummaryNote;
  const note =
    noteRaw === null || noteRaw === undefined
      ? null
      : typeof noteRaw === "string"
        ? noteRaw
        : null;
  if (note != null && note.length > EARNINGS_SUMMARY_NOTE_MAX_LEN) {
    return NextResponse.json(
      { error: `earningsSummaryNote は最大 ${EARNINGS_SUMMARY_NOTE_MAX_LEN} 文字です` },
      { status: 400 },
    );
  }

  const db = getDb();
  const result = await updateHoldingEarningsSummaryNote(db, { userId, holdingId, note });
  if (!result.ok) {
    const status = result.code === "NOT_FOUND" ? 404 : 500;
    return NextResponse.json({ error: result.message, code: result.code }, { status });
  }

  invalidateDashboardCacheForUser(userId);
  return NextResponse.json({ ok: true });
}
