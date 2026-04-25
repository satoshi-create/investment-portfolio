/**
 * 会計（取引履歴）テーブル: 列の並びを `localStorage` に永続化（`ClosedTradesTable`）。
 */
export const CLOSED_TRADES_COL_ORDER_KEY = "logs.closedTrades.colOrder.v1";

export const CLOSED_TRADE_COLUMN_IDS = [
  "name",
  "ticker",
  "date",
  "market",
  "account",
  "side",
  "qty",
  "cost",
  "proceeds",
  "fees",
  "pnl",
  "price",
  "post",
  "reason",
  "verdict",
] as const;

export type ClosedTradeColId = (typeof CLOSED_TRADE_COLUMN_IDS)[number];

const COL_SET = new Set<string>(CLOSED_TRADE_COLUMN_IDS);

export function readClosedTradesColOrderFromStorage(): ClosedTradeColId[] {
  if (typeof window === "undefined") return [...CLOSED_TRADE_COLUMN_IDS];
  try {
    const raw = localStorage.getItem(CLOSED_TRADES_COL_ORDER_KEY);
    if (raw) {
      const a = JSON.parse(raw) as unknown;
      if (Array.isArray(a)) {
        const out: ClosedTradeColId[] = [];
        for (const x of a) {
          if (typeof x === "string" && COL_SET.has(x)) out.push(x as ClosedTradeColId);
        }
        for (const id of CLOSED_TRADE_COLUMN_IDS) {
          if (!out.includes(id)) out.push(id);
        }
        if (out.length > 0) return out;
      }
    }
  } catch {
    /* ignore */
  }
  return [...CLOSED_TRADE_COLUMN_IDS];
}

export function writeClosedTradesColOrderToStorage(next: ClosedTradeColId[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CLOSED_TRADES_COL_ORDER_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}
