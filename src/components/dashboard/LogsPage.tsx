"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { DEFAULT_AGGREGATE_KPI_WINDOW_DAYS } from "@/src/lib/portfolio-aggregate-kpis";
import { normalizeLogsKpiWindowDays } from "@/src/lib/logs-kpi-window";
import { USD_JPY_RATE_FALLBACK } from "@/src/lib/fx-constants";
import { useCurrencyConverter } from "@/src/hooks/use-currency-converter";

import type {
  ClosedTradeDashboardRow,
  HoldingDailySnapshotRow,
  PortfolioAggregateKPI,
  PortfolioDailySnapshotRow,
} from "@/src/types/investment";
import { ClosedTradesTable } from "@/src/components/dashboard/ClosedTradesTable";
import { HoldingDailySnapshotsTable } from "@/src/components/dashboard/HoldingDailySnapshotsTable";
import { PortfolioSnapshotsTable } from "@/src/components/dashboard/PortfolioSnapshotsTable";
import { defaultProfileUserId } from "@/src/lib/authorize-signals";

const DEFAULT_USER_ID = defaultProfileUserId();
const KPI_WINDOW_STORAGE_KEY = "logs.kpiWindowDays";
const LOGS_TABLE_CCY_KEY = "logs.tableDisplayCurrency";

type TableDisplayCcy = "JPY" | "USD";

function readStoredKpiWindowDays(): number {
  if (typeof window === "undefined") return DEFAULT_AGGREGATE_KPI_WINDOW_DAYS;
  try {
    const s = localStorage.getItem(KPI_WINDOW_STORAGE_KEY);
    if (s) return normalizeLogsKpiWindowDays(Number(s));
  } catch {
    /* ignore */
  }
  return DEFAULT_AGGREGATE_KPI_WINDOW_DAYS;
}

function readLogsTableCcy(): TableDisplayCcy {
  if (typeof window === "undefined") return "JPY";
  try {
    const s = localStorage.getItem(LOGS_TABLE_CCY_KEY);
    if (s === "USD" || s === "JPY") return s;
  } catch {
    /* ignore */
  }
  return "JPY";
}

type LogsPayload = {
  userId: string;
  kpiWindowDays: number;
  portfolioSnapshots: PortfolioDailySnapshotRow[];
  holdingSnapshotsDate: string | null;
  holdingSnapshots: HoldingDailySnapshotRow[];
  closedTrades: ClosedTradeDashboardRow[];
  portfolioAggregateKpis: PortfolioAggregateKPI[];
};

function fmtYAxisCompact(v: number, mode: TableDisplayCcy, fx: number | null): string {
  if (mode === "JPY" || !fx || !Number.isFinite(fx) || fx <= 0) {
    if (Math.abs(v) >= 1e8) return `¥${(v / 1e8).toFixed(1)}億`;
    if (Math.abs(v) >= 1e4) return `¥${(v / 1e4).toFixed(0)}万`;
    return `¥${Math.round(v)}`;
  }
  const usd = v / fx;
  if (Math.abs(usd) >= 1e6) return `$${(usd / 1e6).toFixed(2)}M`;
  if (Math.abs(usd) >= 1e3) return `$${(usd / 1e3).toFixed(0)}k`;
  return `$${usd < 10 ? usd.toFixed(1) : Math.round(usd)}`;
}

export function LogsPage() {
  const { fxRate: themeFx } = useCurrencyConverter();
  const [kpiWindowDays, setKpiWindowDays] = useState<number>(DEFAULT_AGGREGATE_KPI_WINDOW_DAYS);
  const [data, setData] = useState<LogsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tableDisplayCcy, setTableDisplayCcy] = useState<TableDisplayCcy>("JPY");

  useEffect(() => {
    setKpiWindowDays(readStoredKpiWindowDays());
  }, []);
  useEffect(() => {
    setTableDisplayCcy(readLogsTableCcy());
  }, []);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/logs?userId=${encodeURIComponent(DEFAULT_USER_ID)}&kpiWindowDays=${encodeURIComponent(String(kpiWindowDays))}&kpiLimit=500`,
        {
        cache: "no-store",
        },
      );
      const json = (await res.json()) as Partial<LogsPayload> & { error?: string; hint?: string };
      if (!res.ok) {
        setData(null);
        setError(json.error ?? `HTTP ${res.status}${json.hint ? ` — ${json.hint}` : ""}`);
        return;
      }
      setData({
        userId: json.userId!,
        kpiWindowDays: json.kpiWindowDays ?? kpiWindowDays,
        portfolioSnapshots: json.portfolioSnapshots ?? [],
        holdingSnapshotsDate: json.holdingSnapshotsDate ?? null,
        holdingSnapshots: json.holdingSnapshots ?? [],
        closedTrades: json.closedTrades ?? [],
        portfolioAggregateKpis: json.portfolioAggregateKpis ?? [],
      });
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Failed to load logs");
    } finally {
      setLoading(false);
    }
  }, [kpiWindowDays]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const persistKpiWindow = (next: number) => {
    setKpiWindowDays(next);
    try {
      localStorage.setItem(KPI_WINDOW_STORAGE_KEY, String(next));
    } catch {
      /* ignore */
    }
  };

  const portfolioSnapshots = data?.portfolioSnapshots ?? [];
  const holdingSnapshotsDate = data?.holdingSnapshotsDate ?? null;
  const holdingSnapshots = data?.holdingSnapshots ?? [];
  const closedTrades = data?.closedTrades ?? [];
  const portfolioAggregateKpis = data?.portfolioAggregateKpis ?? [];

  const latestSnapshotFx = useMemo(() => {
    const rows = data?.portfolioSnapshots ?? [];
    if (rows.length === 0) return null;
    const sorted = [...rows].sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate));
    const last = sorted[sorted.length - 1];
    return last?.fxUsdJpy != null && Number.isFinite(last.fxUsdJpy) && last.fxUsdJpy > 0 ? last.fxUsdJpy : null;
  }, [data?.portfolioSnapshots]);

  const effectiveFxJpy = latestSnapshotFx ?? (themeFx > 0 ? themeFx : null) ?? USD_JPY_RATE_FALLBACK;

  const persistTableCcy = (next: TableDisplayCcy) => {
    setTableDisplayCcy(next);
    try {
      localStorage.setItem(LOGS_TABLE_CCY_KEY, next);
    } catch {
      /* ignore */
    }
  };

  const snapshotChartPoints = useMemo(() => {
    const rows = data?.portfolioSnapshots ?? [];
    if (rows.length === 0) return [];
    return [...rows]
      .filter((r) => r.snapshotDate)
      .sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate))
      .map((r) => {
        const mvj = r.totalMarketValueJpy;
        const profitj = r.totalProfitJpy;
        return {
          ymd: r.snapshotDate,
          short: r.snapshotDate.length >= 10 ? r.snapshotDate.slice(5, 10) : r.snapshotDate,
          marketValue: Number.isFinite(mvj) ? mvj : 0,
          totalProfit: profitj != null && Number.isFinite(profitj) ? profitj : null,
        };
      });
  }, [data?.portfolioSnapshots]);

  const closedPnlByMonth = useMemo(() => {
    const m = new Map<string, { yyyymm: string; label: string; pnl: number; n: number }>();
    for (const t of closedTrades) {
      const yyyymm = t.tradeDate.slice(0, 7);
      const label = t.tradeDate.length >= 7 ? `${t.tradeDate.slice(0, 4)}/${t.tradeDate.slice(5, 7)}` : yyyymm;
      if (!/^\d{4}-\d{2}$/.test(yyyymm)) continue;
      const pnl = Number.isFinite(t.realizedPnlJpy) ? t.realizedPnlJpy : 0;
      const cur = m.get(yyyymm);
      if (cur) {
        cur.pnl += pnl;
        cur.n += 1;
      } else {
        m.set(yyyymm, { yyyymm, label, pnl, n: 1 });
      }
    }
    return [...m.values()].sort((a, b) => a.yyyymm.localeCompare(b.yyyymm));
  }, [closedTrades]);

  const kpiSparkline = useMemo(() => {
    const k = portfolioAggregateKpis;
    if (k.length === 0) return [];
    return [...k]
      .filter((x) => x.computedAt)
      .sort((a, b) => a.computedAt.localeCompare(b.computedAt))
      .map((r) => ({
        key: r.computedAt.slice(0, 10),
        profitChg: r.totalProfitChange,
        valChg: r.valuationChange,
        alphaDev: r.avgAlphaDeviationPct,
        windowDays: r.windowDays,
      }));
  }, [portfolioAggregateKpis]);

  const snapshotChartData = useMemo(() => {
    const fx = effectiveFxJpy;
    const toView = (jpy: number | null) => {
      if (jpy == null || !Number.isFinite(jpy)) return null;
      if (tableDisplayCcy === "JPY") return jpy;
      if (!Number.isFinite(fx) || fx <= 0) return jpy;
      return jpy / fx;
    };
    return snapshotChartPoints.map((p) => ({
      ...p,
      mvView: toView(p.marketValue) ?? 0,
      profitView: toView(p.totalProfit),
    }));
  }, [snapshotChartPoints, tableDisplayCcy, effectiveFxJpy]);

  const closedPnlByMonthView = useMemo(() => {
    const fx = effectiveFxJpy;
    return closedPnlByMonth.map((row) => ({
      ...row,
      pnlView:
        tableDisplayCcy === "JPY"
          ? row.pnl
          : Number.isFinite(fx) && fx > 0
            ? row.pnl / fx
            : row.pnl,
    }));
  }, [closedPnlByMonth, tableDisplayCcy, effectiveFxJpy]);

  const kpiViewData = useMemo(() => {
    const fx = effectiveFxJpy;
    const toView = (jpy: number | null) => {
      if (jpy == null || !Number.isFinite(jpy)) return null;
      if (tableDisplayCcy === "JPY") return jpy;
      if (!Number.isFinite(fx) || fx <= 0) return jpy;
      return jpy / fx;
    };
    return kpiSparkline.map((k) => ({
      ...k,
      profitChgV: toView(k.profitChg),
      valChgV: toView(k.valChg),
    }));
  }, [kpiSparkline, tableDisplayCcy, effectiveFxJpy]);

  const holdingsBySnapshotDate = useMemo(() => {
    const m = new Map<string, HoldingDailySnapshotRow[]>();
    for (const h of holdingSnapshots) {
      const d = h.snapshotDate;
      const cur = m.get(d);
      if (cur) cur.push(h);
      else m.set(d, [h]);
    }
    return m;
  }, [holdingSnapshots]);

  return (
    <div className="mx-auto w-full max-w-6xl lg:max-w-7xl 2xl:max-w-[104rem] space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">ログ</h1>
            <p className="text-[10px] text-muted-foreground mt-1">
              Portfolio / Holding スナップショットと取引履歴（読み取り専用）。記録はダッシュボードの{" "}
              <span className="font-mono text-muted-foreground/90">Record snapshot</span>、売買は{" "}
              <span className="font-mono text-muted-foreground/90">取引入力</span> から行えます。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-0.5 rounded-lg border border-border p-0.5 bg-card/50">
              <span className="px-2 text-[9px] font-bold uppercase text-muted-foreground">表の金額</span>
              {(["JPY", "USD"] as const).map((ccy) => (
                <button
                  key={ccy}
                  type="button"
                  onClick={() => persistTableCcy(ccy)}
                  className={`rounded-md px-2.5 py-1 text-[10px] font-bold ${
                    tableDisplayCcy === ccy
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground/90"
                  }`}
                >
                  {ccy}
                </button>
              ))}
            </div>
            <span
              className="text-[10px] text-muted-foreground font-mono"
              title="スナップショット最新の USD/JPY、無ければダッシュのレート、最後にフォールバック"
            >
              為替: {Number.isFinite(effectiveFxJpy) ? `¥${effectiveFxJpy.toFixed(2)}/$` : "—"}
            </span>
            <span className="text-xs text-muted-foreground font-mono">{DEFAULT_USER_ID}</span>
            {loading && <span className="text-xs text-muted-foreground">Loading…</span>}
            {error && <span className="text-xs text-rose-400">{error}</span>}
            <button
              type="button"
              onClick={() => void loadLogs()}
              disabled={loading}
              className="text-[10px] font-bold text-foreground/80 border border-border px-3 py-2 rounded-lg hover:bg-muted transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

      {snapshotChartData.length > 0 || closedPnlByMonthView.length > 0 || kpiViewData.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3">
          {snapshotChartData.length > 0 ? (
            <section className="rounded-2xl border border-border bg-card/40 p-4 shadow-lg">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">記録日の評価額 / 合計損益</h2>
              <p className="text-[10px] text-muted-foreground/90 mt-0.5 mb-3">portfolio_snapshots 時系列（{tableDisplayCcy}）</p>
              <div className="h-56 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={snapshotChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis dataKey="short" tick={{ fontSize: 9 }} className="text-muted-foreground" />
                    <YAxis
                      tick={{ fontSize: 9 }}
                      className="text-muted-foreground"
                      tickFormatter={(v: number) => fmtYAxisCompact(v, tableDisplayCcy, effectiveFxJpy)}
                    />
                    <Tooltip
                      formatter={(val, name) => {
                        const n = typeof val === "number" && Number.isFinite(val) ? val : null;
                        return [n != null ? fmtYAxisCompact(n, tableDisplayCcy, effectiveFxJpy) : "—", String(name)];
                      }}
                      labelFormatter={(_, p) => {
                        const ymd = p?.[0] && "payload" in p[0] && p[0].payload && typeof p[0].payload === "object" && p[0].payload && "ymd" in p[0].payload
                          ? String((p[0].payload as { ymd: string }).ymd)
                          : "";
                        return ymd ? `日付 ${ymd}` : "";
                      }}
                      contentStyle={{ fontSize: 11 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="mvView"
                      name="時価評価"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary) / 0.15)"
                      strokeWidth={1.5}
                    />
                    {snapshotChartData.some((d) => d.profitView != null) ? (
                      <Line
                        type="monotone"
                        dataKey="profitView"
                        name="含み+確定損益"
                        stroke="#a78bfa"
                        dot={false}
                        strokeWidth={1.5}
                        connectNulls
                      />
                    ) : null}
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </section>
          ) : null}
          {closedPnlByMonthView.length > 0 ? (
            <section className="rounded-2xl border border-border bg-card/40 p-4 shadow-lg">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">確定損益（月次・売却のみ）</h2>
              <p className="text-[10px] text-muted-foreground/90 mt-0.5 mb-3">trade_history 合計 / 月</p>
              <div className="h-56 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={closedPnlByMonthView} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis dataKey="label" tick={{ fontSize: 9 }} className="text-muted-foreground" />
                    <YAxis
                      tick={{ fontSize: 9 }}
                      tickFormatter={(v: number) => fmtYAxisCompact(v, tableDisplayCcy, effectiveFxJpy)}
                    />
                    <Tooltip
                      formatter={(v) => {
                        const n = typeof v === "number" && Number.isFinite(v) ? v : null;
                        return n != null ? fmtYAxisCompact(n, tableDisplayCcy, effectiveFxJpy) : "—";
                      }}
                      contentStyle={{ fontSize: 11 }}
                    />
                    <Bar dataKey="pnlView" name="確定PnL" fill="hsl(142, 70%, 45%)" opacity={0.9} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          ) : null}
          {kpiViewData.length > 0 ? (
            <section className="rounded-2xl border border-border bg-card/40 p-4 shadow-lg md:col-span-2 xl:col-span-1 2xl:col-span-1">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">集計KPI ウィンドウ</h2>
              <p className="text-[10px] text-muted-foreground/90 mt-0.5 mb-3">profit / 評価額の変化（{tableDisplayCcy}）</p>
              <div className="h-56 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={kpiViewData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis dataKey="key" tick={{ fontSize: 9 }} />
                    <YAxis
                      tick={{ fontSize: 9 }}
                      tickFormatter={(v: number) => fmtYAxisCompact(v, tableDisplayCcy, effectiveFxJpy)}
                    />
                    <Tooltip
                      contentStyle={{ fontSize: 11 }}
                      formatter={(v) => {
                        const n = typeof v === "number" && Number.isFinite(v) ? v : null;
                        return n != null ? fmtYAxisCompact(n, tableDisplayCcy, effectiveFxJpy) : "—";
                      }}
                    />
                    <Bar dataKey="valChgV" name="評価額変化" fill="hsl(45, 93%, 47%)" opacity={0.85} />
                    <Line dataKey="profitChgV" name="損益累計の変化" type="monotone" stroke="#38bdf8" strokeWidth={1.5} dot />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      <PortfolioSnapshotsTable
        userId={DEFAULT_USER_ID}
        kpiWindowDays={kpiWindowDays}
        onKpiWindowChange={persistKpiWindow}
        onKpiDataRefresh={() => void loadLogs()}
        rows={portfolioSnapshots}
        holdingsBySnapshotDate={holdingsBySnapshotDate}
        serverAggregateKpis={portfolioAggregateKpis}
      />
      <HoldingDailySnapshotsTable snapshotDate={holdingSnapshotsDate} rows={holdingSnapshots} />
      <ClosedTradesTable
        rows={closedTrades}
        displayCurrency={tableDisplayCcy}
        fxUsdJpy={Number.isFinite(effectiveFxJpy) && effectiveFxJpy > 0 ? effectiveFxJpy : null}
      />
    </div>
  );
}
