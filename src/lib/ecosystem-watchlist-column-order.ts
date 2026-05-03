/**
 * Ecosystem / Watchlist テーブル列 ID。
 * 在庫表（inventory-column-order）と重なる列は同一文字列（例: asset, trend5d, pe …）。
 * ブックマークは列 ID ではなく Asset セル内の ☆ のみ（専用列なし）。
 */
/**
 * Ecosystem / Watchlist テーブル列 ID。
 * `src/lib/ecosystem_full.csv` の 22 列を先頭に厳格に並べる。
 * CSV 外の列は末尾に配置し、プリセットで非表示にする。
 */
export const ECOSYSTEM_WATCHLIST_COLUMN_IDS = [
  "asset",
  "lynch",
  "research",
  "earnings",
  "perfListed",
  "netCash",
  "netCashYield",
  "ruleOf40",
  "fcfYield",
  "judgment",
  "egrowth",
  "peg",
  "pbr",
  "trr",
  "pe",
  "eps",
  "forecastEps",
  "volRatio",
  "alpha",
  "trend5d",
  "cumTrend",
  "price",
  // 以下、CSV 外の列
  "role",
  "listing",
  "mktCap",
  "viScore",
  "holder",
  "dividend",
  "payout",
  "defensiveRole",
  "ebitda",
  "deviation",
  "drawdown",
] as const;

export type EcosystemWatchlistColId = (typeof ECOSYSTEM_WATCHLIST_COLUMN_IDS)[number];

const THEME_PAGE_EXCLUDED: ReadonlySet<EcosystemWatchlistColId> = new Set([
  "trend5d",
  "listing",
  "mktCap",
  "perfListed",
  "earnings",
]);

export const DEFAULT_ECOSYSTEM_WATCHLIST_COLUMN_ORDER: EcosystemWatchlistColId[] = [
  ...ECOSYSTEM_WATCHLIST_COLUMN_IDS,
];

export const ECOSYSTEM_WATCHLIST_COLUMN_ORDER_STORAGE_KEY =
  "ecosystem-watchlist-table-column-order-v6";

const LEGACY_ECO_ORDER_KEYS = [
  "ecosystem-watchlist-table-column-order-v5",
  "ecosystem-watchlist-table-column-order-v4",
  "ecosystem-watchlist-table-column-order-v3",
  "ecosystem-watchlist-table-column-order-v2",
  "ecosystem-watchlist-table-column-order-v1",
] as const;

/** 構造テーマ・ウォッチリスト共通: visibility で列を間引く */
export function normalizeEcosystemWatchlistColumnOrder(raw: string[]): EcosystemWatchlistColId[] {
  const allowed = new Set<string>(ECOSYSTEM_WATCHLIST_COLUMN_IDS);
  const seen = new Set<string>();
  const out: EcosystemWatchlistColId[] = [];
  for (const id of raw) {
    const mapped =
      id === "trend"
        ? "cumTrend"
        : id === "last"
          ? "price"
          : id === "bookmark"
            ? ""
            : id === "founded"
              ? "listing"
              : id;
    if (!mapped || !allowed.has(mapped)) continue;
    if (seen.has(mapped)) continue;
    seen.add(mapped);
    out.push(mapped as EcosystemWatchlistColId);
  }
  for (const cid of ECOSYSTEM_WATCHLIST_COLUMN_IDS) {
    if (seen.has(cid)) continue;
    if (cid === "lynch") {
      const ai = out.indexOf("asset");
      if (ai >= 0) {
        out.splice(ai + 1, 0, "lynch");
        seen.add("lynch");
        continue;
      }
    }
    out.push(cid);
    seen.add(cid);
  }
  return out;
}

/** 構造ページ（上場日/MCAP 等すべて利用可能） */
export function visibleEcoColumnsStructural(
  order: EcosystemWatchlistColId[],
  opts: { isDefensiveTheme: boolean; ecoShowValueCols: boolean },
): EcosystemWatchlistColId[] {
  return order.filter((id) => {
    if (id === "research" || id === "role") return !opts.isDefensiveTheme;
    if (id === "holder" || id === "dividend" || id === "payout" || id === "defensiveRole")
      return opts.isDefensiveTheme;
    if (id === "deviation" || id === "drawdown") return opts.ecoShowValueCols;
    return true;
  });
}

/** ThemePageClient（シンプル表: メタ上場日〜決算・5D トレンド列なし） */
export function visibleEcoColumnsThemePage(
  order: EcosystemWatchlistColId[],
  opts: { isDefensiveTheme: boolean; ecoShowValueCols: boolean },
): EcosystemWatchlistColId[] {
  return visibleEcoColumnsStructural(order, opts).filter((id) => !THEME_PAGE_EXCLUDED.has(id));
}

export function loadEcosystemWatchlistColumnOrder(): EcosystemWatchlistColId[] {
  if (typeof window === "undefined") return DEFAULT_ECOSYSTEM_WATCHLIST_COLUMN_ORDER;
  try {
    const raw = localStorage.getItem(ECOSYSTEM_WATCHLIST_COLUMN_ORDER_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed))
        return normalizeEcosystemWatchlistColumnOrder(parsed.map(String));
    }

    // v4 移行時: 以前のユーザー設定順序を破棄し、新しい公式順（ecosystem_full.csv 準拠）を強制適用する。
    let migrated = false;
    for (const key of LEGACY_ECO_ORDER_KEYS) {
      if (localStorage.getItem(key)) {
        localStorage.removeItem(key);
        migrated = true;
      }
    }
    if (migrated) {
      saveEcosystemWatchlistColumnOrder(DEFAULT_ECOSYSTEM_WATCHLIST_COLUMN_ORDER);
    }

    return DEFAULT_ECOSYSTEM_WATCHLIST_COLUMN_ORDER;
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
