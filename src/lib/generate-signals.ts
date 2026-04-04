import type { Client } from "@libsql/client";

import { roundAlphaMetric, SIGNAL_BENCHMARK_TICKER } from "@/src/lib/alpha-logic";
import { getDb } from "@/src/lib/db";
import type { HoldingPriceInput } from "@/src/lib/price-service";
import type { Holding } from "@/src/types/investment";

export { SIGNAL_BENCHMARK_TICKER } from "@/src/lib/alpha-logic";

/** Holdings row for `userId` including `provider_symbol` (for Yahoo / alpha sync). */
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

/** Bridge DB holdings → `fetchLatestAlphaSnapshotsForHoldings` / `fetchLatestAlphaSnapshot`. */
export function holdingsToPriceInputs(holdings: Holding[]): HoldingPriceInput[] {
  return holdings.map((h) => ({
    holdingId: h.id,
    ticker: h.ticker,
    providerSymbol: h.providerSymbol,
  }));
}

export type GenerateSignalsDetail = { holdingId: string; type: "BUY" | "WARN" };

export type GenerateSignalsResult = {
  inserted: number;
  details: GenerateSignalsDetail[];
};

async function signalExistsForDay(
  db: Client,
  holdingId: string,
  signalType: "BUY" | "WARN",
  dateYmd: string,
): Promise<boolean> {
  const rs = await db.execute({
    sql: `SELECT 1 AS ok FROM signals
          WHERE holding_id = ? AND signal_type = ?
            AND substr(detected_at, 1, 10) = ?
          LIMIT 1`,
    args: [holdingId, signalType, dateYmd],
  });
  return rs.rows.length > 0;
}

async function insertSignal(
  db: Client,
  holdingId: string,
  signalType: "BUY" | "WARN",
  alphaAtSignal: number,
  dateYmd: string,
): Promise<void> {
  const id = crypto.randomUUID();
  await db.execute({
    sql: `INSERT INTO signals (id, holding_id, signal_type, alpha_at_signal, is_resolved, detected_at)
          VALUES (?, ?, ?, ?, 0, ?)`,
    args: [id, holdingId, signalType, alphaAtSignal, `${dateYmd}T12:00:00.000Z`],
  });
}

/**
 * Scans holdings for `userId`, reads last 3 VOO alpha points per holding,
 * inserts BUY/WARN rows into `signals` with same-day dedupe.
 */
export async function generateSignalsForUser(
  userId: string,
  db: Client = getDb(),
): Promise<GenerateSignalsResult> {
  const holdings = await fetchHoldingsWithProviderForUser(db, userId);

  const details: GenerateSignalsDetail[] = [];
  let inserted = 0;

  for (const h of holdings) {
    const holdingId = h.id;
    const alphaRs = await db.execute({
      sql: `SELECT recorded_at, alpha_value FROM alpha_history
            WHERE holding_id = ? AND benchmark_ticker = ?
            ORDER BY recorded_at DESC
            LIMIT 3`,
      args: [holdingId, SIGNAL_BENCHMARK_TICKER],
    });

    if (alphaRs.rows.length === 0) continue;

    const chronological = [...alphaRs.rows].reverse();
    const alphas = chronological.map((r) => Number(r.alpha_value));
    const latestRecordedAt = String(chronological[chronological.length - 1].recorded_at);
    const dateYmd = latestRecordedAt.slice(0, 10);

    if (alphas.length >= 3) {
      const last3 = alphas.slice(-3);
      if (last3.every((a) => a < 0)) {
        if (!(await signalExistsForDay(db, holdingId, "WARN", dateYmd))) {
          await insertSignal(
            db,
            holdingId,
            "WARN",
            roundAlphaMetric(alphas[alphas.length - 1]!),
            dateYmd,
          );
          inserted += 1;
          details.push({ holdingId, type: "WARN" });
        }
      }
    }

    if (alphas.length >= 2) {
      const prev = alphas[alphas.length - 2]!;
      const cur = alphas[alphas.length - 1]!;
      if (prev < 0 && cur > 0) {
        if (!(await signalExistsForDay(db, holdingId, "BUY", dateYmd))) {
          await insertSignal(db, holdingId, "BUY", roundAlphaMetric(cur), dateYmd);
          inserted += 1;
          details.push({ holdingId, type: "BUY" });
        }
      }
    }
  }

  return { inserted, details };
}
