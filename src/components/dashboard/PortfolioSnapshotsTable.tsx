"use client";

import React, { useMemo, useState } from "react";
import { ChevronDown, FileSpreadsheet, Table2 } from "lucide-react";

import { MarketBar } from "@/src/components/dashboard/MarketBar";
import { PORTFOLIO_SNAPSHOT_CSV_COLUMNS, portfolioSnapshotsToCsvRows } from "@/src/lib/csv-dashboard-presets";
import { exportToCSV, portfolioCsvFileName } from "@/src/lib/csv-export";
import type { HoldingDailySnapshotRow, PortfolioDailySnapshotRow } from "@/src/types/investment";
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

function finiteNumbers<T>(items: T[], pick: (row: T) => number | null | undefined): number[] {
  const out: number[] = [];
  for (const row of items) {
    const v = pick(row);
    if (v != null && Number.isFinite(v)) out.push(v);
  }
  return out;
}

function average(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function compareSnapshotDate(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true });
}

type SnapshotStats = {
  count: number;
  dateMin: string;
  dateMax: string;
  profitDeltaJpy: number | null;
  marketValueDeltaJpy: number | null;
  avgPortfolioReturnPct: number | null;
  avgBenchmarkReturnPct: number | null;
  avgAlphaVsPrevPct: number | null;
  avgBenchmarkDayPct: number | null;
};

function buildSnapshotStats(rows: PortfolioDailySnapshotRow[]): SnapshotStats | null {
  if (rows.length === 0) return null;
  const byDate = [...rows].sort((x, y) => compareSnapshotDate(x.snapshotDate, y.snapshotDate));
  const oldest = byDate[0]!;
  const newest = byDate[byDate.length - 1]!;
  const dateMin = oldest.snapshotDate;
  const dateMax = newest.snapshotDate;

  let profitDeltaJpy: number | null = null;
  if (oldest.totalProfitJpy != null && newest.totalProfitJpy != null) {
    profitDeltaJpy = newest.totalProfitJpy - oldest.totalProfitJpy;
  }

  let marketValueDeltaJpy: number | null = null;
  if (Number.isFinite(oldest.totalMarketValueJpy) && Number.isFinite(newest.totalMarketValueJpy)) {
    marketValueDeltaJpy = newest.totalMarketValueJpy - oldest.totalMarketValueJpy;
  }

  return {
    count: rows.length,
    dateMin,
    dateMax,
    profitDeltaJpy,
    marketValueDeltaJpy,
    avgPortfolioReturnPct: average(finiteNumbers(rows, (r) => r.portfolioReturnVsPrevPct)),
    avgBenchmarkReturnPct: average(finiteNumbers(rows, (r) => r.benchmarkReturnVsPrevPct)),
    avgAlphaVsPrevPct: average(finiteNumbers(rows, (r) => r.alphaVsPrevPct)),
    avgBenchmarkDayPct: average(finiteNumbers(rows, (r) => r.benchmarkChangePct)),
  };
}

function jpyPnlCellClass(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "text-slate-500";
  if (v > 0) return "text-emerald-400";
  if (v < 0) return "text-rose-400";
  return "text-slate-400";
}

function sortHoldingsByDayChangeDesc(rows: HoldingDailySnapshotRow[]): HoldingDailySnapshotRow[] {
  return [...rows].sort((a, b) => {
    const da = a.dayChangePct;
    const db = b.dayChangePct;
    const fa = da != null && Number.isFinite(da);
    const fb = db != null && Number.isFinite(db);
    if (fa && fb && db !== da) return db - da;
    if (fa !== fb) return fa ? -1 : 1;
    return a.ticker.localeCompare(b.ticker);
  });
}

function SameDayHoldingsBlock({
  snapshotDate,
  holdings,
  portfolioReturnVsPrevPct,
}: {
  snapshotDate: string;
  holdings: HoldingDailySnapshotRow[];
  portfolioReturnVsPrevPct: number | null;
}) {
  const sorted = useMemo(() => sortHoldingsByDayChangeDesc(holdings), [holdings]);
  return (
    <div className="border-t border-border pt-4 mt-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
        銘柄スナップショット（同日）
      </p>
      {portfolioReturnVsPrevPct != null && Number.isFinite(portfolioReturnVsPrevPct) ? (
        <p className="text-[10px] text-muted-foreground mb-1.5">
          この日の PF 前日比（一覧と同値）:{" "}
          <span className={`font-mono font-semibold ${pctClass(portfolioReturnVsPrevPct)}`}>
            {fmtPct(portfolioReturnVsPrevPct)}
          </span>
        </p>
      ) : null}
      <p className="text-[10px] text-muted-foreground/90 mb-3 font-mono">
        holding_daily_snapshots · UTC {snapshotDate} · {sorted.length} 銘柄（前日比% 降順）
      </p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-xs min-w-[640px]">
          <thead className="bg-background text-muted-foreground text-[10px] uppercase font-bold tracking-[0.06em]">
            <tr>
              <th className="px-3 py-2 whitespace-nowrap">銘柄</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">前日比</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">評価額（円）</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">損益率</th>
              <th className="px-3 py-2 whitespace-nowrap">Cat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {sorted.map((h) => (
              <tr key={h.id} className="bg-background/60 hover:bg-slate-800/25">
                <td className="px-3 py-2">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="font-medium text-slate-200 truncate max-w-[14rem]" title={h.name || h.ticker}>
                      {h.name || h.ticker}
                    </span>
                    <span className="font-mono text-[10px] text-slate-500">{h.ticker}</span>
                  </div>
                </td>
                <td className={`px-3 py-2 text-right font-mono font-medium whitespace-nowrap ${pctClass(h.dayChangePct)}`}>
                  {fmtPct(h.dayChangePct)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-slate-200 whitespace-nowrap">
                  {h.marketValueJpy > 0 ? jpyFmt.format(h.marketValueJpy) : "—"}
                </td>
                <td className={`px-3 py-2 text-right font-mono whitespace-nowrap ${pctClass(h.unrealizedPnlPct)}`}>
                  {h.unrealizedPnlPct != null && Number.isFinite(h.unrealizedPnlPct) ? fmtPct(h.unrealizedPnlPct) : "—"}
                </td>
                <td className="px-3 py-2 text-[10px] font-semibold text-slate-500 whitespace-nowrap">
                  {h.category === "Core" ? "Core" : "Sat"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type PortfolioSnapshotsTableProps = {
  rows: PortfolioDailySnapshotRow[];
  /** ログ用: `snapshot_date` ごとの holding 行（Portfolio 行展開で同日銘柄を表示） */
  holdingsBySnapshotDate?: ReadonlyMap<string, HoldingDailySnapshotRow[]>;
};

export function PortfolioSnapshotsTable({ rows, holdingsBySnapshotDate }: PortfolioSnapshotsTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const stats = useMemo(() => buildSnapshotStats(rows), [rows]);

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
              と同義）。
              {holdingsBySnapshotDate != null ? (
                <>
                  {" "}
                  <span className="text-muted-foreground/80">
                    右端の Market を開くと、同一 <span className="font-mono">snapshot_date</span> の銘柄内訳（
                    <span className="font-mono">holding_daily_snapshots</span>）も表示されます。
                  </span>
                </>
              ) : null}
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
                const sameDayHoldings =
                  holdingsBySnapshotDate != null ? holdingsBySnapshotDate.get(r.snapshotDate) : undefined;
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
                          title={
                            holdingsBySnapshotDate != null
                              ? "市場指標と同日の銘柄スナップショットを表示"
                              : "市場指標を表示"
                          }
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
                          <div className="space-y-0">
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
                            {holdingsBySnapshotDate != null ? (
                              sameDayHoldings != null && sameDayHoldings.length > 0 ? (
                                <SameDayHoldingsBlock
                                  snapshotDate={r.snapshotDate}
                                  holdings={sameDayHoldings}
                                  portfolioReturnVsPrevPct={r.portfolioReturnVsPrevPct}
                                />
                              ) : (
                                <div className="border-t border-border pt-4 mt-4">
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                                    銘柄スナップショット（同日）
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    この <span className="font-mono">{r.snapshotDate}</span> の{" "}
                                    <span className="font-mono">holding_daily_snapshots</span>{" "}
                                    がありません（記録前の日付、または銘柄行の欠損など）。
                                  </p>
                                </div>
                              )
                            ) : null}
                          </div>
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
      {stats ? (
        <div className="border-t border-border bg-muted/15 px-5 py-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">統計（表示中の全行）</p>
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 text-xs">
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground">スナップショット数</dt>
              <dd className="font-mono text-slate-200 tabular-nums">{stats.count} 件</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground">記録日の範囲（最古〜最新）</dt>
              <dd className="font-mono text-slate-200 tabular-nums">
                {stats.dateMin} <span className="text-muted-foreground">〜</span> {stats.dateMax}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground" title="期間内で最古の行と最新の行の差（total_profit）">
                合計損益の変化（期間）
              </dt>
              <dd
                className={`font-mono font-medium tabular-nums ${
                  stats.profitDeltaJpy == null
                    ? "text-slate-500"
                    : stats.profitDeltaJpy > 0
                      ? "text-emerald-400"
                      : stats.profitDeltaJpy < 0
                        ? "text-rose-400"
                        : "text-slate-400"
                }`}
              >
                {stats.profitDeltaJpy != null ? jpyFmt.format(stats.profitDeltaJpy) : "—（未記録行あり）"}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground" title="最古行と最新行の評価額の差">
                評価額の変化（期間）
              </dt>
              <dd
                className={`font-mono font-medium tabular-nums ${
                  stats.marketValueDeltaJpy == null
                    ? "text-slate-500"
                    : stats.marketValueDeltaJpy > 0
                      ? "text-emerald-400"
                      : stats.marketValueDeltaJpy < 0
                        ? "text-rose-400"
                        : "text-slate-400"
                }`}
              >
                {stats.marketValueDeltaJpy != null ? jpyFmt.format(stats.marketValueDeltaJpy) : "—"}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground">PF 前日比（平均・記録ありのみ）</dt>
              <dd className={`font-mono tabular-nums ${pctClass(stats.avgPortfolioReturnPct)}`}>
                {stats.avgPortfolioReturnPct != null ? fmtPct(stats.avgPortfolioReturnPct) : "—"}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground">BM 前日比（平均・記録ありのみ）</dt>
              <dd className={`font-mono tabular-nums ${pctClass(stats.avgBenchmarkReturnPct)}`}>
                {stats.avgBenchmarkReturnPct != null ? fmtPct(stats.avgBenchmarkReturnPct) : "—"}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground">α 乖離（平均・記録ありのみ）</dt>
              <dd className={`font-mono font-semibold tabular-nums ${pctClass(stats.avgAlphaVsPrevPct)}`}>
                {stats.avgAlphaVsPrevPct != null ? fmtPct(stats.avgAlphaVsPrevPct) : "—"}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground" title="各行の VOO 当日% の単純平均">
                VOO 当日%（平均・記録ありのみ）
              </dt>
              <dd className={`font-mono tabular-nums ${pctClass(stats.avgBenchmarkDayPct)}`}>
                {stats.avgBenchmarkDayPct != null ? fmtPct(stats.avgBenchmarkDayPct) : "—"}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}
    </div>
  );
}
