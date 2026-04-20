/** Ecosystem map / Watchlist テーブルの列 ID（キャズム列は UI から除外）。 */
export const ECOSYSTEM_WATCHLIST_COLUMN_IDS = [
  "asset",
  "research",
  "role",
  "holder",
  "dividend",
  "defensiveRole",
  "ruleOf40",
  "fcfYield",
  "judgment",
  "deviation",
  "drawdown",
  "pe",
  "eps",
  "alpha",
  "trend",
  "last",
] as const;

export type EcosystemWatchlistColId = (typeof ECOSYSTEM_WATCHLIST_COLUMN_IDS)[number];

export const DEFAULT_ECOSYSTEM_WATCHLIST_COLUMN_ORDER: EcosystemWatchlistColId[] = [
  ...ECOSYSTEM_WATCHLIST_COLUMN_IDS,
];

export const ECOSYSTEM_WATCHLIST_COLUMN_ORDER_STORAGE_KEY =
  "ecosystem-watchlist-table-column-order-v1";

export function normalizeEcosystemWatchlistColumnOrder(
  raw: string[],
): EcosystemWatchlistColId[] {
  const allowed = new Set<string>(ECOSYSTEM_WATCHLIST_COLUMN_IDS);
  const seen = new Set<string>();
  const out: EcosystemWatchlistColId[] = [];
  for (const id of raw) {
    if (allowed.has(id) && !seen.has(id)) {
      seen.add(id);
      out.push(id as EcosystemWatchlistColId);
    }
  }
  for (const id of ECOSYSTEM_WATCHLIST_COLUMN_IDS) {
    if (!seen.has(id)) out.push(id);
  }
  return out;
}

export function loadEcosystemWatchlistColumnOrder(): EcosystemWatchlistColId[] {
  if (typeof window === "undefined") return DEFAULT_ECOSYSTEM_WATCHLIST_COLUMN_ORDER;
  try {
    const raw = localStorage.getItem(ECOSYSTEM_WATCHLIST_COLUMN_ORDER_STORAGE_KEY);
    if (!raw) return DEFAULT_ECOSYSTEM_WATCHLIST_COLUMN_ORDER;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return DEFAULT_ECOSYSTEM_WATCHLIST_COLUMN_ORDER;
    return normalizeEcosystemWatchlistColumnOrder(parsed.map(String));
  } catch {
    return DEFAULT_ECOSYSTEM_WATCHLIST_COLUMN_ORDER;
  }
}

export function saveEcosystemWatchlistColumnOrder(order: EcosystemWatchlistColId[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ECOSYSTEM_WATCHLIST_COLUMN_ORDER_STORAGE_KEY, JSON.stringify(order));
  } catch {
    /* ignore */
  }
}
