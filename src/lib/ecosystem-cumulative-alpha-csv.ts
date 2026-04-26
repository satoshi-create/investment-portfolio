import type { ThemeEcosystemWatchItem } from "@/src/types/investment";
import { buildCsvString, triggerCsvDownload } from "@/src/lib/csv-export";

const COLUMNS = [
  { key: "observationDate", header: "観測日" },
  { key: "cumulativeAlphaPct", header: "累積Alpha_pct" },
] as const;

/**
 * 累積 Alpha 全観測点を CSV（UTF-8 BOM）で保存。日付列は `alphaCumulativeObservationDates`、
 * 値列は `alphaHistory`（同長でない場合は短い方に合わせる）。
 */
export function downloadEcosystemCumulativeAlphaCsv(
  e: ThemeEcosystemWatchItem,
  opts?: { themeLabel?: string },
): void {
  const dates = e.alphaCumulativeObservationDates ?? [];
  const vals = e.alphaHistory ?? [];
  const n = Math.min(dates.length, vals.length);
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < n; i += 1) {
    const d = dates[i]!;
    const v = vals[i]!;
    rows.push({
      observationDate: d,
      cumulativeAlphaPct: Number.isFinite(v) ? v : "",
    });
  }
  const tick = (e.ticker ?? "ticker").replace(/[^\w.-]+/g, "_");
  const day = new Date().toISOString().slice(0, 10);
  const themePart = opts?.themeLabel ? `_${opts.themeLabel.replace(/[^\w\u3000-\u30ff\u4e00-\u9faf.-]+/g, "_").slice(0, 40)}` : "";
  const fileName = `cumulative_alpha_${tick}${themePart}_${day}.csv`;
  const csv = buildCsvString(rows, [...COLUMNS]);
  triggerCsvDownload(csv, fileName);
}
