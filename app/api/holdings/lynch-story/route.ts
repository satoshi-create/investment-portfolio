import { NextResponse } from "next/server";

import { defaultProfileUserId } from "@/src/lib/authorize-signals";
import { invalidateDashboardCacheForUser } from "@/src/lib/dashboard-api-cache";
import { getDb, isDbConfigured } from "@/src/lib/db";
import { updateHoldingLynchStoryNotes } from "@/src/lib/update-holding-lynch-story-notes";

export const dynamic = "force-dynamic";

type Body = {
  userId?: string;
  holdingId?: string;
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

  const narrRaw = body.lynchDriversNarrative;
  const storyRaw = body.lynchStoryText;
  const lynchDriversNarrative =
    narrRaw === null || narrRaw === undefined
      ? null
      : typeof narrRaw === "string"
        ? narrRaw
        : null;
  const lynchStoryText =
    storyRaw === null || storyRaw === undefined ? null : typeof storyRaw === "string" ? storyRaw : null;

  const db = getDb();
  const result = await updateHoldingLynchStoryNotes(db, {
    userId,
    holdingId,
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
