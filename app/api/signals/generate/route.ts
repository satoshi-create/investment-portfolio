import { NextResponse } from "next/server";

import { authorizeSignalsRequest, defaultProfileUserId } from "@/src/lib/authorize-signals";
import { generateSignalsForUser } from "@/src/lib/generate-signals";
import { getDb, isDbConfigured } from "@/src/lib/db";

export const dynamic = "force-dynamic";

async function runGenerate(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: "Database not configured", hint: "Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN" },
      { status: 503 },
    );
  }

  if (!authorizeSignalsRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let userId = defaultProfileUserId();
  if (request.method === "POST") {
    try {
      const body = (await request.json()) as { userId?: string };
      if (typeof body.userId === "string" && body.userId.length > 0) {
        userId = body.userId;
      }
    } catch {
      /* empty body OK */
    }
  } else {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("userId");
    if (q) userId = q;
  }

  try {
    const result = await generateSignalsForUser(userId, getDb());
    return NextResponse.json({ userId, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Manual trigger (e.g. dashboard button). */
export async function POST(request: Request) {
  return runGenerate(request);
}

/** Automation: Vercel Cron issues GET with Authorization: Bearer CRON_SECRET. */
export async function GET(request: Request) {
  return runGenerate(request);
}
