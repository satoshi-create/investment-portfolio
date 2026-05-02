import {
  ECOSYSTEM_WATCHLIST_COLUMN_IDS,
  type EcosystemWatchlistColId,
} from "@/src/lib/ecosystem-watchlist-column-order";

/** LocalStorage: ユーザーが非表示にした列 ID（Asset は常に表示のため保存対象外） */
export const ECOSYSTEM_WATCHLIST_HIDDEN_STORAGE_KEY =
  "ecosystem-watchlist-hidden-columns-v1";

export const ECOSYSTEM_COLUMN_DISPLAY_PRESET_STORAGE_KEY =
  "ecosystem-watchlist-column-display-preset-v1";

export const ECOSYSTEM_WATCHLIST_COMPACT_STORAGE_KEY =
  "ecosystem-watchlist-table-compact-v1";

/** 列プリセット（フル / ミディアム / シンプル）と手動調整 */
export type EcosystemColumnDisplayPreset = "full" | "medium" | "simple" | "custom";

/** 列ピッカー・ツールチップ用の日本語ラベル */
export const ECOSYSTEM_WATCHLIST_COLUMN_LABEL_JA: Record<
  EcosystemWatchlistColId,
  string
> = {
  asset: "Asset",
  lynch: "リンチ",
  trend5d: "5D",
  listing: "初取引",
  mktCap: "MCAP",
  perfListed: "長期%",
  earnings: "決算まで",
  research: "Research",
  role: "江戸的役割",
  viScore: "VI",
  holder: "Holder",
  dividend: "配当カレンダー",
  payout: "配当性向",
  defensiveRole: "ディフェンシブ役割",
  ruleOf40: "Rule of 40",
  fcfYield: "FCF Yield",
  netCash: "ネットC",
  netCashYield: "ネットC÷MCAP",
  judgment: "判定",
  deviation: "乖離",
  drawdown: "落率",
  pe: "PE",
  pbr: "PBR",
  peg: "PEG",
  trr: "TRR",
  egrowth: "予想成長",
  eps: "EPS",
  forecastEps: "予想EPS",
  alpha: "Cum. α",
  cumTrend: "累積トレンド",
  volRatio: "Vol 比",
  ebitda: "EBITDA",
  price: "Last（価格）",
};

export function normalizeEcosystemWatchlistHidden(
  raw: unknown,
): EcosystemWatchlistColId[] {
  const allowed = new Set<string>(ECOSYSTEM_WATCHLIST_COLUMN_IDS);
  if (!Array.isArray(raw)) return [];
  const out: EcosystemWatchlistColId[] = [];
  const seen = new Set<string>();
  for (const id of raw) {
    const s = String(id);
    if (!allowed.has(s)) continue;
    if (s === "asset") continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s as EcosystemWatchlistColId);
  }
  return out;
}

export function loadEcosystemWatchlistHiddenColumns(): EcosystemWatchlistColId[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ECOSYSTEM_WATCHLIST_HIDDEN_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return normalizeEcosystemWatchlistHidden(parsed);
  } catch {
    return [];
  }
}

export function saveEcosystemWatchlistHiddenColumns(
  hidden: EcosystemWatchlistColId[],
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      ECOSYSTEM_WATCHLIST_HIDDEN_STORAGE_KEY,
      JSON.stringify(hidden),
    );
  } catch {
    /* ignore */
  }
}

const ECOSYSTEM_MEDIUM_HIDDEN: readonly EcosystemWatchlistColId[] = [
  "research",
  "role",
  "netCash",
  "netCashYield",
  "volRatio",
  "egrowth",
  "eps",
  "forecastEps",
];

const ECOSYSTEM_SIMPLE_EXTRA_HIDDEN: readonly EcosystemWatchlistColId[] = [
  "ruleOf40",
  "fcfYield",
  "pe",
  "pbr",
  "peg",
  "trr",
  "deviation",
  "drawdown",
];

function sortedEcoIdsEqual(
  a: readonly EcosystemWatchlistColId[],
  b: readonly EcosystemWatchlistColId[],
): boolean {
  if (a.length !== b.length) return false;
  const as = [...a].map(String).sort();
  const bs = [...b].map(String).sort();
  return as.every((v, i) => v === bs[i]);
}

/** Asset 以外の表示可能列に対してプリセットで非表示にする列 ID */
export function ecosystemHiddenIdsForDisplayPreset(
  preset: "full" | "medium" | "simple",
  togglableColumnIds: readonly EcosystemWatchlistColId[],
): EcosystemWatchlistColId[] {
  const allowed = new Set(togglableColumnIds);
  if (preset === "full") return [];
  const medium = ECOSYSTEM_MEDIUM_HIDDEN.filter((id) => allowed.has(id));
  if (preset === "medium") return medium;
  const simpleExtra = ECOSYSTEM_SIMPLE_EXTRA_HIDDEN.filter((id) => allowed.has(id));
  return Array.from(new Set([...medium, ...simpleExtra]));
}

export function ecosystemUserHiddenMatchesPreset(
  userHidden: readonly EcosystemWatchlistColId[],
  preset: "full" | "medium" | "simple",
  togglableColumnIds: readonly EcosystemWatchlistColId[],
): boolean {
  const canonical = ecosystemHiddenIdsForDisplayPreset(preset, togglableColumnIds);
  return sortedEcoIdsEqual(userHidden, canonical);
}

export function loadEcosystemColumnDisplayPreset(): EcosystemColumnDisplayPreset {
  if (typeof window === "undefined") return "medium";
  try {
    const raw = window.localStorage.getItem(ECOSYSTEM_COLUMN_DISPLAY_PRESET_STORAGE_KEY);
    if (raw === "full" || raw === "medium" || raw === "simple" || raw === "custom") return raw;
    return "medium";
  } catch {
    return "medium";
  }
}

export function saveEcosystemColumnDisplayPreset(preset: EcosystemColumnDisplayPreset): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ECOSYSTEM_COLUMN_DISPLAY_PRESET_STORAGE_KEY, preset);
  } catch {
    /* ignore */
  }
}

export function applyEcosystemWatchlistUserHidden(
  visibleColumnIds: EcosystemWatchlistColId[],
  hidden: EcosystemWatchlistColId[],
): EcosystemWatchlistColId[] {
  const h = new Set(hidden);
  return visibleColumnIds.filter((id) => !h.has(id));
}

/** 成長テーマ向け「一覧」プリセット: 横幅の大きいテキスト列を畳む */
export function ecosystemWatchlistOverviewHiddenGrowth(): EcosystemWatchlistColId[] {
  return ["research", "role"];
}

/** ディフェンシブ向け「一覧」プリセット */
export function ecosystemWatchlistOverviewHiddenDefensive(): EcosystemWatchlistColId[] {
  return ["defensiveRole"];
}

export function ecosystemWatchlistOverviewHiddenPreset(
  isDefensiveTheme: boolean,
): EcosystemWatchlistColId[] {
  return isDefensiveTheme
    ? ecosystemWatchlistOverviewHiddenDefensive()
    : ecosystemWatchlistOverviewHiddenGrowth();
}

export function loadEcosystemWatchlistTableCompact(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(ECOSYSTEM_WATCHLIST_COMPACT_STORAGE_KEY);
    if (raw === null) return false;
    return raw === "1" || raw === "true";
  } catch {
    return false;
  }
}

export function saveEcosystemWatchlistTableCompact(compact: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      ECOSYSTEM_WATCHLIST_COMPACT_STORAGE_KEY,
      compact ? "1" : "0",
    );
  } catch {
    /* ignore */
  }
}
