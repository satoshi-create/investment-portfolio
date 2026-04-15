import { NextResponse } from "next/server";

import { defaultProfileUserId } from "@/src/lib/authorize-signals";
import { SIGNAL_BENCHMARK_TICKER } from "@/src/lib/alpha-logic";
import type { PeriodicTableAlphaPoint } from "@/src/lib/dashboard-data";
import { getDb, isDbConfigured } from "@/src/lib/db";

export const dynamic = "force-dynamic";

function clampInt(v: string | null, def: number, min: number, max: number): number {
  const n = Math.trunc(Number(v));
  if (!Number.isFinite(n)) return def;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

export async function GET(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json(
      { points: [], error: "Database not configured" },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") ?? defaultProfileUserId();
  const ticker = (searchParams.get("ticker") ?? "").trim();
  const limit = clampInt(searchParams.get("limit"), 45, 10, 180);
  if (!ticker) {
    return NextResponse.json({ points: [], error: "Missing ticker" }, { status: 400 });
  }

  try {
    const db = getDb();
    const rs = await db.execute({
      sql: `SELECT recorded_at, alpha_value
            FROM alpha_history
            WHERE user_id = ? AND benchmark_ticker = ? AND UPPER(ticker) = UPPER(?)
            ORDER BY recorded_at DESC
            LIMIT ?`,
      args: [userId, SIGNAL_BENCHMARK_TICKER, ticker, limit],
    });

    const points: PeriodicTableAlphaPoint[] = (rs.rows as unknown as Record<string, unknown>[])
      .map((r) => ({
        date: String(r["recorded_at"] ?? "").slice(0, 10),
        alpha: Number(r["alpha_value"]),
      }))
      .filter((p) => p.date.length === 10 && Number.isFinite(p.alpha))
      .reverse();

    return NextResponse.json({ points });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ points: [], error: message }, { status: 500 });
  }
}

