/**
 * ピーター・リンチ6分類のルールベース自動判定（Inventory / Strategy / 観測 Ecosystem）。
 *
 * DB の `expectation_category` は取引フォーム・ストーリーパネル等で設定される。
 * ルールベース自動判定は `getLynchCategory` / `getLynchCategoryFromWatchItem` のみ。
 * ダッシュのリンチ列・円グラフ等の表示用の有効分類は `lynch-display`（ルール優先、未分類時に DB を補完）を用いる。
 *
 * 複数ルールに該当する場合の優先順位（先にマッチしたものを採用）:
 * Cyclical → Turnaround → FastGrower → Stalwart → SlowGrower → AssetPlay
 */
import { lynchCategorySortRank } from "@/src/lib/expectation-category";
import {
  LYNCH_CATEGORY_KEYS,
  type LynchCategory,
  type Stock,
  type ThemeEcosystemWatchItem,
} from "@/src/types/investment";

/** `getLynchCategoryFromInput` が読むフィールドのみ（Stock / 観測行の両方からマッピング） */
export type LynchCategoryAutomationInput = {
  /** DB `holdings.sector` 相当。観測行では通常 null。 */
  sector: string | null;
  /**
   * 保有: `structure_tags` 2 番目等。観測: **`field`（分類タグ）を流用**。
   * Cyclical キーワードはここに含まれる文字列も対象。`field` は業種セクターとは限らず
   * 「AIデータセンター」等のテーマラベルになり得るため **誤って Cyclical になるリスク**がある。
   */
  secondaryTag: string;
  expectedGrowth: number | null;
  trailingEps: number | null;
  forwardEps: number | null;
  marketCap: number | null;
  priceToBook: number | null;
  annualDividendRate: number | null;
  dividendYieldPercent: number | null;
  /** 観測行は現状 null 固定（FMP ネットC を載せない限り AssetPlay の「ネットC÷時価」枝は不成立） */
  netCash: number | null;
};

export function stockToLynchInput(s: Stock): LynchCategoryAutomationInput {
  return {
    sector: s.sector,
    secondaryTag: (s.secondaryTag ?? "").trim() || "Other",
    expectedGrowth: s.expectedGrowth,
    trailingEps: s.trailingEps,
    forwardEps: s.forwardEps,
    marketCap: s.marketCap,
    priceToBook: s.priceToBook,
    annualDividendRate: s.annualDividendRate,
    dividendYieldPercent: s.dividendYieldPercent,
    netCash: s.netCash,
  };
}

export function themeEcosystemWatchItemToLynchInput(e: ThemeEcosystemWatchItem): LynchCategoryAutomationInput {
  return {
    sector: null,
    secondaryTag: e.field.trim() || "Other",
    expectedGrowth: e.expectedGrowth,
    trailingEps: e.trailingEps,
    forwardEps: e.forwardEps,
    marketCap: e.marketCap,
    priceToBook: e.priceToBook,
    annualDividendRate: e.annualDividendRate,
    dividendYieldPercent: e.dividendYieldPercent,
    netCash: e.netCash != null && Number.isFinite(e.netCash) ? e.netCash : null,
  };
}

/** `holdings.market_cap` は米株を想定し USD 名目（Yahoo / 手入力のスケールと一致させる） */
const STALWART_MARKET_CAP_USD_MIN = 100_000_000_000;

/** AssetPlay: ネットキャッシュ ÷ 時価総額がこの閾値以上なら「ネットC比率が高い」とみなす */
const ASSET_PLAY_NET_CASH_TO_MCAP_MIN = 0.1;

function sectorLowerFromInput(input: LynchCategoryAutomationInput): string {
  const s = (input.sector ?? input.secondaryTag ?? "").trim().toLowerCase();
  return s;
}

/** Yahoo 等の表記ゆれを吸収し、市況セクターに該当すれば true */
export function isLynchCyclicalSectorFromInput(input: LynchCategoryAutomationInput): boolean {
  const s = sectorLowerFromInput(input);
  if (!s) return false;
  if (s.includes("semiconductor")) return true;
  if (s.includes("steel")) return true;
  if (s.includes("energy") || s.includes("oil & gas") || s.includes("oil, gas")) return true;
  if (s.includes("auto") || s.includes("automobile") || s.includes("automotive") || s.includes("vehicles"))
    return true;
  return false;
}

/** @deprecated 互換: `isLynchCyclicalSectorFromInput(stockToLynchInput(s))` と同義 */
export function isLynchCyclicalSector(stock: Stock): boolean {
  return isLynchCyclicalSectorFromInput(stockToLynchInput(stock));
}

function isTurnaround(input: LynchCategoryAutomationInput): boolean {
  const t = input.trailingEps;
  const f = input.forwardEps;
  if (t == null || f == null || !Number.isFinite(t) || !Number.isFinite(f)) return false;
  return t < 0 && f > 0;
}

function isFastGrower(input: LynchCategoryAutomationInput): boolean {
  const g = input.expectedGrowth;
  if (g == null || !Number.isFinite(g)) return false;
  return g > 0.2;
}

function isStalwart(input: LynchCategoryAutomationInput): boolean {
  const mc = input.marketCap;
  const g = input.expectedGrowth;
  if (mc == null || !Number.isFinite(mc) || mc <= STALWART_MARKET_CAP_USD_MIN) return false;
  if (g == null || !Number.isFinite(g)) return false;
  return g >= 0.1 && g < 0.15;
}

function hasDividendSignal(input: LynchCategoryAutomationInput): boolean {
  const a = input.annualDividendRate;
  if (a != null && Number.isFinite(a) && a > 0) return true;
  const y = input.dividendYieldPercent;
  if (y != null && Number.isFinite(y) && y > 0) return true;
  return false;
}

function isSlowGrower(input: LynchCategoryAutomationInput): boolean {
  const g = input.expectedGrowth;
  if (g == null || !Number.isFinite(g)) return false;
  if (g >= 0.05) return false;
  return hasDividendSignal(input);
}

function isAssetPlay(input: LynchCategoryAutomationInput): boolean {
  const pbr = input.priceToBook;
  if (pbr != null && Number.isFinite(pbr) && pbr > 0 && pbr < 1) return true;
  const nc = input.netCash;
  const mc = input.marketCap;
  if (
    nc != null &&
    mc != null &&
    Number.isFinite(nc) &&
    Number.isFinite(mc) &&
    mc > 0 &&
    nc / mc >= ASSET_PLAY_NET_CASH_TO_MCAP_MIN
  ) {
    return true;
  }
  return false;
}

export function getLynchCategoryFromInput(input: LynchCategoryAutomationInput): LynchCategory | null {
  if (isLynchCyclicalSectorFromInput(input)) return "Cyclical";
  if (isTurnaround(input)) return "Turnaround";
  if (isFastGrower(input)) return "FastGrower";
  if (isStalwart(input)) return "Stalwart";
  if (isSlowGrower(input)) return "SlowGrower";
  if (isAssetPlay(input)) return "AssetPlay";
  return null;
}

export function getLynchCategory(stock: Stock): LynchCategory | null {
  return getLynchCategoryFromInput(stockToLynchInput(stock));
}

export function getLynchCategoryFromWatchItem(e: ThemeEcosystemWatchItem): LynchCategory | null {
  return getLynchCategoryFromInput(themeEcosystemWatchItemToLynchInput(e));
}

/** 保有・観測テーブル共通（`title` 用）。件数の母集団は呼び出し側で行フィルター前の全行。 */
export const LYNCH_RULE_TOOLTIP_ALL_JA =
  "リンチによる行の絞り込みを解除し、列は通常表示に戻ります。件数はテーブルに渡る行の全件（検索・市場フィルター等の絞り込み前）です。ルールベースの優先順位は「市況関連 → 業績回復 → 急成長 → 優良 → 低成長 → 資産株」。有効分類はルールを優先し、いずれにも当てはまらない行は DB の expectation_category（手動含む）を補完します。";

export const LYNCH_RULE_TOOLTIP_UNSET_JA =
  "上記6分類のいずれのルール条件も満たさず、かつ DB に expectation_category が無い銘柄です（データ欠損で判定不能な場合も含み得ます）。";

export const LYNCH_RULE_TOOLTIP_BY_CATEGORY_JA: Record<LynchCategory, string> = {
  Cyclical:
    "市況関連: sector またはタグ由来のセクター表記に、半導体・自動車・鉄鋼・エネルギー／石油ガス等のキーワードが含まれる場合（大小文字・表記ゆれを吸収）。観測行では `field` をセクター文字列代わりに使うためテーマラベル由来の誤検出があり得ます。優先順位は最上位。",
  Turnaround:
    "業績回復: 実績EPS（trailing）が負かつ予想EPS（forward）が正のとき。Cyclical の次に判定。",
  FastGrower:
    "急成長: 予想EPS成長率（expectedGrowth・小数）が 20% 超のとき。Turnaround より後に判定。",
  Stalwart:
    "優良: 時価総額が USD 1000 億超 かつ 予想成長率が 10% 以上 15% 未満のとき（時価は DB / Yahoo スナップの USD 名目を想定）。",
  SlowGrower:
    "低成長: 予想成長率が 5% 未満 かつ 配当あり（年間配当レートまたは配当利回りが正）のとき。",
  AssetPlay:
    "資産株: PBR が 1 未満（正の PBR のみ）、または ネットキャッシュ÷時価総額 が 10% 以上のとき。観測行はネットC未連携のため PBR 枝のみ有効になりやすい。",
};

export type LynchCategoryCountSnapshot = {
  total: number;
  unset: number;
  byCategory: Record<LynchCategory, number>;
};

export function aggregateLynchCategoryFromInputs(
  inputs: readonly LynchCategoryAutomationInput[],
): LynchCategoryCountSnapshot {
  let unset = 0;
  const byCategory = Object.fromEntries(LYNCH_CATEGORY_KEYS.map((k) => [k, 0])) as Record<LynchCategory, number>;
  for (const inp of inputs) {
    const c = getLynchCategoryFromInput(inp);
    if (c == null) unset += 1;
    else byCategory[c] += 1;
  }
  return { total: inputs.length, unset, byCategory };
}

export function aggregateLynchCategoryCounts(stocks: readonly Stock[]): LynchCategoryCountSnapshot {
  return aggregateLynchCategoryFromInputs(stocks.map(stockToLynchInput));
}

export function aggregateLynchCategoryCountsForWatchItems(
  items: readonly ThemeEcosystemWatchItem[],
): LynchCategoryCountSnapshot {
  return aggregateLynchCategoryFromInputs(items.map(themeEcosystemWatchItemToLynchInput));
}

export type LynchToolbarSegmentKey = "__unset__" | LynchCategory;

export function sortLynchToolbarSegments(snapshot: LynchCategoryCountSnapshot): LynchToolbarSegmentKey[] {
  const entries: { key: LynchToolbarSegmentKey; count: number }[] = [
    { key: "__unset__", count: snapshot.unset },
    ...LYNCH_CATEGORY_KEYS.map((k) => ({ key: k, count: snapshot.byCategory[k] })),
  ];
  entries.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    const ra = a.key === "__unset__" ? lynchCategorySortRank(null) : lynchCategorySortRank(a.key);
    const rb = b.key === "__unset__" ? lynchCategorySortRank(null) : lynchCategorySortRank(b.key);
    return ra - rb;
  });
  return entries.map((e) => e.key);
}
