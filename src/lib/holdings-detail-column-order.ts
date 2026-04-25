/**
 * Portfolio accounting（保有明細）テーブル: 列の並びを `localStorage` に永続化（`HoldingsDetailTable`）。
 */
export const HOLDINGS_DETAIL_COL_ORDER_KEY = "dashboard.holdingsDetail.colOrder.v1";

export const HOLDINGS_DETAIL_COLUMN_IDS = [
  "ticker",
  "market",
  "sector",
  "research",
  "qty",
  "avg",
  "price",
  "day",
  "mv",
  "pnl",
  "pnlpct",
  "shortRules",
  "cat",
] as const;

export type HoldingsDetailColId = (typeof HOLDINGS_DETAIL_COLUMN_IDS)[number];

const COL_SET = new Set<string>(HOLDINGS_DETAIL_COLUMN_IDS);

export function readHoldingsDetailColOrderFromStorage(): HoldingsDetailColId[] {
  if (typeof window === "undefined") return [...HOLDINGS_DETAIL_COLUMN_IDS];
  try {
    const raw = localStorage.getItem(HOLDINGS_DETAIL_COL_ORDER_KEY);
    if (raw) {
      const a = JSON.parse(raw) as unknown;
      if (Array.isArray(a)) {
        const out: HoldingsDetailColId[] = [];
        for (const x of a) {
          if (typeof x === "string" && COL_SET.has(x)) out.push(x as HoldingsDetailColId);
        }
        for (const id of HOLDINGS_DETAIL_COLUMN_IDS) {
          if (!out.includes(id)) out.push(id);
        }
        if (out.length > 0) return out;
      }
    }
  } catch {
    /* ignore */
  }
  return [...HOLDINGS_DETAIL_COLUMN_IDS];
}

export function writeHoldingsDetailColOrderToStorage(next: HoldingsDetailColId[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(HOLDINGS_DETAIL_COL_ORDER_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}
