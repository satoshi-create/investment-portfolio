import {
  INVENTORY_COLUMN_IDS,
  type InventoryColId,
} from "@/src/lib/inventory-column-order";

export const INVENTORY_HIDDEN_STORAGE_KEY = "inventory-table-hidden-columns-v1";
export const INVENTORY_COMPACT_STORAGE_KEY = "inventory-table-compact-v1";

/** 列ピッカー用（bookmark / asset は常に表示） */
export const INVENTORY_COLUMN_ALWAYS_VISIBLE: ReadonlySet<InventoryColId> = new Set([
  "bookmark",
  "asset",
]);

export const INVENTORY_COLUMN_LABEL_JA: Record<InventoryColId, string> = {
  bookmark: "ブックマーク",
  asset: "Asset",
  lynch: "リンチ",
  trend5d: "5D",
  listing: "初取引",
  mktCap: "MCAP",
  perfListed: "長期%",
  earnings: "決算まで",
  research: "Research",
  ruleOf40: "Rule of 40",
  fcfYield: "FCF Yield",
  netCash: "ネットC",
  netCps: "NC/株",
  judgment: "判定",
  deviation: "乖離",
  drawdown: "落率",
  pe: "PER",
  peg: "PEG",
  egrowth: "予想成長",
  eps: "EPS",
  alpha: "Cum. α",
  position: "比率",
  price: "Price",
};

export function normalizeInventoryHidden(raw: unknown): InventoryColId[] {
  const allowed = new Set<string>(INVENTORY_COLUMN_IDS);
  if (!Array.isArray(raw)) return [];
  const out: InventoryColId[] = [];
  const seen = new Set<string>();
  for (const id of raw) {
    const s = String(id);
    if (!allowed.has(s)) continue;
    if (INVENTORY_COLUMN_ALWAYS_VISIBLE.has(s as InventoryColId)) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s as InventoryColId);
  }
  return out;
}

export function loadInventoryHiddenColumns(): InventoryColId[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(INVENTORY_HIDDEN_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return normalizeInventoryHidden(parsed);
  } catch {
    return [];
  }
}

export function saveInventoryHiddenColumns(hidden: InventoryColId[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(INVENTORY_HIDDEN_STORAGE_KEY, JSON.stringify(hidden));
  } catch {
    /* ignore */
  }
}

export function applyInventoryUserHidden(
  visibleColumnIds: InventoryColId[],
  hidden: InventoryColId[],
): InventoryColId[] {
  const h = new Set(hidden);
  return visibleColumnIds.filter((id) => !h.has(id));
}

/** 「一覧」プリセット: Research 列の横幅を抑える */
export const INVENTORY_OVERVIEW_HIDDEN_PRESET: InventoryColId[] = ["research"];

export function loadInventoryTableCompact(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(INVENTORY_COMPACT_STORAGE_KEY);
    if (raw === null) return false;
    return raw === "1" || raw === "true";
  } catch {
    return false;
  }
}

export function saveInventoryTableCompact(compact: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(INVENTORY_COMPACT_STORAGE_KEY, compact ? "1" : "0");
  } catch {
    /* ignore */
  }
}
