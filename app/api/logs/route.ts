import { NextResponse } from "next/server";

import { defaultProfileUserId } from "@/src/lib/authorize-signals";
import { fetchClosedTradesForDashboard } from "@/src/lib/trade-history";
import { getDb, isDbConfigured } from "@/src/lib/db";
import {
  fetchHoldingDailySnapshotsLatestForUser,
  fetchPortfolioDailySnapshotsForUser,
} from "@/src/lib/portfolio-snapshots";

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
    const [portfolioSnapshots, holdingSnapshotsBundle, closedTrades] = await Promise.all([
      fetchPortfolioDailySnapshotsForUser(db, userId),
      fetchHoldingDailySnapshotsLatestForUser(db, userId),
      fetchClosedTradesForDashboard(db, userId),
    ]);
    return NextResponse.json({
      userId,
      portfolioSnapshots,
      holdingSnapshotsDate: holdingSnapshotsBundle.snapshotDate,
      holdingSnapshots: holdingSnapshotsBundle.rows,
      closedTrades,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
