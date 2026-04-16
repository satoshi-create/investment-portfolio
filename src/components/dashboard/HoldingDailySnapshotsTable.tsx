"use client";

import React, { useMemo } from "react";
import { FileSpreadsheet, Layers } from "lucide-react";

import type { HoldingDailySnapshotRow, TickerInstrumentKind } from "@/src/types/investment";
import { HOLDING_SNAPSHOT_CSV_COLUMNS, holdingSnapshotsToCsvRows } from "@/src/lib/csv-dashboard-presets";
import { exportToCSV, portfolioCsvFileName } from "@/src/lib/csv-export";
import { stickyTdFirst, stickyThFirst } from "@/src/components/dashboard/table-sticky";

const jpyFmt = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

function marketLabel(kind: TickerInstrumentKind): string {
  if (kind === "US_EQUITY") return "米国株";
  if (kind === "JP_LISTED_EQUITY") return "日本株";
  return "日本投信";
}

function formatPriceLocal(kind: TickerInstrumentKind, price: number | null): string {
  if (price == null || !Number.isFinite(price) || price <= 0) return "—";
  if (kind === "US_EQUITY") return `$${price.toFixed(2)}`;
  return new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 2 }).format(price);
}

function signedPctClass(v: number | null): string {
  if (v == null) return "text-muted-foreground";
  if (v > 0) return "text-emerald-400";
  if (v < 0) return "text-rose-400";
  return "text-muted-foreground";
}

function signedValueClass(v: number): string {
  if (v > 0) return "text-emerald-400";
  if (v < 0) return "text-rose-400";
  return "text-muted-foreground";
}

function formatSignedPercent(v: number | null): string {
  if (v == null) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

type Props = {
  snapshotDate: string | null;
  rows: HoldingDailySnapshotRow[];
};

export function HoldingDailySnapshotsTable({ snapshotDate, rows }: Props) {
  const distinctSnapshotDays = useMemo(
    () => new Set(rows.map((r) => r.snapshotDate)).size,
    [rows],
  );
  const latestSnapshotDate = useMemo(() => {
    if (snapshotDate) return snapshotDate;
    let max = "";
    for (const r of rows) {
      const d = r.snapshotDate;
      if (typeof d === "string" && d.length > 0 && (max.length === 0 || d > max)) max = d;
    }
    return max.length > 0 ? max : null;
  }, [rows, snapshotDate]);

  // Table shows latest day slice only; CSV exports all rows.
  const displayRows = useMemo(
    () => (latestSnapshotDate ? rows.filter((r) => r.snapshotDate === latestSnapshotDate) : rows),
    [latestSnapshotDate, rows],
  );

  const bench = displayRows[0]?.benchmarkClose;
  const fx = displayRows[0]?.fxUsdJpy;

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-2xl">
      <div className="p-5 border-b border-border bg-card/60 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <Layers size={16} className="text-violet-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              Holding snapshots (銘柄×日)
            </h3>
            <p className="text-[10px] text-muted-foreground mt-1">
              最新日のスライスを表示（CSV は全期間）。`holding_daily_snapshots` 記録（
              {rows.length > 0 ? (
                <>
                  <span className="font-mono text-muted-foreground/90">{distinctSnapshotDays}</span> 日分 ·{" "}
                  {rows.length} 行
                </>
              ) : (
                "0 行"
              )}
              ）
              {latestSnapshotDate ? (
                <span className="text-muted-foreground/90 font-mono"> · 表示 UTC {latestSnapshotDate}</span>
              ) : null}
              {bench != null && bench > 0 ? (
                <span className="text-muted-foreground/90">
                  {" "}
                  · VOO {bench.toFixed(2)} · FX {fx?.toFixed(0) ?? "—"}
                </span>
              ) : null}
            </p>
          </div>
        </div>
        {rows.length > 0 ? (
          <button
            type="button"
            onClick={() =>
              exportToCSV(
                holdingSnapshotsToCsvRows(rows),
                portfolioCsvFileName("holding_snapshots"),
                HOLDING_SNAPSHOT_CSV_COLUMNS,
              )
            }
            className="inline-flex items-center gap-1.5 shrink-0 text-[10px] font-bold uppercase tracking-wide text-muted-foreground border border-border px-3 py-2 rounded-lg hover:bg-muted/50 transition-all"
            title="記録されたすべてのスナップショット日の行を CSV でダウンロード（スナップショット日付列あり）"
          >
            <FileSpreadsheet size={14} />
            CSV
          </button>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-sm text-muted-foreground">
          データがありません。マイグレーション適用後に{" "}
          <span className="font-mono text-muted-foreground/90">Record snapshot</span> を実行してください。
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[1120px]">
            <thead className="bg-background text-muted-foreground text-[10px] uppercase font-bold tracking-[0.06em]">
              <tr>
                <th className={`px-4 py-3 whitespace-nowrap min-w-[10rem] max-w-[12rem] ${stickyThFirst}`}>
                  銘柄 / コード
                </th>
                <th className="px-4 py-3 whitespace-nowrap font-mono text-[10px]">スナップショット日</th>
                <th className="px-4 py-3 whitespace-nowrap">市場</th>
                <th className="px-4 py-3 whitespace-nowrap">業界</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">数量</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">取得単価</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">終値</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">前日比</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">評価額（円）</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">損益（円）</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">損益率</th>
                <th className="px-4 py-3 whitespace-nowrap">Cat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {displayRows.map((r) => (
                <tr key={r.id} className="group hover:bg-slate-800/35 transition-colors">
                  <td className={`px-4 py-2.5 whitespace-nowrap min-w-[10rem] max-w-[12rem] ${stickyTdFirst}`}>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-slate-100 max-w-[11rem] truncate" title={r.name || r.ticker}>
                        {r.name || r.ticker}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">{r.ticker}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-slate-400 text-xs font-mono whitespace-nowrap" title={r.recordedAt}>
                    {r.snapshotDate}
                  </td>
                  <td className="px-4 py-2.5 text-slate-400 text-xs">{marketLabel(r.instrumentKind)}</td>
                  <td className="px-4 py-2.5 text-slate-400 text-xs max-w-[120px] truncate" title={r.secondaryTag}>
                    {r.secondaryTag}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-300 text-xs">{r.quantity}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-300 text-xs">
                    {formatPriceLocal(r.instrumentKind, r.avgAcquisitionPrice)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-300 text-xs">
                    {formatPriceLocal(r.instrumentKind, r.closePrice)}
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right font-mono text-xs font-medium ${signedPctClass(r.dayChangePct)}`}
                  >
                    {formatSignedPercent(r.dayChangePct)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-200 text-xs">
                    {r.marketValueJpy > 0 ? jpyFmt.format(r.marketValueJpy) : "—"}
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right font-mono text-xs font-medium ${signedValueClass(r.unrealizedPnlJpy ?? 0)}`}
                  >
                    {r.avgAcquisitionPrice != null && r.closePrice != null && r.closePrice > 0 ? (
                      <>
                        {(r.unrealizedPnlJpy ?? 0) > 0 ? "+" : ""}
                        {jpyFmt.format(r.unrealizedPnlJpy ?? 0)}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right font-mono text-xs font-medium ${signedPctClass(r.unrealizedPnlPct)}`}
                  >
                    {r.avgAcquisitionPrice != null && r.closePrice != null && r.closePrice > 0
                      ? formatSignedPercent(r.unrealizedPnlPct)
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-[10px] font-semibold text-slate-500 whitespace-nowrap">
                    {r.category === "Core" ? "Core" : "Sat"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
