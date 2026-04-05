import type { Client } from "@libsql/client";

import type { Holding } from "@/src/types/investment";

/** Holdings for `userId` including `provider_symbol` (Yahoo / alpha sync). */
export async function fetchHoldingsWithProviderForUser(db: Client, userId: string): Promise<Holding[]> {
  const rs = await db.execute({
    sql: `SELECT id, ticker, provider_symbol FROM holdings WHERE user_id = ? ORDER BY ticker`,
    args: [userId],
  });
  return rs.rows.map((row) => ({
    id: String(row.id),
    ticker: String(row.ticker),
    providerSymbol:
      row.provider_symbol != null && String(row.provider_symbol).length > 0 ? String(row.provider_symbol) : null,
  }));
}
