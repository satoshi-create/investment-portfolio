import { NextResponse } from "next/server";

import { defaultProfileUserId } from "@/src/lib/authorize-signals";
import { invalidateDashboardCacheForUser } from "@/src/lib/dashboard-api-cache";
import { getDb, isDbConfigured } from "@/src/lib/db";
import { EARNINGS_SUMMARY_NOTE_MAX_LEN } from "@/src/lib/earnings-summary-note-meta";
import { updateHoldingStoryHub } from "@/src/lib/update-holding-story-hub";

export const dynamic = "force-dynamic";

type Body = {
  userId?: string;
  holdingId?: string;
  memo?: string | null;
  earningsSummaryNote?: string | null;
  lynchDriversNarrative?: string | null;
  lynchStoryText?: string | null;
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

  const memoRaw = body.memo;
  const memo =
    memoRaw === null || memoRaw === undefined ? null : typeof memoRaw === "string" ? memoRaw : null;

  const earnRaw = body.earningsSummaryNote;
  const earningsSummaryNote =
    earnRaw === null || earnRaw === undefined ? null : typeof earnRaw === "string" ? earnRaw : null;
  if (earningsSummaryNote != null && earningsSummaryNote.length > EARNINGS_SUMMARY_NOTE_MAX_LEN) {
    return NextResponse.json(
      { error: `earningsSummaryNote は最大 ${EARNINGS_SUMMARY_NOTE_MAX_LEN} 文字です` },
      { status: 400 },
    );
  }

  const narrRaw = body.lynchDriversNarrative;
  const lynchDriversNarrative =
    narrRaw === null || narrRaw === undefined ? null : typeof narrRaw === "string" ? narrRaw : null;
  if (lynchDriversNarrative != null && lynchDriversNarrative.length > EARNINGS_SUMMARY_NOTE_MAX_LEN) {
    return NextResponse.json(
      { error: `lynchDriversNarrative は最大 ${EARNINGS_SUMMARY_NOTE_MAX_LEN} 文字です` },
      { status: 400 },
    );
  }

  const storyRaw = body.lynchStoryText;
  const lynchStoryText =
    storyRaw === null || storyRaw === undefined ? null : typeof storyRaw === "string" ? storyRaw : null;
  if (lynchStoryText != null && lynchStoryText.length > EARNINGS_SUMMARY_NOTE_MAX_LEN) {
    return NextResponse.json(
      { error: `lynchStoryText は最大 ${EARNINGS_SUMMARY_NOTE_MAX_LEN} 文字です` },
      { status: 400 },
    );
  }

  const db = getDb();
  const result = await updateHoldingStoryHub(db, {
    userId,
    holdingId,
    memo,
    earningsSummaryNote,
    lynchDriversNarrative,
    lynchStoryText,
  });

  if (!result.ok) {
    const status = result.code === "NOT_FOUND" ? 404 : 500;
    return NextResponse.json({ error: result.message, code: result.code }, { status });
  }

  invalidateDashboardCacheForUser(userId);
  return NextResponse.json({ ok: true });
}
