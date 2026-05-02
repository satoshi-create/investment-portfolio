import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { getDb, isDbConfigured } from "@/src/lib/db";
import { fetchLatestPrice } from "@/src/lib/price-service";

export const dynamic = "force-dynamic";

const SYMBOL = "NAPHTHA";

/**
 * POST Bearer CRON_SECRET — Yahoo プロキシから `commodity_prices` へ 1 行追加。
 * Turso 運用向け（Supabase Edge の代替パス）。
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret == null || secret.length === 0) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isDbConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const yahoo = process.env.NAPHTHA_YAHOO_SYMBOL?.trim() || "CL=F";
  try {
    const snap = await fetchLatestPrice(yahoo, null);
    if (snap == null) {
      return NextResponse.json(
        { error: "Upstream Yahoo fetch failed", hint: "Chart falls back to DB / merged Yahoo series" },
        { status: 502 },
      );
    }
    const db = getDb();
    const id = randomUUID();
    await db.execute({
      sql: `INSERT INTO commodity_prices (id, symbol, price, timestamp, source_url) VALUES (?, ?, ?, ?, ?)`,
      args: [id, SYMBOL, snap.close, snap.date, `yahoo:${yahoo}:${snap.date.slice(0, 10)}`],
    });
    return NextResponse.json({
      ok: true,
      symbol: SYMBOL,
      proxy: yahoo,
      price: snap.close,
      timestamp: snap.date,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
