import { NextResponse } from "next/server";

import { fetchCompanyNameForTicker } from "@/src/lib/price-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = (searchParams.get("ticker") ?? "").trim();
  if (!ticker) {
    return NextResponse.json({ error: "ticker is required" }, { status: 400 });
  }
  const companyName = await fetchCompanyNameForTicker(ticker);
  return NextResponse.json({ ok: true, ticker, companyName });
}

