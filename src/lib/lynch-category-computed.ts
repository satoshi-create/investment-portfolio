/**
 * ピーター・リンチ6分類のルールベース自動判定（Inventory / Strategy のリンチ円グラフ）。
 *
 * DB の `holdings.expectation_category` は取引フォーム等で従来通り利用可能だが、
 * Inventory 列・ツールバー集計・Strategy「リンチ分類（評価額）」は本モジュールの判定を用いる。
 *
 * 複数ルールに該当する場合の優先順位（先にマッチしたものを採用）:
 * Cyclical → Turnaround → FastGrower → Stalwart → SlowGrower → AssetPlay
 */
import { lynchCategorySortRank } from "@/src/lib/expectation-category";
import { LYNCH_CATEGORY_KEYS, type LynchCategory, type Stock } from "@/src/types/investment";

/** `holdings.market_cap` は米株を想定し USD 名目（Yahoo / 手入力のスケールと一致させる） */
const STALWART_MARKET_CAP_USD_MIN = 100_000_000_000;

/** AssetPlay: ネットキャッシュ ÷ 時価総額がこの閾値以上なら「ネットC比率が高い」とみなす */
const ASSET_PLAY_NET_CASH_TO_MCAP_MIN = 0.1;

function sectorRaw(stock: Stock): string {
  const s = (stock.sector ?? stock.secondaryTag ?? "").trim();
  return s;
}

function sectorLower(stock: Stock): string {
  return sectorRaw(stock).toLowerCase();
}

/** Yahoo 等の表記ゆれを吸収し、市況セクターに該当すれば true */
export function isLynchCyclicalSector(stock: Stock): boolean {
  const s = sectorLower(stock);
  if (!s) return false;
  if (s.includes("semiconductor")) return true;
  if (s.includes("steel")) return true;
  if (s.includes("energy") || s.includes("oil & gas") || s.includes("oil, gas")) return true;
  if (s.includes("auto") || s.includes("automobile") || s.includes("automotive") || s.includes("vehicles"))
    return true;
  return false;
}

function isTurnaround(stock: Stock): boolean {
  const t = stock.trailingEps;
  const f = stock.forwardEps;
  if (t == null || f == null || !Number.isFinite(t) || !Number.isFinite(f)) return false;
  return t < 0 && f > 0;
}

function isFastGrower(stock: Stock): boolean {
  const g = stock.expectedGrowth;
  if (g == null || !Number.isFinite(g)) return false;
  return g > 0.2;
}

function isStalwart(stock: Stock): boolean {
  const mc = stock.marketCap;
  const g = stock.expectedGrowth;
  if (mc == null || !Number.isFinite(mc) || mc <= STALWART_MARKET_CAP_USD_MIN) return false;
  if (g == null || !Number.isFinite(g)) return false;
  return g >= 0.1 && g < 0.15;
}

/** 配当あり: 年間配当レートまたは利回りのいずれかが正 */
function hasDividendSignal(stock: Stock): boolean {
  const a = stock.annualDividendRate;
  if (a != null && Number.isFinite(a) && a > 0) return true;
  const y = stock.dividendYieldPercent;
  if (y != null && Number.isFinite(y) && y > 0) return true;
  return false;
}

function isSlowGrower(stock: Stock): boolean {
  const g = stock.expectedGrowth;
  if (g == null || !Number.isFinite(g)) return false;
  if (g >= 0.05) return false;
  return hasDividendSignal(stock);
}

function isAssetPlay(stock: Stock): boolean {
  const pbr = stock.priceToBook;
  if (pbr != null && Number.isFinite(pbr) && pbr > 0 && pbr < 1) return true;
  const nc = stock.netCash;
  const mc = stock.marketCap;
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

export function getLynchCategory(stock: Stock): LynchCategory | null {
  if (isLynchCyclicalSector(stock)) return "Cyclical";
  if (isTurnaround(stock)) return "Turnaround";
  if (isFastGrower(stock)) return "FastGrower";
  if (isStalwart(stock)) return "Stalwart";
  if (isSlowGrower(stock)) return "SlowGrower";
  if (isAssetPlay(stock)) return "AssetPlay";
  return null;
}

/** Inventory ツールバー「すべて」: 母集団と優先順位の要約（`title` / ツールチップ用） */
export const LYNCH_RULE_TOOLTIP_ALL_JA =
  "リンチによる行の絞り込みを解除し、列は通常表示に戻ります。件数はダッシュボードから渡る保有一覧（Inventory の stocks・行フィルター前の全件）です。自動分類の優先順位は「市況関連 → 業績回復 → 急成長 → 優良 → 低成長 → 資産株」。DB の expectation_category は参照しません。";

/** 「未分類」バケットの説明 */
export const LYNCH_RULE_TOOLTIP_UNSET_JA =
  "上記6分類のいずれの条件も満たさない銘柄です（データ欠損で判定不能な場合も含み得ます）。DB の手動分類は使用しません。";

/**
 * 各分類ボタンのホバー説明（`getLynchCategory` の単一ルールに対応。複合時は優先順位で一つに決まります）。
 */
export const LYNCH_RULE_TOOLTIP_BY_CATEGORY_JA: Record<LynchCategory, string> = {
  Cyclical:
    "市況関連: sector またはタグ由来のセクター表記に、半導体・自動車・鉄鋼・エネルギー／石油ガス等のキーワードが含まれる場合（大小文字・表記ゆれを吸収）。優先順位は最上位。",
  Turnaround:
    "業績回復: 実績EPS（trailing）が負かつ予想EPS（forward）が正のとき。Cyclical の次に判定。",
  FastGrower:
    "急成長: 予想EPS成長率（expectedGrowth・小数）が 20% 超のとき。Turnaround より後に判定。",
  Stalwart:
    "優良: 時価総額が USD 1000 億超 かつ 予想成長率が 10% 以上 15% 未満のとき（時価は DB / Yahoo スナップの USD 名目を想定）。",
  SlowGrower:
    "低成長: 予想成長率が 5% 未満 かつ 配当あり（年間配当レートまたは配当利回りが正）のとき。",
  AssetPlay:
    "資産株: PBR が 1 未満（正の PBR のみ）、または ネットキャッシュ÷時価総額 が 10% 以上のとき。",
};

export type LynchCategoryCountSnapshot = {
  /** `stocks` 配列の件数（Inventory では行フィルター前の props 全件） */
  total: number;
  unset: number;
  byCategory: Record<LynchCategory, number>;
};

export function aggregateLynchCategoryCounts(stocks: readonly Stock[]): LynchCategoryCountSnapshot {
  let unset = 0;
  const byCategory = Object.fromEntries(LYNCH_CATEGORY_KEYS.map((k) => [k, 0])) as Record<LynchCategory, number>;
  for (const s of stocks) {
    const c = getLynchCategory(s);
    if (c == null) unset += 1;
    else byCategory[c] += 1;
  }
  return { total: stocks.length, unset, byCategory };
}

export type LynchToolbarSegmentKey = "__unset__" | LynchCategory;

/** 「すべて」以外のセグメントを件数降順で並べる（同数は `lynchCategorySortRank` 昇順＝未分類は末尾寄り） */
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
