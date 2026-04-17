import type { Client } from "@libsql/client";

import {
  reconcileAlphaHistoryForUser,
  type ReconcileAlphaHistoryResult,
} from "@/src/lib/alpha-history-reconcile";
import { defaultBenchmarkTickerForTicker, roundAlphaMetric, SIGNAL_BENCHMARK_TICKER } from "@/src/lib/alpha-logic";
import { getDb } from "@/src/lib/db";
import { fetchHoldingsWithProviderForUser } from "@/src/lib/holdings-queries";
import type { HoldingPriceInput } from "@/src/lib/price-service";
import { signalsDebug } from "@/src/lib/signals-debug";
import type { Holding } from "@/src/types/investment";

export { SIGNAL_BENCHMARK_TICKER } from "@/src/lib/alpha-logic";
export { fetchHoldingsWithProviderForUser } from "@/src/lib/holdings-queries";

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
  reconcile: ReconcileAlphaHistoryResult;
};

function todayUtcYmd(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function signalExistsForAlphaDay(
  db: Client,
  holdingId: string,
  signalType: "BUY" | "WARN",
  alphaDayYmd: string,
): Promise<boolean> {
  const rs = await db.execute({
    sql: `SELECT 1 AS ok FROM signals
          WHERE holding_id = ? AND signal_type = ?
            AND alpha_day = ?
          LIMIT 1`,
    args: [holdingId, signalType, alphaDayYmd],
  });
  return rs.rows.length > 0;
}

async function insertSignal(
  db: Client,
  holdingId: string,
  signalType: "BUY" | "WARN",
  alphaAtSignal: number,
  alphaDayYmd: string,
): Promise<void> {
  const id = crypto.randomUUID();
  // `detected_at` should represent the time the generation ran (not the alpha_history day).
  const detectedAtIso = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO signals (id, holding_id, signal_type, alpha_at_signal, is_resolved, detected_at, alpha_day)
          VALUES (?, ?, ?, ?, 0, ?, ?)`,
    args: [id, holdingId, signalType, alphaAtSignal, detectedAtIso, alphaDayYmd],
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
  const runDateYmd = todayUtcYmd();
  signalsDebug("generateSignalsForUser start", {
    userId,
    benchmark: SIGNAL_BENCHMARK_TICKER,
    runDateYmd,
  });

  const reconcile = await reconcileAlphaHistoryForUser(userId, db);

  signalsDebug("reconcileAlphaHistoryForUser done", {
    rowsBackfilled: reconcile.rowsBackfilled,
    backfilledTickers: reconcile.backfilledTickers,
    linkedCount: reconcile.linkedTickers.length,
  });

  const holdings = await fetchHoldingsWithProviderForUser(db, userId);

  signalsDebug("holdings loaded", {
    count: holdings.length,
    tickers: holdings.map((x) => x.ticker),
  });

  const details: GenerateSignalsDetail[] = [];
  let inserted = 0;

  for (const h of holdings) {
    const holdingId = h.id;
    const benchmarkTicker = defaultBenchmarkTickerForTicker(h.ticker);
    const alphaRs = await db.execute({
      sql: `SELECT recorded_at, alpha_value FROM alpha_history
            WHERE user_id = ? AND ticker = ? AND benchmark_ticker = ?
            ORDER BY recorded_at DESC
            LIMIT 3`,
      args: [userId, h.ticker, benchmarkTicker],
    });

    if (alphaRs.rows.length === 0) {
      signalsDebug("skip holding: no alpha_history rows", {
        holdingId,
        ticker: h.ticker,
        userId,
        benchmark: benchmarkTicker,
      });
      continue;
    }

    const chronological = [...alphaRs.rows].reverse();
    const alphas = chronological.map((r) => Number(r.alpha_value));
    const latestRecordedAt = String(chronological[chronological.length - 1].recorded_at);
    const alphaDateYmd = latestRecordedAt.slice(0, 10);

    const points = chronological.map((r) => ({
      recorded_at: String(r.recorded_at),
      alpha_value: Number(r.alpha_value),
    }));
    signalsDebug("alpha tail (chronological)", { ticker: h.ticker, holdingId, alphaDateYmd, points });

    if (alphas.length >= 3) {
      const last3 = alphas.slice(-3);
      const warnRule = last3.every((a) => a < 0);
      signalsDebug("WARN rule", {
        ticker: h.ticker,
        last3,
        warnRule,
        note: "requires all three strictly < 0",
      });
      if (warnRule) {
        const exists = await signalExistsForAlphaDay(db, holdingId, "WARN", alphaDateYmd);
        if (exists) {
          signalsDebug("WARN skipped: already exists for alpha day", { ticker: h.ticker, alphaDateYmd });
        } else {
          await insertSignal(
            db,
            holdingId,
            "WARN",
            roundAlphaMetric(alphas[alphas.length - 1]!),
            alphaDateYmd,
          );
          inserted += 1;
          details.push({ holdingId, type: "WARN" });
          signalsDebug("inserted WARN", { ticker: h.ticker, runDateYmd, alphaDateYmd });
        }
      }
    } else {
      signalsDebug("WARN not evaluated: fewer than 3 alpha points", {
        ticker: h.ticker,
        n: alphas.length,
      });
    }

    if (alphas.length >= 2) {
      const prev = alphas[alphas.length - 2]!;
      const cur = alphas[alphas.length - 1]!;
      const buyRule = prev < 0 && cur > 0;
      signalsDebug("BUY rule", {
        ticker: h.ticker,
        prev,
        cur,
        buyRule,
        note: "prev day alpha < 0 and latest > 0",
      });
      if (buyRule) {
        const exists = await signalExistsForAlphaDay(db, holdingId, "BUY", alphaDateYmd);
        if (exists) {
          signalsDebug("BUY skipped: already exists for alpha day", { ticker: h.ticker, alphaDateYmd });
        } else {
          await insertSignal(db, holdingId, "BUY", roundAlphaMetric(cur), alphaDateYmd);
          inserted += 1;
          details.push({ holdingId, type: "BUY" });
          signalsDebug("inserted BUY", { ticker: h.ticker, runDateYmd, alphaDateYmd });
        }
      }
    } else {
      signalsDebug("BUY not evaluated: fewer than 2 alpha points", { ticker: h.ticker, n: alphas.length });
    }
  }

  signalsDebug("generateSignalsForUser end", { inserted, details });

  return { inserted, details, reconcile };
}
