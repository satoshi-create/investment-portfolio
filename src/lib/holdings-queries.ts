import type { Client } from "@libsql/client";

import type { Holding } from "@/src/types/investment";

function holdingsMissingInvestmentMeta(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  const lower = msg.toLowerCase();
  return lower.includes("no such column") && lower.includes("listing_date");
}

function parseOptionalIsoDatePrefix(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  return s.length >= 10 ? s.slice(0, 10) : null;
}

function parseOptionalFiniteNumberMeta(raw: unknown): number | null {
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseBookmarkFlag(raw: unknown): boolean {
  return raw != null && String(raw).trim() !== "" ? Number(raw) === 1 : false;
}

/** Active holdings (`quantity > 0`) for `userId`, including `provider_symbol` (Yahoo / alpha sync). */
export async function fetchHoldingsWithProviderForUser(db: Client, userId: string): Promise<Holding[]> {
  try {
    const rs = await db.execute({
      sql: `SELECT id, ticker, provider_symbol, listing_date, market_cap, listing_price, next_earnings_date, memo, is_bookmarked, instrument_meta_synced_at
            FROM holdings
            WHERE user_id = ? AND quantity > 0
            ORDER BY ticker`,
      args: [userId],
    });
    return rs.rows.map((row) => ({
      id: String(row.id),
      ticker: String(row.ticker),
      providerSymbol:
        row.provider_symbol != null && String(row.provider_symbol).length > 0 ? String(row.provider_symbol) : null,
      listingDate: parseOptionalIsoDatePrefix(
        row.listing_date ?? (row as Record<string, unknown>)["founded_date"],
      ),
      marketCap: parseOptionalFiniteNumberMeta(row.market_cap),
      listingPrice: parseOptionalFiniteNumberMeta(row.listing_price),
      nextEarningsDate: parseOptionalIsoDatePrefix(row.next_earnings_date),
      memo: row.memo != null && String(row.memo).trim().length > 0 ? String(row.memo) : null,
      isBookmarked: parseBookmarkFlag(row.is_bookmarked),
    }));
  } catch (e) {
    if (!holdingsMissingInvestmentMeta(e)) throw e;
    const rs = await db.execute({
      sql: `SELECT id, ticker, provider_symbol FROM holdings WHERE user_id = ? AND quantity > 0 ORDER BY ticker`,
      args: [userId],
    });
    return rs.rows.map((row) => ({
      id: String(row.id),
      ticker: String(row.ticker),
      providerSymbol:
        row.provider_symbol != null && String(row.provider_symbol).length > 0 ? String(row.provider_symbol) : null,
      listingDate: null,
      marketCap: null,
      listingPrice: null,
      nextEarningsDate: null,
      memo: null,
      isBookmarked: false,
    }));
  }
}
