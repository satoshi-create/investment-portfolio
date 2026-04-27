import { NextResponse } from "next/server";

import { LYNCH_HOLDINGS_SEED } from "@/src/lib/lynch-holdings-seed";
import { fetchEquityResearchSnapshots } from "@/src/lib/price-service";
import type { LynchHoldingsResearchRow } from "@/src/types/lynch-holdings";

export const dynamic = "force-dynamic";

/**
 * リンチの保有例ページ用: Seed ティッカーの Yahoo リサーチを一括取得（DB 不要）。
 */
export async function GET() {
  try {
    const inputs = LYNCH_HOLDINGS_SEED.map((r) => ({
      ticker: r.ticker,
      providerSymbol: r.providerSymbol ?? null,
    }));
    const map = await fetchEquityResearchSnapshots(inputs, { concurrency: 4, batchDelayMs: 120 });
    const rows: LynchHoldingsResearchRow[] = LYNCH_HOLDINGS_SEED.map((r) => ({
      id: r.id,
      displayName: r.displayName,
      ticker: r.ticker,
      research: map.get(r.ticker.toUpperCase()) ?? null,
    }));
    return NextResponse.json({ rows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg, rows: [] as LynchHoldingsResearchRow[] }, { status: 502 });
  }
}
