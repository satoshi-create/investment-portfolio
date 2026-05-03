import {
  INVENTORY_COLUMN_IDS,
  type InventoryColId,
} from "@/src/lib/inventory-column-order";

export const INVENTORY_HIDDEN_STORAGE_KEY = "inventory-table-hidden-columns-v1";
export const INVENTORY_COLUMN_DISPLAY_PRESET_STORAGE_KEY =
  "inventory-table-column-display-preset-v1";
export const INVENTORY_COMPACT_STORAGE_KEY = "inventory-table-compact-v1";

/** 列プリセット（フル / ミディアム / シンプル）と手動調整 */
export type InventoryColumnDisplayPreset = "full" | "medium" | "simple" | "custom";

/** 列ピッカー用（Asset は常に表示） */
export const INVENTORY_COLUMN_ALWAYS_VISIBLE: ReadonlySet<InventoryColId> = new Set(["asset"]);

export const INVENTORY_COLUMN_LABEL_JA: Record<InventoryColId, string> = {
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
  pbr: "PBR",
  peg: "PEG",
  trr: "TRR",
  egrowth: "成長%",
  eps: "EPS",
  forecastEps: "予想EPS",
  alpha: "Alpha",
  position: "Position",
  volRatio: "Vol 比",
  ebitda: "EBITDA",
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

/** フル／ミディアム／シンプルいずれでも非表示（リンチ列はレンズ時のみ表示ロジックで解除。その他 CSV 外の列もデフォルト非表示） */
const INVENTORY_ALWAYS_HIDDEN_IN_PRESETS: readonly InventoryColId[] = [
  "netCash", // 画面幅確保のためデフォルト非表示
  "lynch",
  "listing",
  "research",
  "ebitda",
  "deviation",
  "drawdown",
];

/**
 * ミディアム: `inventory_midiam.csv` の表示列のみ残す。
 * 畳む追加: MCAP, 長期%, ネットC, NC/株。
 */
const INVENTORY_MEDIUM_HIDDEN: readonly InventoryColId[] = [
  "mktCap",
  "perfListed",
  "netCash",
  "netCps",
];

/**
 * シンプル: `inventory_simple.csv` の表示列のみ（ミディアムに加えて畳む列）。
 * 畳む追加: 決算まで, TRR, PBR, 予想EPS, Vol 比。
 */
const INVENTORY_SIMPLE_EXTRA_HIDDEN: readonly InventoryColId[] = [
  "earnings",
  "trr",
  "pbr",
  "forecastEps",
  "volRatio",
];

function sortedInventoryIdsEqual(a: readonly InventoryColId[], b: readonly InventoryColId[]): boolean {
  if (a.length !== b.length) return false;
  const as = [...a].map(String).sort();
  const bs = [...b].map(String).sort();
  return as.every((v, i) => v === bs[i]);
}

/** 現在の「表示可能列」に対してプリセットで非表示にする列 ID（Asset は含めない） */
export function inventoryHiddenIdsForDisplayPreset(
  preset: "full" | "medium" | "simple",
  togglableColumnIds: readonly InventoryColId[],
): InventoryColId[] {
  const allowed = new Set(togglableColumnIds);
  const always = INVENTORY_ALWAYS_HIDDEN_IN_PRESETS.filter((id) => allowed.has(id));
  if (preset === "full") return always;
  const medium = INVENTORY_MEDIUM_HIDDEN.filter((id) => allowed.has(id));
  if (preset === "medium") return Array.from(new Set([...always, ...medium]));
  const simpleExtra = INVENTORY_SIMPLE_EXTRA_HIDDEN.filter((id) => allowed.has(id));
  return Array.from(new Set([...always, ...medium, ...simpleExtra]));
}

export function inventoryUserHiddenMatchesPreset(
  userHidden: readonly InventoryColId[],
  preset: "full" | "medium" | "simple",
  togglableColumnIds: readonly InventoryColId[],
): boolean {
  const canonical = inventoryHiddenIdsForDisplayPreset(preset, togglableColumnIds);
  return sortedInventoryIdsEqual(userHidden, canonical);
}

export function loadInventoryColumnDisplayPreset(): InventoryColumnDisplayPreset {
  if (typeof window === "undefined") return "medium";
  try {
    const raw = window.localStorage.getItem(INVENTORY_COLUMN_DISPLAY_PRESET_STORAGE_KEY);
    if (raw === "full" || raw === "medium" || raw === "simple" || raw === "custom") return raw;
    return "medium";
  } catch {
    return "medium";
  }
}

export function saveInventoryColumnDisplayPreset(preset: InventoryColumnDisplayPreset): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(INVENTORY_COLUMN_DISPLAY_PRESET_STORAGE_KEY, preset);
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

/** @deprecated 旧「一覧」プリセット。`inventoryHiddenIdsForDisplayPreset("medium", …)` を参照 */
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
