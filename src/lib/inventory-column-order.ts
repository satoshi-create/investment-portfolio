export const INVENTORY_COLUMN_IDS = [
  "asset",
  "research",
  "ruleOf40",
  "fcfYield",
  "judgment",
  "deviation",
  "drawdown",
  "pe",
  "eps",
  "alpha",
  "trend",
  "position",
  "price",
] as const;

export type InventoryColId = (typeof INVENTORY_COLUMN_IDS)[number];

/** PER/EPS は ALPHA の直前（デフォルト順） */
export const DEFAULT_COLUMN_ORDER: InventoryColId[] = [...INVENTORY_COLUMN_IDS];

export const INVENTORY_COLUMN_ORDER_STORAGE_KEY = "inventory-table-column-order-v1";

export function normalizeInventoryColumnOrder(raw: string[]): InventoryColId[] {
  const allowed = new Set<string>(INVENTORY_COLUMN_IDS);
  const seen = new Set<string>();
  const out: InventoryColId[] = [];
  for (const id of raw) {
    if (allowed.has(id) && !seen.has(id)) {
      seen.add(id);
      out.push(id as InventoryColId);
    }
  }
  for (const id of INVENTORY_COLUMN_IDS) {
    if (!seen.has(id)) out.push(id);
  }
  return out;
}

export function loadInventoryColumnOrder(): InventoryColId[] {
  if (typeof window === "undefined") return DEFAULT_COLUMN_ORDER;
  try {
    const raw = localStorage.getItem(INVENTORY_COLUMN_ORDER_STORAGE_KEY);
    if (!raw) return DEFAULT_COLUMN_ORDER;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return DEFAULT_COLUMN_ORDER;
    return normalizeInventoryColumnOrder(parsed.map(String));
  } catch {
    return DEFAULT_COLUMN_ORDER;
  }
}

export function saveInventoryColumnOrder(order: InventoryColId[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(INVENTORY_COLUMN_ORDER_STORAGE_KEY, JSON.stringify(order));
  } catch {
    /* ignore quota / private mode */
  }
}
