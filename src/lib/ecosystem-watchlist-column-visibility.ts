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
  research: "Research",
  earnings: "決算まで",
  perfListed: "長期%",
  netCash: "ネットC",
  netCashYield: "NC/MCAP",
  ruleOf40: "Rule of 40",
  fcfYield: "FCF Yield",
  judgment: "判定",
  egrowth: "成長%",
  peg: "PEG",
  pbr: "PBR",
  trr: "TRR",
  pe: "PE",
  eps: "EPS",
  forecastEps: "予想EPS",
  volRatio: "Vol 比",
  alpha: "Cum. α",
  trend5d: "5D",
  cumTrend: "Cumulative trend",
  price: "Last",
  // 以下、CSV 外または内部用
  role: "役割",
  listing: "初取引",
  mktCap: "MCAP",
  viScore: "VI",
  holder: "Holder",
  dividend: "配当カレンダー",
  payout: "配当性向",
  defensiveRole: "ディフェンシブ役割",
  ebitda: "EBITDA",
  deviation: "乖離",
  drawdown: "落率",
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

/** フル／ミディアム／シンプルいずれでも非表示（CSV 外の列はデフォルト非表示） */
const ECOSYSTEM_ALWAYS_HIDDEN_IN_PRESETS: readonly EcosystemWatchlistColId[] = [
  "research", // ミディアム・シンプル CSV にはないため常時非表示へ
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
];

/**
 * ミディアム: `ecosystem_midiam.csv` の表示列のみ残す。
 * 畳む追加: ネットC, NC/MCAP, 成長%, EPS, 予想EPS, Vol 比。
 */
const ECOSYSTEM_MEDIUM_HIDDEN: readonly EcosystemWatchlistColId[] = [
  "netCash",
  "netCashYield",
  "egrowth",
  "eps",
  "forecastEps",
  "volRatio",
];

/**
 * シンプル: `ecosystem_simple.csv` の表示列のみ（ミディアムに加えて畳む列）。
 * 畳む追加: リンチ, 決算まで, TRR, PE (PER), Cumulative trend。
 * ※ シンプル CSV の「Alpha」はエコシステムの「alpha」に、「Price」は「price」に対応。
 */
const ECOSYSTEM_SIMPLE_EXTRA_HIDDEN: readonly EcosystemWatchlistColId[] = [
  "lynch",
  "earnings",
  "trr",
  "pe",
  "cumTrend",
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

/** 現在の「表示可能列」に対してプリセットで非表示にする列 ID */
export function ecosystemHiddenIdsForDisplayPreset(
  preset: "full" | "medium" | "simple",
  togglableColumnIds: readonly EcosystemWatchlistColId[],
): EcosystemWatchlistColId[] {
  const allowed = new Set(togglableColumnIds);
  const always = ECOSYSTEM_ALWAYS_HIDDEN_IN_PRESETS.filter((id) => allowed.has(id));

  if (preset === "full") {
    return always;
  }

  if (preset === "medium") {
    // ecosystem_midiam.csv にない列を隠す
    const mediumHidden = [
      "netCash",
      "netCashYield",
      "egrowth",
      "eps",
      "forecastEps",
      "volRatio",
    ] as EcosystemWatchlistColId[];
    return Array.from(new Set([...always, ...mediumHidden])).filter((id) => allowed.has(id));
  }

  // preset === "simple"
  // ecosystem_simple.csv にない列を隠す
  const simpleHidden = [
    "lynch",
    "earnings",
    "netCash",
    "netCashYield",
    "trr",
    "pbr",
    "forecastEps",
    "volRatio",
    "cumTrend",
  ] as EcosystemWatchlistColId[];
  return Array.from(new Set([...always, ...simpleHidden])).filter((id) => allowed.has(id));
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
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage.getItem(ECOSYSTEM_WATCHLIST_COMPACT_STORAGE_KEY);
    if (raw === null) return true; // デフォルト ON
    return raw === "1" || raw === "true";
  } catch {
    return true;
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
