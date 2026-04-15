import { NextResponse } from "next/server";

import { getDb, isDbConfigured } from "@/src/lib/db";
import type { MarketEventRecord } from "@/src/types/market-events";

export const dynamic = "force-dynamic";

/**
 * `market_events`: 過去数日〜今後数週の市場イベント（10分パトロール用の先読み）。
 */
export async function GET() {
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: "Database not configured", hint: "Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN" },
      { status: 503 },
    );
  }

  try {
    const db = getDb();
    const rs = await db.execute({
      sql: `SELECT id, event_date, title, category, importance, description
            FROM market_events
            WHERE date(event_date) >= date('now', '-5 days')
              AND date(event_date) <= date('now', '+70 days')
            ORDER BY event_date ASC, importance DESC, title ASC`,
    });
    const events = rs.rows as unknown as MarketEventRecord[];
    return NextResponse.json({ events });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("no such table") || msg.toLowerCase().includes("market_events")) {
      return NextResponse.json({ events: [] as MarketEventRecord[] });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
