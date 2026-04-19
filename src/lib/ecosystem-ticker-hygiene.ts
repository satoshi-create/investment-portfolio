/**
 * `theme_ecosystem_members.ticker` のプレースホルダ・名称のみ・投信コード等を識別し、
 * Yahoo ファンダ取得対象から外す／銘柄サフィックスを補う。
 */

/** 会社名のみでコードが無いウォッチ行（上場コードではない） */
const PROJECT_LABEL_TICKERS = new Set(
  [
    "JERA",
    "KIOXIA",
    "TOSHIBA-EDS",
    "RENOVA",
  ].map((s) => s.toUpperCase()),
);

/**
 * 新規登録時に未上場扱いにすべきか（Yahoo 取得は `is_unlisted = 1` でスキップ）。
 */
export function ecosystemTickerShouldBeUnlisted(ticker: string): boolean {
  const raw = ticker.trim();
  if (raw.length === 0) return true;
  const u = raw.toUpperCase();
  if (u.startsWith("N/A:")) return true;
  if (u === "-" || u === "N/A") return true;
  if (PROJECT_LABEL_TICKERS.has(u)) return true;
  /** 東証投信など 8 桁のみ、または 8 桁+.T（Yahoo 株式ファンダが期待できないことが多い） */
  const noSuffix = u.replace(/\.T$/i, "");
  if (/^\d{8}$/.test(noSuffix)) return true;
  return false;
}

/** リストから物理削除してよいゴミ行（テーマ観測に残す意味がない） */
export function ecosystemTickerIsGarbageRow(ticker: string): boolean {
  const t = ticker.trim();
  if (t.length === 0) return true;
  const u = t.toUpperCase();
  return u === "-" || u === "N/A";
}

/**
 * Yahoo ファンダ・スキャン対象に含めないか（取得スクリプト側の防御）。
 * DB が未移行でも壊れたティッカーを避ける。
 */
export function ecosystemTickerExcludedFromYahooFundamentals(ticker: string): boolean {
  return ecosystemTickerShouldBeUnlisted(ticker) || ecosystemTickerIsGarbageRow(ticker);
}

/**
 * 取引所サフィックス欠落の代表的なグローバル銘柄を補正。
 * 既に `.` を含む場合はそのまま（手動で正規化済みとみなす）。
 *
 * 保守的に、実装時点で確度が高いもののみ（South32 → ASX、Repsol → Madrid）。
 */
export function normalizeTickerForYahooSymbol(raw: string): string {
  const t = raw.trim();
  if (t.length === 0) return t;
  if (t.includes(".")) return t;
  const u = t.toUpperCase();
  const FIX: Record<string, string> = {
    S32: "S32.AX",
    REP: "REP.MC",
  };
  return FIX[u] ?? t;
}
