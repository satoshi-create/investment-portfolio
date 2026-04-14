import { NextResponse } from "next/server";

import { addMemberToEcosystem, EcosystemMemberAuthError, EcosystemMemberDuplicateError } from "@/src/lib/add-ecosystem-member";
import { defaultProfileUserId } from "@/src/lib/authorize-signals";
import { getDb, isDbConfigured } from "@/src/lib/db";

export const dynamic = "force-dynamic";

type Body = {
  userId?: string;
  themeId?: string;
  ticker?: string;
  role?: string | null;
  isMajorPlayer?: boolean;
};

export async function POST(request: Request) {
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

  const userId = typeof body.userId === "string" && body.userId.trim().length > 0 ? body.userId.trim() : defaultProfileUserId();
  const themeId = typeof body.themeId === "string" ? body.themeId.trim() : "";
  const ticker = typeof body.ticker === "string" ? body.ticker.trim() : "";
  const role = body.role == null ? null : typeof body.role === "string" ? body.role : null;
  const isMajorPlayer = body.isMajorPlayer === true;

  if (!themeId) {
    return NextResponse.json({ error: "themeId is required" }, { status: 400 });
  }
  if (!ticker) {
    return NextResponse.json({ error: "ticker is required" }, { status: 400 });
  }

  try {
    await addMemberToEcosystem(getDb(), { userId, themeId, ticker, role, isMajorPlayer });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof EcosystemMemberAuthError) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e instanceof EcosystemMemberDuplicateError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 409 });
    }
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
