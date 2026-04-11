/**
 * ブラウザ向け CSV（UTF-8 BOM 付き・Excel 日本語向け）。
 */

export type CsvColumnDef = {
  /** `row` のキー（ネストはドット記法: `a.b` は未対応・フラットのみ） */
  key: string;
  /** 1 行目の見出し（日本語推奨） */
  header: string;
  /** セル文字列化（省略時は既定フォーマット） */
  format?: (value: unknown, row: Record<string, unknown>) => string;
};

function escapeCsvCell(raw: string): string {
  if (raw.includes('"') || raw.includes(",") || raw.includes("\n") || raw.includes("\r")) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function defaultFormat(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) return JSON.stringify(value);
  return String(value);
}

function getByKey(row: Record<string, unknown>, key: string): unknown {
  return row[key];
}

/**
 * オブジェクト配列を CSV 文字列に変換（先頭に UTF-8 BOM）。
 */
export function buildCsvString(rows: Record<string, unknown>[], columns: CsvColumnDef[]): string {
  const headerLine = columns.map((c) => escapeCsvCell(c.header)).join(",");
  const bodyLines = rows.map((row) =>
    columns
      .map((c) => {
        const v = getByKey(row, c.key);
        const s = c.format ? c.format(v, row) : defaultFormat(v);
        return escapeCsvCell(s);
      })
      .join(","),
  );
  return `\uFEFF${[headerLine, ...bodyLines].join("\r\n")}`;
}

export function triggerCsvDownload(content: string, fileName: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName.endsWith(".csv") ? fileName : `${fileName}.csv`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * フラットな行データを CSV としてダウンロード。
 * `columns` の順序で列を出力し、`header` を 1 行目に使う。
 */
export function exportToCSV(rows: Record<string, unknown>[], fileName: string, columns: CsvColumnDef[]): void {
  if (typeof document === "undefined") return;
  const csv = buildCsvString(rows, columns);
  triggerCsvDownload(csv, fileName);
}

/** `portfolio_YYYYMMDD.csv` 形式（ローカル日付） */
export function portfolioCsvFileName(prefix = "portfolio"): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${prefix}_${y}${m}${day}.csv`;
}

/** テーマ Ecosystem / Watchlist 用。`theme_ecosystem_<ラベル>_YYYYMMDD.csv`（ファイル名に使えない文字は除去） */
export function themeEcosystemWatchlistCsvFileName(themeLabel: string): string {
  const safe = themeLabel
    .trim()
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 64);
  const slug = safe.length > 0 ? `theme_ecosystem_${safe}` : "theme_ecosystem";
  return portfolioCsvFileName(slug);
}
