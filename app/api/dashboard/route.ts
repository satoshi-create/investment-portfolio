import { NextResponse } from "next/server";

import { defaultProfileUserId } from "@/src/lib/authorize-signals";
import { fetchUnresolvedSignalsForUser, getDashboardData } from "@/src/lib/dashboard-data";
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

  try {
    const db = getDb();
    const [dash, signals] = await Promise.all([getDashboardData(db, userId), fetchUnresolvedSignalsForUser(db, userId)]);
    return NextResponse.json({
      userId,
      stocks: dash.stocks,
      signals,
      structureByTag: dash.structureByTag,
      coreSatellite: dash.coreSatellite,
      totalMarketValue: dash.totalMarketValue,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
