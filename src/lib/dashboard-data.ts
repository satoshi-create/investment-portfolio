import type { Client } from "@libsql/client";

import type { Signal, Stock } from "@/src/types/investment";
import { SIGNAL_BENCHMARK_TICKER } from "@/src/lib/alpha-logic";
import { primaryStructureTag } from "@/src/lib/structure-tags";

export async function fetchStocksForUser(db: Client, userId: string): Promise<Stock[]> {
  const h = await db.execute({
    sql: `SELECT id, ticker, name, quantity, structure_tags, category, provider_symbol
          FROM holdings
          WHERE user_id = ?
          ORDER BY ticker`,
    args: [userId],
  });

  const holdingIds = h.rows.map((r) => String(r.id));
  if (holdingIds.length === 0) return [];

  const placeholders = holdingIds.map(() => "?").join(",");
  const a = await db.execute({
    sql: `SELECT holding_id, alpha_value, recorded_at FROM alpha_history
          WHERE benchmark_ticker = ? AND holding_id IN (${placeholders})
          ORDER BY recorded_at ASC`,
    args: [SIGNAL_BENCHMARK_TICKER, ...holdingIds],
  });

  const byHolding = new Map<string, number[]>();
  for (const row of a.rows) {
    const hid = String(row.holding_id);
    if (!byHolding.has(hid)) byHolding.set(hid, []);
    byHolding.get(hid)!.push(Number(row.alpha_value));
  }

  return h.rows.map((row) => {
    const id = String(row.id);
    const alphaHistory = byHolding.get(id) ?? [];
    return {
      id,
      ticker: String(row.ticker),
      name: row.name != null ? String(row.name) : "",
      tag: primaryStructureTag(String(row.structure_tags)),
      alphaHistory,
      weight: 0,
      quantity: Number(row.quantity),
      providerSymbol: row.provider_symbol != null && String(row.provider_symbol).length > 0 ? String(row.provider_symbol) : null,
    };
  });
}

/** Unresolved signals for dashboard cards (`id` is the `signals.id` row). */
export async function fetchUnresolvedSignalsForUser(db: Client, userId: string): Promise<Signal[]> {
  const rs = await db.execute({
    sql: `SELECT s.id AS signal_id, s.signal_type, s.alpha_at_signal,
                 h.ticker, h.name, h.structure_tags, h.provider_symbol
          FROM signals s
          JOIN holdings h ON h.id = s.holding_id
          WHERE h.user_id = ? AND s.is_resolved = 0
          ORDER BY s.detected_at DESC
          LIMIT 50`,
    args: [userId],
  });

  return rs.rows.map((row) => {
    const isWarn = String(row.signal_type) === "WARN";
    const isBuy = String(row.signal_type) === "BUY";
    const alpha = Number(row.alpha_at_signal);
    const tag = primaryStructureTag(String(row.structure_tags));
    return {
      id: String(row.signal_id),
      ticker: String(row.ticker),
      name: row.name != null ? String(row.name) : "",
      tag,
      alphaHistory: [alpha],
      weight: 0,
      quantity: 0,
      isWarning: isWarn,
      isBuy: isBuy,
      currentAlpha: alpha,
      providerSymbol:
        row.provider_symbol != null && String(row.provider_symbol).length > 0 ? String(row.provider_symbol) : null,
    };
  });
}
