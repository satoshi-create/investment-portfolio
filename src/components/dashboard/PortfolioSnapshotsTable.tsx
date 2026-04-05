import React from "react";
import { Table2 } from "lucide-react";

import type { PortfolioDailySnapshotRow } from "@/src/types/investment";
import { stickyTdFirst, stickyThFirst } from "@/src/components/dashboard/table-sticky";

const jpyFmt = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

function fmtPct(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

function pctClass(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "text-slate-500";
  if (v > 0) return "text-emerald-400";
  if (v < 0) return "text-rose-400";
  return "text-slate-400";
}

function fmtRecorded(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export function PortfolioSnapshotsTable({ rows }: { rows: PortfolioDailySnapshotRow[] }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      <div className="p-5 border-b border-slate-800 bg-slate-900/50 flex items-center gap-2">
        <Table2 size={16} className="text-cyan-500/90" />
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Portfolio snapshots
          </h3>
          <p className="text-[10px] text-slate-600 mt-0.5">
            DB テーブル portfolio_daily_snapshots（新しい順・同日は上書き）
          </p>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-sm text-slate-500">
          行がありません。マイグレーション適用後、<span className="font-mono text-slate-400">Record snapshot</span>{" "}
          で記録してください。
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[960px]">
            <thead className="bg-slate-950 text-slate-500 text-[10px] uppercase font-bold tracking-[0.06em]">
              <tr>
                <th className={`px-4 py-3 whitespace-nowrap min-w-[6.5rem] ${stickyThFirst}`}>日付 (UTC)</th>
                <th className="px-4 py-3 whitespace-nowrap">記録時刻</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">USD/JPY</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">VOO</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">評価額 (円)</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">含み損益 (円)</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">平均 α</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">PF 前日比</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">BM 前日比</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">α 乖離</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {rows.map((r) => (
                <tr key={r.id} className="group hover:bg-slate-800/35 transition-colors">
                  <td className={`px-4 py-2.5 font-mono text-slate-300 text-xs whitespace-nowrap min-w-[6.5rem] ${stickyTdFirst}`}>
                    {r.snapshotDate}
                  </td>
                  <td className="px-4 py-2.5 text-[11px] text-slate-500 whitespace-nowrap">
                    {fmtRecorded(r.recordedAt)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-400 text-xs">
                    {Number.isFinite(r.fxUsdJpy) ? r.fxUsdJpy.toFixed(2) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-300 text-xs">
                    {r.benchmarkClose != null && r.benchmarkClose > 0
                      ? r.benchmarkClose.toLocaleString(undefined, { maximumFractionDigits: 2 })
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-200 text-xs">
                    {jpyFmt.format(r.totalMarketValueJpy)}
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right font-mono text-xs font-medium ${
                      r.totalUnrealizedPnlJpy != null
                        ? r.totalUnrealizedPnlJpy > 0
                          ? "text-emerald-400"
                          : r.totalUnrealizedPnlJpy < 0
                            ? "text-rose-400"
                            : "text-slate-400"
                        : "text-slate-500"
                    }`}
                  >
                    {r.totalUnrealizedPnlJpy != null ? jpyFmt.format(r.totalUnrealizedPnlJpy) : "—"}
                  </td>
                  <td className={`px-4 py-2.5 text-right font-mono text-xs ${pctClass(r.portfolioAvgAlpha)}`}>
                    {fmtPct(r.portfolioAvgAlpha)}
                  </td>
                  <td className={`px-4 py-2.5 text-right font-mono text-xs ${pctClass(r.portfolioReturnVsPrevPct)}`}>
                    {fmtPct(r.portfolioReturnVsPrevPct)}
                  </td>
                  <td className={`px-4 py-2.5 text-right font-mono text-xs ${pctClass(r.benchmarkReturnVsPrevPct)}`}>
                    {fmtPct(r.benchmarkReturnVsPrevPct)}
                  </td>
                  <td className={`px-4 py-2.5 text-right font-mono text-xs font-semibold ${pctClass(r.alphaVsPrevPct)}`}>
                    {fmtPct(r.alphaVsPrevPct)}
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
