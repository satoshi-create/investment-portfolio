import { NextResponse } from "next/server";

import { fetchLatestPriceWithChangePct } from "@/src/lib/price-service";

export const dynamic = "force-dynamic";

/**
 * 半導体サプライチェーン等向けの薄いマーケット・レンズ（SOX / NDX）。
 * ダッシュボード全体の `fetchGlobalMarketIndicators` より軽量。
 */
export async function GET() {
  try {
    const [sox, ndx] = await Promise.all([
      fetchLatestPriceWithChangePct("^SOX", "^SOX"),
      fetchLatestPriceWithChangePct("^NDX", "^NDX"),
    ]);
    return NextResponse.json({
      asOf: new Date().toISOString(),
      sox: {
        close: sox.close > 0 ? sox.close : null,
        changePct: sox.changePct,
        date: sox.date || null,
      },
      ndx: {
        close: ndx.close > 0 ? ndx.close : null,
        changePct: ndx.changePct,
        date: ndx.date || null,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
