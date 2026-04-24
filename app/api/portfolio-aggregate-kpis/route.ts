import { NextResponse } from "next/server";

import { defaultProfileUserId } from "@/src/lib/authorize-signals";
import { parseAggregateKpiImportCsv } from "@/src/lib/csv-aggregate-kpis";
import { getDb, isDbConfigured } from "@/src/lib/db";
import { upsertAggregateKpiImportRows } from "@/src/lib/portfolio-aggregate-kpis";

export const dynamic = "force-dynamic";

const MAX_CSV = 1_200_000;

type PostBody = {
  userId?: string;
  csv?: string;
};

/**
 * ブラウザから `aggregate_kpis_*.csv` を再取り込み（`portfolio_aggregate_kpis` へ upsert）。
 */
export async function POST(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: "Database not configured", hint: "Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN" },
      { status: 503 },
    );
  }

  let body: PostBody;
  const ct = request.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    body = (await request.json()) as PostBody;
  } else {
    return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
  }

  const userId = typeof body.userId === "string" && body.userId.length > 0 ? body.userId : defaultProfileUserId();
  const raw = body.csv;
  if (typeof raw !== "string" || raw.length === 0) {
    return NextResponse.json({ error: "Missing csv" }, { status: 400 });
  }
  if (raw.length > MAX_CSV) {
    return NextResponse.json({ error: "CSV too large" }, { status: 413 });
  }

  const parsed = parseAggregateKpiImportCsv(raw);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const db = getDb();
    const { applied } = await upsertAggregateKpiImportRows(db, userId, parsed.rows);
    return NextResponse.json({ ok: true as const, applied, userId });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
