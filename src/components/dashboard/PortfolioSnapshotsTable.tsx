"use client";

import React, { useState } from "react";
import { ChevronDown, Table2 } from "lucide-react";

import { MarketBar } from "@/src/components/dashboard/MarketBar";
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

function marketSummary(indicators: PortfolioDailySnapshotRow["marketIndicators"]): string {
  if (indicators == null) return "—";
  if (indicators.length === 0) return "（空）";
  const usdJpy = indicators.find((m) => m.label === "USD/JPY");
  const vix = indicators.find((m) => m.label === "VIX");
  const parts: string[] = [];
  if (usdJpy && usdJpy.value >= 0) parts.push(`U/J ${usdJpy.value.toFixed(2)}`);
  if (vix && vix.value >= 0) parts.push(`VIX ${vix.value.toFixed(1)}`);
  return parts.length > 0 ? parts.join(" · ") : `${indicators.length} 指標`;
}

const COL_COUNT = 11;

export function PortfolioSnapshotsTable({ rows }: { rows: PortfolioDailySnapshotRow[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      <div className="p-5 border-b border-slate-800 bg-slate-900/50 flex items-center gap-2">
        <Table2 size={16} className="text-cyan-500/90" />
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Portfolio snapshots
          </h3>
          <p className="text-[10px] text-slate-600 mt-0.5">
            DB テーブル portfolio_daily_snapshots + market_glance_snapshots（新しい順・同日は上書き）
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
          <table className="w-full text-left text-sm min-w-[1020px]">
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
                <th className="px-4 py-3 whitespace-nowrap min-w-[7rem]">Market</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {rows.map((r) => {
                const open = expandedId === r.id;
                return (
                  <React.Fragment key={r.id}>
                    <tr className="group hover:bg-slate-800/35 transition-colors">
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
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => setExpandedId(open ? null : r.id)}
                          className="flex w-full max-w-[11rem] items-center justify-between gap-1 rounded-lg border border-slate-700/80 bg-slate-950/50 px-2 py-1.5 text-left text-[10px] text-slate-400 transition-colors hover:border-slate-600 hover:bg-slate-800/50 hover:text-slate-200"
                          aria-expanded={open}
                        >
                          <span className="truncate font-mono text-slate-500" title={marketSummary(r.marketIndicators)}>
                            {marketSummary(r.marketIndicators)}
                          </span>
                          <ChevronDown
                            size={14}
                            className={`shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
                            aria-hidden
                          />
                        </button>
                      </td>
                    </tr>
                    {open ? (
                      <tr className="bg-slate-950/40">
                        <td colSpan={COL_COUNT} className="px-4 py-3 border-t border-slate-800/60">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                            Market glance（記録時点）
                          </p>
                          {r.marketIndicators == null ? (
                            <p className="text-xs text-slate-500">
                              この日の市場指標は未記録です（009 適用前のスナップショットなど）。
                            </p>
                          ) : r.marketIndicators.length === 0 ? (
                            <p className="text-xs text-slate-500">記録はありますが指標が空です（取得失敗時など）。</p>
                          ) : (
                            <MarketBar indicators={r.marketIndicators} showTitle={false} layout="modal" />
                          )}
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
