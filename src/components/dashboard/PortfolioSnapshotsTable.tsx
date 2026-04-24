"use client";

import React, { useMemo, useRef, useState } from "react";
import { ChevronDown, FileSpreadsheet, FileUp, Loader2, Table2 } from "lucide-react";

import { MarketBar } from "@/src/components/dashboard/MarketBar";
import { PORTFOLIO_SNAPSHOT_CSV_COLUMNS, portfolioSnapshotsToCsvRows } from "@/src/lib/csv-dashboard-presets";
import {
  AGGREGATE_KPI_CSV_COLUMNS,
  aggregateKpiCsvFileName,
  portfolioAggregateKpisToCsvRows,
} from "@/src/lib/csv-aggregate-kpis";
import { exportToCSV, portfolioCsvFileName } from "@/src/lib/csv-export";
import { roundAlphaMetric } from "@/src/lib/alpha-logic";
import { effectiveAlphaVsPrevPct } from "@/src/lib/portfolio-snapshot-alpha";
import type { HoldingDailySnapshotRow, PortfolioAggregateKPI, PortfolioDailySnapshotRow } from "@/src/types/investment";
import { stickyTdFirst, stickyThFirst } from "@/src/components/dashboard/table-sticky";
import { LOGS_KPI_WINDOW_DAYS_OPTIONS } from "@/src/lib/logs-kpi-window";

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

function fmtIntOrDash(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return String(Math.trunc(v));
}

function fmtQuantityTotal(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const t = Math.trunc(v);
  if (Math.abs(v - t) < 1e-9) return String(t);
  return v.toLocaleString(undefined, { maximumFractionDigits: 4 });
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

/** Main snapshot table column count (expanded detail row colspan). */
const COL_COUNT = 19;

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
    avgAlphaVsPrevPct: (() => {
      const av = average(finiteNumbers(rows, effectiveAlphaVsPrevPct));
      return av != null ? roundAlphaMetric(av) : null;
    })(),
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
  /** ログ: KPI 取り込み API 用。 */
  userId: string;
  /** 表示・取得中の暦日窓（`portfolio_aggregate_kpis.window_days`） */
  kpiWindowDays: number;
  onKpiWindowChange: (windowDays: number) => void;
  /** CSV 取り込み成功後の一覧再取得。 */
  onKpiDataRefresh: () => void;
  rows: PortfolioDailySnapshotRow[];
  /** ログ用: `snapshot_date` ごとの holding 行（Portfolio 行展開で同日銘柄を表示） */
  holdingsBySnapshotDate?: ReadonlyMap<string, HoldingDailySnapshotRow[]>;
  /** 記録時に `portfolio_aggregate_kpis` へ永続化した窓集計（時系列用） */
  serverAggregateKpis?: PortfolioAggregateKPI[];
};

export function PortfolioSnapshotsTable({
  userId,
  kpiWindowDays,
  onKpiWindowChange,
  onKpiDataRefresh,
  rows,
  holdingsBySnapshotDate,
  serverAggregateKpis = [],
}: PortfolioSnapshotsTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const kpiFileRef = useRef<HTMLInputElement>(null);
  const [kpiImportBusy, setKpiImportBusy] = useState(false);
  const [kpiNotice, setKpiNotice] = useState<string | null>(null);
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
      <div className="px-5 py-3 border-b border-border bg-cyan-500/[0.04]">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
          <div className="min-w-0">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-cyan-300/80">
              KPI 履歴（DB）— {kpiWindowDays} 日暦日窓 · 永続
            </h4>
            <p className="text-[9px] text-muted-foreground mt-1 max-w-3xl">
              各 <span className="font-mono">as_of_date</span> 記録直後に、直近 {kpiWindowDays} 日分の{" "}
              <span className="font-mono">portfolio_daily_snapshots</span> から上表と同定義の統計を再計算し保存。窓の幅は
              下のセレクタで切替（localStorage 保存）。書き出した CSV を Excel で編集し、取り込みで
              <span className="font-mono"> portfolio_aggregate_kpis </span>
              を上書き（同一 <span className="font-mono">user_id + as_of_date + window_days</span> ）。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span className="font-bold uppercase tracking-wide">窓</span>
              <select
                value={kpiWindowDays}
                onChange={(e) => onKpiWindowChange(Number(e.target.value))}
                className="text-[10px] font-mono font-medium border border-border rounded-md bg-background px-2 py-1.5"
              >
                {LOGS_KPI_WINDOW_DAYS_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d} 日
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => {
                exportToCSV(
                  portfolioAggregateKpisToCsvRows(serverAggregateKpis),
                  aggregateKpiCsvFileName(kpiWindowDays),
                  AGGREGATE_KPI_CSV_COLUMNS,
                );
                setKpiNotice(
                  serverAggregateKpis.length > 0
                    ? `CSV: ${serverAggregateKpis.length} 行（窓 ${kpiWindowDays} 日）を書き出しました。`
                    : `見出しのみの CSV（窓 ${kpiWindowDays} 日）を書き出しました。行を追記して取り込めます。`,
                );
              }}
              className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground border border-border px-2.5 py-2 rounded-lg hover:bg-muted/50 transition-all"
              title="表示中の窓のKPI行を UTF-8 BOM 付き CSV でダウンロード（0件なら見出しのみ）"
            >
              <FileSpreadsheet size={14} />
              書き出し
            </button>
            <input
              ref={kpiFileRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                setKpiNotice(null);
                setKpiImportBusy(true);
                try {
                  const text = await f.text();
                  const res = await fetch("/api/portfolio-aggregate-kpis", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userId, csv: text }),
                  });
                  const json = (await res.json()) as { error?: string; applied?: number };
                  if (!res.ok) {
                    setKpiNotice(`取り込みエラー: ${json.error ?? res.statusText}`);
                    return;
                  }
                  setKpiNotice(
                    `取り込み完了: ${json.applied ?? 0} 行を反映しました。`,
                  );
                  onKpiDataRefresh();
                } catch (err) {
                  setKpiNotice(err instanceof Error ? err.message : "取り込みに失敗しました");
                } finally {
                  setKpiImportBusy(false);
                }
              }}
            />
            <button
              type="button"
              disabled={kpiImportBusy}
              onClick={() => kpiFileRef.current?.click()}
              className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-cyan-200/90 border border-cyan-500/40 px-2.5 py-2 rounded-lg hover:bg-cyan-500/10 transition-all disabled:opacity-50"
              title="CSV を選択して DB に反映（上書き）"
            >
              {kpiImportBusy ? <Loader2 size={14} className="animate-spin" /> : <FileUp size={14} />}
              取り込み
            </button>
          </div>
        </div>
        {kpiNotice != null && (
          <p className="text-[9px] text-muted-foreground mb-2" role="status">
            {kpiNotice}
          </p>
        )}
        {serverAggregateKpis.length > 0 ? (
          <p className="text-[9px] text-muted-foreground/90 mb-2">
            表は先頭 8 行のみ。CSV には現在の窓の <span className="font-mono">全 {serverAggregateKpis.length} 行</span>（最大
            500）を含めます。
          </p>
        ) : (
          <p className="text-[9px] text-muted-foreground/90 mb-2">
            この窓（<span className="font-mono">{kpiWindowDays} 日</span>）の行がありません。Record snapshot で自動計算するか、CSV
            を取り込んでください（別窓のデータを書き出して window_days 列を編集しても可）。
          </p>
        )}
        <div className="overflow-x-auto rounded-lg border border-border/60 min-h-[2.5rem]">
          {serverAggregateKpis.length > 0 ? (
            <table className="w-full text-left text-xs min-w-[880px]">
              <thead className="bg-background/80 text-[9px] uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 whitespace-nowrap">as of</th>
                  <th className="px-3 py-2 whitespace-nowrap">期間 (min–max)</th>
                  <th className="px-3 py-2 text-right">n</th>
                  <th className="px-3 py-2 text-right">Σ損益Δ</th>
                  <th className="px-3 py-2 text-right">評価額Δ</th>
                  <th className="px-3 py-2 text-right" title="α 乖離（補完可）平均">
                    α 乖離平均
                  </th>
                  <th className="px-3 py-2 text-right">PF% 均</th>
                  <th className="px-3 py-2 text-right">BM% 均</th>
                  <th className="px-3 py-2 text-right">VOO当日% 均</th>
                  <th className="px-3 py-2 whitespace-nowrap">computed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {serverAggregateKpis.slice(0, 8).map((k) => (
                  <tr key={k.id} className="hover:bg-muted/20">
                    <td className="px-3 py-1.5 font-mono text-foreground/90 whitespace-nowrap">{k.asOfDate}</td>
                    <td className="px-3 py-1.5 font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                      {k.periodStart} → {k.periodEnd}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono">{k.snapshotCount}</td>
                    <td className={`px-3 py-1.5 text-right font-mono ${jpyPnlCellClass(k.totalProfitChange)}`}>
                      {k.totalProfitChange != null ? jpyFmt.format(k.totalProfitChange) : "—"}
                    </td>
                    <td className={`px-3 py-1.5 text-right font-mono ${jpyPnlCellClass(k.valuationChange)}`}>
                      {k.valuationChange != null ? jpyFmt.format(k.valuationChange) : "—"}
                    </td>
                    <td className={`px-3 py-1.5 text-right font-mono font-medium ${pctClass(k.avgAlphaDeviationPct)}`}>
                      {fmtPct(k.avgAlphaDeviationPct)}
                    </td>
                    <td className={`px-3 py-1.5 text-right font-mono ${pctClass(k.avgPfDailyChangePct)}`}>
                      {fmtPct(k.avgPfDailyChangePct)}
                    </td>
                    <td className={`px-3 py-1.5 text-right font-mono ${pctClass(k.avgBmDailyChangePct)}`}>
                      {fmtPct(k.avgBmDailyChangePct)}
                    </td>
                    <td className={`px-3 py-1.5 text-right font-mono ${pctClass(k.avgVooDailyPct)}`}>
                      {fmtPct(k.avgVooDailyPct)}
                    </td>
                    <td className="px-3 py-1.5 text-[9px] text-muted-foreground whitespace-nowrap font-mono">
                      {fmtRecorded(k.computedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-sm text-muted-foreground">
          行がありません。マイグレーション適用後、<span className="font-mono text-muted-foreground/90">Record snapshot</span>{" "}
          で記録してください。
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[1580px]">
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
                <th
                  className="px-4 py-3 text-right whitespace-nowrap"
                  title="DB: holdings_count。記録時点の保有行数（dash.stocks）"
                >
                  銘柄数
                </th>
                <th
                  className="px-4 py-3 text-right whitespace-nowrap"
                  title="直前の portfolio snapshot 日の holding_daily_snapshots と比較した新規 holding_id 数（032 以降）"
                >
                  ＋
                </th>
                <th
                  className="px-4 py-3 text-right whitespace-nowrap"
                  title="同上・消えた holding_id 数"
                >
                  −
                </th>
                <th
                  className="px-4 py-3 text-right whitespace-nowrap"
                  title="同上・両日に存在した holding_id 数"
                >
                  継続
                </th>
                <th
                  className="px-4 py-3 text-right whitespace-nowrap"
                  title="米株・日本上場株の数量合計（isLikelyEtfOrFundHolding で ETF/投信型を除外。投信コードは種別外）"
                >
                  個別株数量計
                </th>
                <th className="px-4 py-3 text-right whitespace-nowrap">平均 α</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">PF 前日比</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">BM 前日比</th>
                <th
                  className="px-4 py-3 text-right whitespace-nowrap"
                  title="PF 前日比 − ベンチ前日比（%）。列 alpha_vs_prev_pct、欠損行は2列の差で補完"
                >
                  α 乖離
                </th>
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
                      <td className="px-4 py-2.5 text-right font-mono text-slate-300 text-xs" title="holdings_count">
                        {fmtIntOrDash(r.holdingsCount)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-300 text-xs" title="holdings_added_count">
                        {fmtIntOrDash(r.holdingsAddedCount)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-300 text-xs" title="holdings_removed_count">
                        {fmtIntOrDash(r.holdingsRemovedCount)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-300 text-xs" title="holdings_continuing_count">
                        {fmtIntOrDash(r.holdingsContinuingCount)}
                      </td>
                      <td
                        className="px-4 py-2.5 text-right font-mono text-slate-300 text-xs"
                        title="non_etf_listed_equity_quantity_total"
                      >
                        {fmtQuantityTotal(r.nonEtfListedEquityQuantityTotal)}
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
                      <td
                        className={`px-4 py-2.5 text-right font-mono text-xs font-semibold ${pctClass(effectiveAlphaVsPrevPct(r))}`}
                        title={
                          r.alphaVsPrevPct == null && effectiveAlphaVsPrevPct(r) != null
                            ? "補完: この行の portfolio_return_vs_prev − benchmark_return_vs_prev"
                            : undefined
                        }
                      >
                        {fmtPct(effectiveAlphaVsPrevPct(r))}
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
              <dt
                className="text-muted-foreground"
                title="各行の「α 乖離」列（欠損時は PF−BM で補完）の算術平均。全行 null のみ —"
              >
                α 乖離（平均・補完可）
              </dt>
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
