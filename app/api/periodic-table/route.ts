import { NextResponse } from "next/server";

import { defaultProfileUserId } from "@/src/lib/authorize-signals";
import { getPeriodicTableData } from "@/src/lib/dashboard-data";
import { getDb, isDbConfigured } from "@/src/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json(
      { cells: [], error: "Database not configured", hint: "Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN" },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") ?? defaultProfileUserId();
  const live = searchParams.get("live") === "1";

  try {
    const data = await getPeriodicTableData(getDb(), userId, { live });
    return NextResponse.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ cells: [], error: message }, { status: 500 });
  }
}

