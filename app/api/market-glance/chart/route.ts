import { NextResponse } from "next/server";

import { fetchMarketNenrinSeries, type MarketGlancePeriod } from "@/src/lib/market-glance";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get("symbol") ?? "").trim();
  const period = (searchParams.get("period") ?? "1mo").trim() as MarketGlancePeriod;

  if (symbol.length === 0) {
    return NextResponse.json({ error: "symbol is required" }, { status: 400 });
  }

  try {
    const out = await fetchMarketNenrinSeries({ symbol, period });
    return NextResponse.json(out);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg.toLowerCase().includes("unsupported symbol") ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

