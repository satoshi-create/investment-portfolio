/**
 * 左→右の公式順。`src/lib/inventory_full.csv` の 21 列を先頭に並べる。
 * CSV 外の列（lynch, listing, research, ebitda, deviation, drawdown）は
 * 基本的にプリセットで非表示にし、必要時のみ表示する。
 */
export const INVENTORY_COLUMN_IDS = [
  "asset",
  "earnings",
  "mktCap",
  "perfListed",
  "netCash",
  "netCps",
  "ruleOf40",
  "fcfYield",
  "judgment",
  "peg",
  "egrowth",
  "trr",
  "pe",
  "pbr",
  "eps",
  "forecastEps",
  "volRatio",
  "trend5d",
  "alpha",
  "price",
  "position",
  // 以下、CSV 外の列
  "lynch",
  "listing",
  "research",
  "ebitda",
  "deviation",
  "drawdown",
] as const;

export type InventoryColId = (typeof INVENTORY_COLUMN_IDS)[number];

export const DEFAULT_COLUMN_ORDER: InventoryColId[] = [...INVENTORY_COLUMN_IDS];

/**
 * v7: 画面幅確保のため「ネットC」をデフォルト非表示に。
 */
export const INVENTORY_COLUMN_ORDER_STORAGE_KEY = "inventory-table-column-order-v7";

/** v6→v5→v4→v3 以前からの移行（ユーザー順は正規化でマージ、欠落 ID は公式順で補完） */
const LEGACY_COLUMN_ORDER_KEYS = [
  "inventory-table-column-order-v6",
  "inventory-table-column-order-v5",
  "inventory-table-column-order-v4",
  "inventory-table-column-order-v3",
  "inventory-table-column-order-v2",
  "inventory-table-column-order",
] as const;

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

    // v5 移行時: 以前のユーザー設定順序を破棄し、新しい公式順（inventory_full.csv 準拠）を強制適用する。
    // 既存の LEGACY_COLUMN_ORDER_KEYS を掃除し、デフォルトを返す。
    let migrated = false;
    for (const key of LEGACY_COLUMN_ORDER_KEYS) {
      if (localStorage.getItem(key)) {
        localStorage.removeItem(key);
        migrated = true;
      }
    }
    if (migrated) {
      saveInventoryColumnOrder(DEFAULT_COLUMN_ORDER);
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
