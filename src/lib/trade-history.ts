import type { Client } from "@libsql/client";

import { roundAlphaMetric } from "@/src/lib/alpha-logic";
import { USD_JPY_RATE_FALLBACK } from "@/src/lib/fx-constants";
import { fetchLatestPrice, fetchUsdJpyRate } from "@/src/lib/price-service";
import type { ClosedTradeDashboardRow } from "@/src/types/investment";

type TradeRowDb = {
  id: string;
  tradeDate: string;
  ticker: string;
  name: string;
  market: "JP" | "US";
  accountName: string;
  side: "BUY" | "SELL";
  quantity: number;
  costJpy: number;
  proceedsJpy: number;
  feesJpy: number;
  realizedPnlJpy: number;
  providerSymbol: string | null;
};

function parseMarket(raw: string): "JP" | "US" {
  return raw === "JP" ? "JP" : "US";
}

function parseSide(raw: string): "BUY" | "SELL" {
  return raw === "BUY" ? "BUY" : "SELL";
}

function currentPriceJpyFromQuote(
  market: "JP" | "US",
  closeUsdOrJpy: number,
  fxUsdJpy: number,
): number {
  if (!Number.isFinite(closeUsdOrJpy) || closeUsdOrJpy <= 0) return NaN;
  if (market === "JP") return closeUsdOrJpy;
  const fx = Number.isFinite(fxUsdJpy) && fxUsdJpy > 0 ? fxUsdJpy : USD_JPY_RATE_FALLBACK;
  return closeUsdOrJpy * fx;
}

function postExitMetrics(
  market: "JP" | "US",
  quantity: number,
  proceedsJpy: number,
  closeRaw: number | null,
  fxUsdJpy: number,
): { exitPerUnitJpy: number; currentPriceJpy: number | null; postExitReturnPct: number | null } {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { exitPerUnitJpy: NaN, currentPriceJpy: null, postExitReturnPct: null };
  }
  const exitPerUnitJpy = proceedsJpy / quantity;
  if (!Number.isFinite(exitPerUnitJpy) || exitPerUnitJpy <= 0) {
    return { exitPerUnitJpy, currentPriceJpy: null, postExitReturnPct: null };
  }
  if (closeRaw == null || !Number.isFinite(closeRaw) || closeRaw <= 0) {
    return { exitPerUnitJpy, currentPriceJpy: null, postExitReturnPct: null };
  }
  const currentJpy = currentPriceJpyFromQuote(market, closeRaw, fxUsdJpy);
  if (!Number.isFinite(currentJpy) || currentJpy <= 0) {
    return { exitPerUnitJpy, currentPriceJpy: null, postExitReturnPct: null };
  }
  const pct = ((currentJpy - exitPerUnitJpy) / exitPerUnitJpy) * 100;
  return {
    exitPerUnitJpy,
    currentPriceJpy: currentJpy,
    postExitReturnPct: Number.isFinite(pct) ? roundAlphaMetric(pct) : null,
  };
}

function verdictLabel(pct: number | null): string {
  if (pct == null || !Number.isFinite(pct)) return "—";
  if (pct > 0) return "🚨 痛恨";
  if (pct < 0) return "✅ 英断";
  return "—";
}

async function loadTradeRows(db: Client, userId: string): Promise<TradeRowDb[]> {
  const rs = await db.execute({
    sql: `SELECT id, trade_date, ticker, name, market, account_name, side, quantity,
                 cost_jpy, proceeds_jpy, fees_jpy, realized_pnl_jpy, provider_symbol
          FROM trade_history
          WHERE user_id = ? AND side = 'SELL'
          ORDER BY trade_date DESC, ticker ASC`,
    args: [userId],
  });
  return rs.rows.map((row) => ({
    id: String(row.id),
    tradeDate: String(row.trade_date),
    ticker: String(row.ticker),
    name: row.name != null ? String(row.name) : "",
    market: parseMarket(String(row.market)),
    accountName: row.account_name != null ? String(row.account_name) : "特定",
    side: parseSide(String(row.side)),
    quantity: Number(row.quantity),
    costJpy: Number(row.cost_jpy),
    proceedsJpy: Number(row.proceeds_jpy),
    feesJpy: row.fees_jpy != null ? Number(row.fees_jpy) : 0,
    realizedPnlJpy: Number(row.realized_pnl_jpy),
    providerSymbol:
      row.provider_symbol != null && String(row.provider_symbol).length > 0
        ? String(row.provider_symbol)
        : null,
  }));
}

/**
 * 売却行のみ。Yahoo から最新終値を取得し、売却後騰落率・判定を付与。テーブル未作成時は []。
 */
export async function fetchClosedTradesForDashboard(
  db: Client,
  userId: string,
): Promise<ClosedTradeDashboardRow[]> {
  let fxUsdJpy = USD_JPY_RATE_FALLBACK;
  try {
    const snap = await fetchUsdJpyRate();
    if (snap != null && Number.isFinite(snap.rate) && snap.rate > 0) fxUsdJpy = snap.rate;
  } catch {
    /* keep fallback */
  }

  let rows: TradeRowDb[];
  try {
    rows = await loadTradeRows(db, userId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("no such table") || msg.toLowerCase().includes("trade_history")) {
      return [];
    }
    throw e;
  }

  const priceKey = (t: TradeRowDb) =>
    `${t.ticker.trim()}\u0000${t.providerSymbol ?? ""}`;
  const unique = new Map<string, TradeRowDb>();
  for (const t of rows) unique.set(priceKey(t), t);

  const priceByKey = new Map<string, number | null>();
  const entries = [...unique.values()];
  const batchSize = 3;
  for (let i = 0; i < entries.length; i += batchSize) {
    const slice = entries.slice(i, i + batchSize);
    await Promise.all(
      slice.map(async (t) => {
        const key = priceKey(t);
        const snap = await fetchLatestPrice(t.ticker, t.providerSymbol);
        priceByKey.set(key, snap != null && Number.isFinite(snap.close) && snap.close > 0 ? snap.close : null);
      }),
    );
    if (i + batchSize < entries.length) {
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  return rows.map((t): ClosedTradeDashboardRow => {
    const key = priceKey(t);
    const closeRaw = priceByKey.get(key) ?? null;
    const { currentPriceJpy, postExitReturnPct } = postExitMetrics(
      t.market,
      t.quantity,
      t.proceedsJpy,
      closeRaw,
      fxUsdJpy,
    );
    return {
      id: t.id,
      tradeDate: t.tradeDate,
      ticker: t.ticker,
      name: t.name,
      market: t.market,
      accountName: t.accountName,
      side: t.side,
      quantity: t.quantity,
      costJpy: t.costJpy,
      proceedsJpy: t.proceedsJpy,
      feesJpy: t.feesJpy,
      realizedPnlJpy: t.realizedPnlJpy,
      currentPriceJpy,
      postExitReturnPct,
      verdictLabel: verdictLabel(postExitReturnPct),
    };
  });
}
