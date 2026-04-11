import { NextResponse } from "next/server";

import { defaultProfileUserId } from "@/src/lib/authorize-signals";
import { runDailySnapshotJob } from "@/src/lib/backfill";
import { getDb, isDbConfigured } from "@/src/lib/db";

export const dynamic = "force-dynamic";

function extractApiKey(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim();
  const x = request.headers.get("x-api-key");
  return x?.trim() || null;
}

function expectedBackfillKey(): string {
  return (process.env.BACKFILL_API_KEY ?? process.env.CRON_SNAPSHOT_SECRET ?? "").trim();
}

async function handle(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: "Database not configured", hint: "Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN" },
      { status: 503 },
    );
  }

  const secret = expectedBackfillKey();
  if (!secret) {
    return NextResponse.json(
      { error: "BACKFILL_API_KEY is not configured", hint: "Set BACKFILL_API_KEY (or CRON_SNAPSHOT_SECRET) in the deployment environment" },
      { status: 503 },
    );
  }

  const provided = extractApiKey(request);
  if (!provided || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") ?? defaultProfileUserId();

  try {
    const db = getDb();
    const result = await runDailySnapshotJob(db, userId);
    return NextResponse.json({
      ok: true,
      userId,
      snapshotDate: result.snapshotDate,
      totalMarketValueJpy: result.totalMarketValueJpy,
      replacedExistingRow: result.replacedExistingRow,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return handle(request);
}

/** 一部の cron は GET のみ — 認証は POST と同じ */
export async function GET(request: Request) {
  return handle(request);
}
