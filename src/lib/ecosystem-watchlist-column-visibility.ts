import {
  ECOSYSTEM_WATCHLIST_COLUMN_IDS,
  type EcosystemWatchlistColId,
} from "@/src/lib/ecosystem-watchlist-column-order";

/** LocalStorage: ユーザーが非表示にした列 ID（Asset は常に表示のため保存対象外） */
export const ECOSYSTEM_WATCHLIST_HIDDEN_STORAGE_KEY =
  "ecosystem-watchlist-hidden-columns-v1";

export const ECOSYSTEM_WATCHLIST_COMPACT_STORAGE_KEY =
  "ecosystem-watchlist-table-compact-v1";

/** 列ピッカー・ツールチップ用の日本語ラベル */
export const ECOSYSTEM_WATCHLIST_COLUMN_LABEL_JA: Record<
  EcosystemWatchlistColId,
  string
> = {
  asset: "Asset",
  trend5d: "5D",
  listing: "初取引",
  mktCap: "MCAP",
  perfListed: "長期%",
  earnings: "決算まで",
  research: "Research",
  role: "江戸的役割",
  holder: "Holder",
  dividend: "配当カレンダー",
  payout: "配当性向",
  defensiveRole: "ディフェンシブ役割",
  ruleOf40: "Rule of 40",
  fcfYield: "FCF Yield",
  judgment: "判定",
  deviation: "乖離",
  drawdown: "落率",
  pe: "PE",
  peg: "PEG",
  egrowth: "予想成長",
  eps: "EPS",
  alpha: "Cum. α",
  cumTrend: "累積トレンド",
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
