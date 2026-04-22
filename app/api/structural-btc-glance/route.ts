import { NextResponse } from "next/server";

import { fetchLatestPriceWithChangePct } from "@/src/lib/price-service";

export const dynamic = "force-dynamic";

/**
 * 構造投資「ビットコイン」テーマ向けの薄い参照価格（BTC 現物・IBIT）。
 * ダッシュボード全体の `fetchGlobalMarketIndicators` は呼ばない。
 */
export async function GET() {
  try {
    const [btc, ibit] = await Promise.all([
      fetchLatestPriceWithChangePct("BTC-USD", null),
      fetchLatestPriceWithChangePct("IBIT", null),
    ]);
    return NextResponse.json({
      asOf: new Date().toISOString(),
      btcUsd: {
        close: btc.close > 0 ? btc.close : null,
        changePct: btc.changePct,
        date: btc.date || null,
      },
      ibit: {
        close: ibit.close > 0 ? ibit.close : null,
        changePct: ibit.changePct,
        date: ibit.date || null,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
