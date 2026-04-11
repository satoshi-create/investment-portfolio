import { NextResponse } from "next/server";

import { defaultProfileUserId } from "@/src/lib/authorize-signals";
import { getThemeDetailData } from "@/src/lib/dashboard-data";
import { getDb, isDbConfigured } from "@/src/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: "Database not configured", hint: "Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN" },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") ?? defaultProfileUserId();
  const theme = searchParams.get("theme");
  const perf = searchParams.get("perf") === "1";
  const fast = searchParams.get("fast") === "1";
  if (theme == null || theme.trim().length === 0) {
    return NextResponse.json({ error: "Missing theme query parameter" }, { status: 400 });
  }

  try {
    const t0 = perf ? Date.now() : 0;
    const requestId = perf ? `theme-detail:${Math.random().toString(16).slice(2, 8)}` : null;
    if (perf && requestId) {
      console.log(`[perf] ${requestId} start theme="${theme.trim()}" user="${userId}"`);
    }
    const data = await getThemeDetailData(getDb(), userId, theme.trim(), { perf, requestId, fast });
    if (perf && requestId) {
      console.log(`[perf] ${requestId} done totalMs=${Date.now() - t0}`);
    }
    return NextResponse.json({ userId, ...data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
