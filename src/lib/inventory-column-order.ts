export const INVENTORY_COLUMN_IDS = [
  "asset",
  "lynch",
  "trend5d",
  "listing",
  "mktCap",
  "perfListed",
  "earnings",
  "research",
  "ruleOf40",
  "fcfYield",
  "netCash",
  "netCps",
  "judgment",
  "deviation",
  "drawdown",
  "pe",
  "pbr",
  "peg",
  "trr",
  "egrowth",
  "eps",
  "forecastEps",
  "alpha",
  "position",
  "volRatio",
  "ebitda",
  "price",
] as const;

export type InventoryColId = (typeof INVENTORY_COLUMN_IDS)[number];

/** PER/EPS は ALPHA の直前（デフォルト順） */
export const DEFAULT_COLUMN_ORDER: InventoryColId[] = [...INVENTORY_COLUMN_IDS];

export const INVENTORY_COLUMN_ORDER_STORAGE_KEY = "inventory-table-column-order-v3";

/** 旧キーからの移行用（v3 未保存ユーザー向け） */
const LEGACY_COLUMN_ORDER_KEYS = ["inventory-table-column-order-v2", "inventory-table-column-order"] as const;

export function normalizeInventoryColumnOrder(raw: string[]): InventoryColId[] {
  const allowed = new Set<string>(INVENTORY_COLUMN_IDS);
  const seen = new Set<string>();
  const out: InventoryColId[] = [];
  for (const id of raw) {
    if (id === "bookmark") continue;
    const mapped = id === "trend" ? "trend5d" : id;
    if (!allowed.has(mapped)) continue;
    if (seen.has(mapped)) continue;
    seen.add(mapped);
    out.push(mapped as InventoryColId);
  }
  for (const id of INVENTORY_COLUMN_IDS) {
    if (seen.has(id)) continue;
    if (id === "lynch") {
      const ai = out.indexOf("asset");
      if (ai >= 0) {
        out.splice(ai + 1, 0, "lynch");
        seen.add("lynch");
        continue;
      }
    }
    out.push(id);
    seen.add(id);
  }
  return out;
}

export function loadInventoryColumnOrder(): InventoryColId[] {
  if (typeof window === "undefined") return DEFAULT_COLUMN_ORDER;
  try {
    const raw = localStorage.getItem(INVENTORY_COLUMN_ORDER_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) return normalizeInventoryColumnOrder(parsed.map(String));
    }
    for (const key of LEGACY_COLUMN_ORDER_KEYS) {
      const legacy = localStorage.getItem(key);
      if (!legacy) continue;
      const parsed = JSON.parse(legacy) as unknown;
      if (!Array.isArray(parsed)) continue;
      const normalized = normalizeInventoryColumnOrder(parsed.map(String));
      saveInventoryColumnOrder(normalized);
      return normalized;
    }
    return DEFAULT_COLUMN_ORDER;
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
