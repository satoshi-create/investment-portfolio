import { NextResponse } from "next/server";

import { defaultProfileUserId } from "@/src/lib/authorize-signals";
import { fetchClosedTradesForDashboard } from "@/src/lib/trade-history";
import { getDb, isDbConfigured } from "@/src/lib/db";
import { DEFAULT_AGGREGATE_KPI_WINDOW_DAYS, fetchPortfolioAggregateKpisForUser } from "@/src/lib/portfolio-aggregate-kpis";
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

  const kpiWindowDays = (() => {
    const v = searchParams.get("kpiWindowDays");
    if (v == null) return DEFAULT_AGGREGATE_KPI_WINDOW_DAYS;
    const n = Math.trunc(Number(v));
    if (!Number.isFinite(n) || n < 1 || n > 366) return DEFAULT_AGGREGATE_KPI_WINDOW_DAYS;
    return n;
  })();

  const kpiLimit = (() => {
    const v = searchParams.get("kpiLimit");
    if (v == null) return 500;
    const n = Math.trunc(Number(v));
    if (!Number.isFinite(n) || n < 1) return 500;
    return Math.min(500, n);
  })();

  try {
    const db = getDb();
    const [portfolioSnapshots, holdingSnapshotsBundle, closedTrades, portfolioAggregateKpis] = await Promise.all([
      fetchPortfolioDailySnapshotsForUser(db, userId),
      fetchHoldingDailySnapshotsLatestForUser(db, userId),
      fetchClosedTradesForDashboard(db, userId),
      fetchPortfolioAggregateKpisForUser(db, userId, kpiLimit, kpiWindowDays).catch(() => []),
    ]);
    return NextResponse.json({
      userId,
      kpiWindowDays,
      portfolioSnapshots,
      holdingSnapshotsDate: holdingSnapshotsBundle.snapshotDate,
      holdingSnapshots: holdingSnapshotsBundle.rows,
      closedTrades,
      portfolioAggregateKpis,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
