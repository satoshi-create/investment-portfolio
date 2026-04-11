"use client";

import React, { useState } from "react";
import { ChevronDown, FileSpreadsheet, Table2 } from "lucide-react";

import { MarketBar } from "@/src/components/dashboard/MarketBar";
import { PORTFOLIO_SNAPSHOT_CSV_COLUMNS, portfolioSnapshotsToCsvRows } from "@/src/lib/csv-dashboard-presets";
import { exportToCSV, portfolioCsvFileName } from "@/src/lib/csv-export";
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
  if (v == null || !Number.isFinite(v)) return "text-muted-foreground";
  if (v > 0) return "text-emerald-400";
  if (v < 0) return "text-rose-400";
  return "text-muted-foreground";
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

const COL_COUNT = 14;

function jpyPnlCellClass(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "text-slate-500";
  if (v > 0) return "text-emerald-400";
  if (v < 0) return "text-rose-400";
  return "text-slate-400";
}

export function PortfolioSnapshotsTable({ rows }: { rows: PortfolioDailySnapshotRow[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-2xl">
      <div className="p-5 border-b border-border bg-card/60 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <Table2 size={16} className="text-cyan-500/90 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              Portfolio snapshots
            </h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              portfolio_daily_snapshots + market_glance_snapshots。合計損益・コストは{" "}
              <span className="font-mono text-muted-foreground/90">total_profit</span> /{" "}
              <span className="font-mono text-muted-foreground/90">cost_basis</span>（トップの Total profit / Cost basis
              と同義）
            </p>
          </div>
        </div>
        {rows.length > 0 ? (
          <button
            type="button"
            onClick={() =>
              exportToCSV(
                portfolioSnapshotsToCsvRows(rows),
                portfolioCsvFileName("portfolio_snapshots"),
                PORTFOLIO_SNAPSHOT_CSV_COLUMNS,
              )
            }
            className="inline-flex items-center gap-1.5 shrink-0 text-[10px] font-bold uppercase tracking-wide text-muted-foreground border border-border px-3 py-2 rounded-lg hover:bg-muted/50 transition-all"
            title="表示中のスナップショット行を CSV でダウンロード"
          >
            <FileSpreadsheet size={14} />
            CSV
          </button>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-sm text-muted-foreground">
          行がありません。マイグレーション適用後、<span className="font-mono text-muted-foreground/90">Record snapshot</span>{" "}
          で記録してください。
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[1240px]">
            <thead className="bg-background text-muted-foreground text-[10px] uppercase font-bold tracking-[0.06em]">
              <tr>
                <th className={`px-4 py-3 whitespace-nowrap min-w-[6.5rem] ${stickyThFirst}`}>日付 (UTC)</th>
                <th className="px-4 py-3 whitespace-nowrap">記録時刻</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">USD/JPY</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">VOO</th>
                <th className="px-4 py-3 text-right whitespace-nowrap" title="記録時点の VOO 当日騰落 %（前スナップ比ではない）">
                  VOO当日%
                </th>
                <th className="px-4 py-3 text-right whitespace-nowrap">評価額 (円)</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">含み損益 (円)</th>
                <th
                  className="px-4 py-3 text-right whitespace-nowrap"
                  title="DB: total_profit。ダッシュ Total profit と同じ（含み損益＋確定損益）"
                >
                  合計損益 (円)
                </th>
                <th
                  className="px-4 py-3 text-right whitespace-nowrap"
                  title="DB: cost_basis。ダッシュ Cost basis と同じ（各銘柄 評価額−含み の合計）"
                >
                  コスト (円)
                </th>
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
                      <td className={`px-4 py-2.5 text-right font-mono text-xs ${pctClass(r.benchmarkChangePct)}`}>
                        {fmtPct(r.benchmarkChangePct)}
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
                      <td
                        className={`px-4 py-2.5 text-right font-mono text-xs font-medium ${jpyPnlCellClass(r.totalProfitJpy)}`}
                        title={r.totalProfitJpy != null ? `total_profit: ${r.totalProfitJpy}` : "total_profit 未記録（015 未適用または旧行）"}
                      >
                        {r.totalProfitJpy != null ? jpyFmt.format(r.totalProfitJpy) : "—"}
                      </td>
                      <td
                        className="px-4 py-2.5 text-right font-mono text-slate-200 text-xs"
                        title={r.costBasisJpy != null ? `cost_basis: ${r.costBasisJpy}` : "cost_basis 未記録（015 未適用または旧行）"}
                      >
                        {r.costBasisJpy != null ? jpyFmt.format(r.costBasisJpy) : "—"}
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
                          className="flex w-full max-w-[11rem] items-center justify-between gap-1 rounded-lg border border-border bg-background/60 px-2 py-1.5 text-left text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          aria-expanded={open}
                        >
                          <span className="truncate font-mono text-muted-foreground" title={marketSummary(r.marketIndicators)}>
                            {marketSummary(r.marketIndicators)}
                          </span>
                          <ChevronDown
                            size={14}
                            className={`shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
                            aria-hidden
                          />
                        </button>
                      </td>
                    </tr>
                    {open ? (
                      <tr className="bg-background/40">
                        <td colSpan={COL_COUNT} className="px-4 py-3 border-t border-border">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                            Market glance（記録時点）
                          </p>
                          {r.marketIndicators == null ? (
                            <p className="text-xs text-muted-foreground">
                              この日の市場指標は未記録です（009 適用前のスナップショットなど）。
                            </p>
                          ) : r.marketIndicators.length === 0 ? (
                            <p className="text-xs text-muted-foreground">記録はありますが指標が空です（取得失敗時など）。</p>
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
