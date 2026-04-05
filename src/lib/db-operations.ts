import type { Client } from "@libsql/client";

import { roundAlphaMetric, SIGNAL_BENCHMARK_TICKER } from "@/src/lib/alpha-logic";

export type UpsertAlphaHistoryRow = {
  userId: string;
  ticker: string;
  /** 現在の保有に紐づける場合に指定。省略時は NULL のまま更新されうる */
  holdingId?: string | null;
  /** YYYY-MM-DD */
  recordedAtYmd: string;
  benchmarkTicker?: string;
  closePrice: number | null;
  alphaValue: number;
};

function assertYmd(dateYmd: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) {
    throw new Error(`recorded_at must be YYYY-MM-DD, got: ${dateYmd}`);
  }
}

/**
 * Idempotent write to `alpha_history` on (user_id, ticker, benchmark_ticker, recorded_at).
 * Re-running with the same key updates `alpha_value`, `close_price`, and `holding_id`.
 */
export async function upsertAlphaHistoryRow(db: Client, row: UpsertAlphaHistoryRow): Promise<void> {
  const benchmark = row.benchmarkTicker ?? SIGNAL_BENCHMARK_TICKER;
  assertYmd(row.recordedAtYmd);

  const id = crypto.randomUUID();
  const alpha = roundAlphaMetric(row.alphaValue);
  const hid = row.holdingId != null && row.holdingId.length > 0 ? row.holdingId : null;
  await db.execute({
    sql: `INSERT INTO alpha_history (id, user_id, ticker, holding_id, benchmark_ticker, recorded_at, close_price, alpha_value)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id, ticker, benchmark_ticker, recorded_at) DO UPDATE SET
            alpha_value = excluded.alpha_value,
            close_price = excluded.close_price,
            holding_id = excluded.holding_id`,
    args: [id, row.userId, row.ticker, hid, benchmark, row.recordedAtYmd, row.closePrice, alpha],
  });
}

/** Mark a signal row as reviewed / resolved (`is_resolved = 1`). */
export async function resolveSignal(db: Client, signalId: string): Promise<void> {
  await db.execute({
    sql: `UPDATE signals SET is_resolved = 1 WHERE id = ?`,
    args: [signalId],
  });
}
