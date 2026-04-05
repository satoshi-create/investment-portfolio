"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Crosshair, Layers, TrendingUp } from "lucide-react";

import type {
  InvestmentThemeRecord,
  Stock,
  ThemeDetailData,
  ThemeEcosystemWatchItem,
} from "@/src/types/investment";
import { EcosystemCumulativeSparkline } from "@/src/components/dashboard/EcosystemCumulativeSparkline";
import { InventoryTable } from "@/src/components/dashboard/InventoryTable";
import { TradeEntryForm, type TradeEntryInitial } from "@/src/components/dashboard/TradeEntryForm";
import { TrendMiniChart } from "@/src/components/dashboard/TrendMiniChart";
import { stickyTdFirst, stickyThFirst } from "@/src/components/dashboard/table-sticky";

const DEFAULT_USER_ID =
  typeof process.env.NEXT_PUBLIC_DEFAULT_PROFILE_USER_ID === "string" &&
  process.env.NEXT_PUBLIC_DEFAULT_PROFILE_USER_ID.length > 0
    ? process.env.NEXT_PUBLIC_DEFAULT_PROFILE_USER_ID
    : "user-satoshi";

const jpyFmt = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

function fmtPct(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

function pctClass(v: number): string {
  if (!Number.isFinite(v)) return "text-slate-500";
  if (v > 0) return "text-emerald-400";
  if (v < 0) return "text-rose-400";
  return "text-slate-400";
}

function ThemeMetaBlock({ theme, themeName }: { theme: InvestmentThemeRecord | null; themeName: string }) {
  return (
    <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-5 md:p-6">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-1">Investment thesis</p>
        {theme?.description ? (
          <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{theme.description}</p>
        ) : (
          <p className="text-sm text-slate-500">
            テーマ「{themeName}」の解説は未登録です。<span className="font-mono text-slate-600">investment_themes</span>{" "}
            に Notion から移行した <span className="font-mono">description</span> を投入すると表示されます。
          </p>
        )}
      </div>
      {theme?.goal ? (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-1">Goal & milestones</p>
          <p className="text-sm text-slate-400 leading-relaxed whitespace-pre-wrap">{theme.goal}</p>
        </div>
      ) : null}
    </div>
  );
}

type ThemeDetailJson = ThemeDetailData & { userId?: string; error?: string };

function groupEcosystemByField(items: ThemeEcosystemWatchItem[]): { field: string; items: ThemeEcosystemWatchItem[] }[] {
  const order: string[] = [];
  const map = new Map<string, ThemeEcosystemWatchItem[]>();
  for (const e of items) {
    const f = e.field.trim() || "その他";
    if (!map.has(f)) {
      map.set(f, []);
      order.push(f);
    }
    map.get(f)!.push(e);
  }
  return order.map((field) => ({ field, items: map.get(field)! }));
}

export function ThemePageClient({ themeLabel }: { themeLabel: string }) {
  const [data, setData] = useState<ThemeDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tradeFormOpen, setTradeFormOpen] = useState(false);
  const [tradeInitial, setTradeInitial] = useState<TradeEntryInitial | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/theme-detail?userId=${encodeURIComponent(DEFAULT_USER_ID)}&theme=${encodeURIComponent(themeLabel)}`,
        { cache: "no-store" },
      );
      const json = (await res.json()) as ThemeDetailJson;
      if (!res.ok) {
        setData(null);
        setError(json.error ?? `HTTP ${res.status}`);
        return;
      }
      const { userId: _u, error: _e, ...rest } = json;
      setData({
        ...rest,
        ecosystem: Array.isArray(rest.ecosystem)
          ? rest.ecosystem.map((item) => ({
              ...item,
              observationStartedAt:
                typeof item.observationStartedAt === "string" && item.observationStartedAt.length >= 10
                  ? item.observationStartedAt.slice(0, 10)
                  : null,
              alphaObservationStartDate:
                typeof item.alphaObservationStartDate === "string" && item.alphaObservationStartDate.length >= 10
                  ? item.alphaObservationStartDate.slice(0, 10)
                  : null,
            }))
          : [],
        cumulativeAlphaSeries: Array.isArray(rest.cumulativeAlphaSeries) ? rest.cumulativeAlphaSeries : [],
        structuralAlphaTotalPct:
          typeof rest.structuralAlphaTotalPct === "number" && Number.isFinite(rest.structuralAlphaTotalPct)
            ? rest.structuralAlphaTotalPct
            : null,
        cumulativeAlphaAnchorDate:
          typeof rest.cumulativeAlphaAnchorDate === "string" && rest.cumulativeAlphaAnchorDate.length > 0
            ? rest.cumulativeAlphaAnchorDate
            : null,
      } as ThemeDetailData);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [themeLabel]);

  useEffect(() => {
    void load();
  }, [load]);

  const openTradeForm = useCallback((initial: TradeEntryInitial | null) => {
    setTradeInitial(initial);
    setTradeFormOpen(true);
  }, []);

  const stocks = data?.stocks ?? [];
  const theme = data?.theme ?? null;
  const ecosystem = data?.ecosystem ?? [];
  const ecosystemGroups = useMemo(() => groupEcosystemByField(ecosystem), [ecosystem]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="border-b border-slate-800 pb-8">
          <Link
            href="/"
            className="inline-flex text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-cyan-400 mb-4"
          >
            ← ダッシュボード
          </Link>
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                <Crosshair size={14} className="text-cyan-500/90" />
                <span>Structural theme command</span>
              </div>
              <h1 className="text-3xl font-bold text-white tracking-tight">{themeLabel}</h1>
              <p className="text-[11px] text-slate-600 mt-2">
                <span className="font-mono text-slate-500">{DEFAULT_USER_ID}</span>
                ・<span className="font-mono">structure_tags[0]</span> がこのテーマ名と一致する保有のみ
              </p>
            </div>
            {data?.benchmarkLatestPrice != null && data.benchmarkLatestPrice > 0 ? (
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-right shrink-0">
                <p className="text-[9px] font-bold uppercase text-slate-500">VOO (ref)</p>
                <p className="font-mono text-lg text-slate-200">
                  {data.benchmarkLatestPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </p>
              </div>
            ) : null}
          </div>
        </header>

        {loading ? <p className="text-sm text-slate-500">読み込み中…</p> : null}
        {error ? <p className="text-sm text-rose-400">{error}</p> : null}

        {!loading && !error && data ? (
          <>
            <ThemeMetaBlock theme={theme} themeName={themeLabel} />

            <section aria-labelledby="theme-performance-heading">
              <h2 id="theme-performance-heading" className="sr-only">
                Performance summary
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-4">
                  <p className="text-[9px] font-bold uppercase text-slate-500 flex items-center gap-1">
                    <TrendingUp size={12} className="opacity-70" />
                    テーマ評価額
                  </p>
                  <p className="text-xl font-mono font-bold text-slate-100 mt-1">
                    {data.themeTotalMarketValue > 0 ? jpyFmt.format(data.themeTotalMarketValue) : "—"}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-4">
                  <p className="text-[9px] font-bold uppercase text-slate-500">銘柄数</p>
                  <p className="text-xl font-mono font-bold text-slate-100 mt-1">{stocks.length}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-4">
                  <p className="text-[9px] font-bold uppercase text-slate-500">平均含み損益率</p>
                  <p className={`text-xl font-mono font-bold mt-1 ${pctClass(data.themeAverageUnrealizedPnlPercent)}`}>
                    {fmtPct(data.themeAverageUnrealizedPnlPercent)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-4">
                  <p className="text-[9px] font-bold uppercase text-slate-500">平均 Alpha（日次）</p>
                  <p className={`text-xl font-mono font-bold mt-1 ${pctClass(data.themeAverageAlpha)}`}>
                    {fmtPct(data.themeAverageAlpha)}
                  </p>
                </div>
              </div>
            </section>

            {stocks.length > 0 ? (
              <InventoryTable
                stocks={stocks}
                totalHoldings={stocks.length}
                averageAlpha={data.themeAverageAlpha}
                onTrade={(init) => openTradeForm(init)}
              />
            ) : null}

            {ecosystem.length > 0 ? (
              <section aria-labelledby="theme-ecosystem-heading">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
                  <div className="p-5 border-b border-slate-800 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between bg-slate-900/50">
                    <div className="flex items-start gap-2 min-w-0">
                      <Layers size={16} className="text-amber-500/90 shrink-0 mt-0.5" />
                      <div>
                        <h2
                          id="theme-ecosystem-heading"
                          className="text-xs font-bold text-slate-400 uppercase tracking-widest"
                        >
                          Ecosystem map / Watchlist
                        </h2>
                        <p className="text-[10px] text-slate-600 mt-0.5">
                          テーマ設置日起点の累積 Alpha（VOO 比）で観測。ポートフォリオ外の重要銘柄も含む（Notion 連携）
                        </p>
                      </div>
                    </div>
                    <p className="text-[10px] font-mono text-slate-600 shrink-0">
                      計 {ecosystem.length} 銘柄
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-950 text-slate-500 text-[10px] uppercase font-bold tracking-[0.1em]">
                        <tr>
                          <th className={`px-6 py-4 min-w-[10rem] max-w-[14rem] ${stickyThFirst}`}>Asset</th>
                          <th className="px-6 py-4 text-right">Cum. α</th>
                          <th className="px-6 py-4 text-center">Cumulative trend</th>
                          <th className="px-6 py-4 text-right">Last</th>
                        </tr>
                      </thead>
                      {ecosystemGroups.map(({ field, items }) => (
                        <tbody key={field} className="divide-y divide-slate-800/50">
                          <tr className="bg-slate-950/90">
                            <td
                              colSpan={4}
                              className="px-6 py-2 text-[10px] font-bold uppercase tracking-wider text-cyan-500/90 border-b border-slate-800"
                            >
                              {field}
                            </td>
                          </tr>
                          {items.map((e) => (
                            <tr key={e.id} className="group hover:bg-slate-800/40 transition-all">
                              <td className={`px-6 py-4 min-w-[10rem] max-w-[14rem] ${stickyTdFirst}`}>
                                <div className="flex flex-col gap-0.5">
                                  <div className="flex items-start justify-between gap-2">
                                    <span className="font-bold text-slate-100 group-hover:text-blue-400 transition-colors font-mono">
                                      {e.ticker}
                                    </span>
                                    <div className="flex flex-wrap gap-1 justify-end shrink-0">
                                      {e.isMajorPlayer ? (
                                        <span className="text-[8px] font-bold uppercase tracking-wide text-amber-400/95 border border-amber-500/35 px-1.5 py-0.5 rounded">
                                          Major
                                        </span>
                                      ) : null}
                                      {e.inPortfolio ? (
                                        <span className="text-[8px] font-bold uppercase tracking-wide text-emerald-400/95 border border-emerald-500/35 px-1.5 py-0.5 rounded">
                                          In portfolio
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                  {e.companyName ? (
                                    <span className="text-[10px] text-slate-400 leading-snug line-clamp-2" title={e.companyName}>
                                      {e.companyName}
                                    </span>
                                  ) : null}
                                  {e.role ? (
                                    <span className="text-[10px] text-slate-500 leading-snug line-clamp-2" title={e.role}>
                                      {e.role}
                                    </span>
                                  ) : null}
                                  {e.observationStartedAt ? (
                                    <span className="text-[10px] font-mono text-slate-600 pt-0.5">
                                      観測開始（投入）{" "}
                                      <span className="text-slate-500">{e.observationStartedAt}</span>
                                      {e.alphaObservationStartDate &&
                                      e.alphaObservationStartDate !== e.observationStartedAt ? (
                                        <span className="block text-[9px] text-slate-600 mt-0.5 font-normal">
                                          系列起点 {e.alphaObservationStartDate}
                                        </span>
                                      ) : null}
                                    </span>
                                  ) : e.alphaObservationStartDate ? (
                                    <span className="text-[10px] font-mono text-slate-600 pt-0.5">
                                      観測起点 <span className="text-slate-500">{e.alphaObservationStartDate}</span>
                                    </span>
                                  ) : null}
                                </div>
                              </td>
                              <td
                                className={`px-6 py-4 text-right font-mono font-bold ${
                                  e.latestAlpha != null && Number.isFinite(e.latestAlpha)
                                    ? pctClass(e.latestAlpha)
                                    : "text-slate-500"
                                }`}
                              >
                                {e.latestAlpha != null && Number.isFinite(e.latestAlpha) ? (
                                  <>
                                    {e.latestAlpha > 0 ? "+" : ""}
                                    {e.latestAlpha.toFixed(2)}%
                                  </>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td className="px-6 py-4">
                                <EcosystemCumulativeSparkline history={e.alphaHistory} />
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex flex-col items-end gap-1">
                                  <span className="font-mono text-slate-300 text-xs">
                                    {e.currentPrice != null && e.currentPrice > 0
                                      ? e.currentPrice < 500
                                        ? `$${e.currentPrice.toFixed(2)}`
                                        : `$${e.currentPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                                      : "—"}
                                  </span>
                                  {!e.inPortfolio ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openTradeForm({
                                          ticker: e.ticker,
                                          name: e.companyName || undefined,
                                          theme: themeLabel,
                                        })
                                      }
                                      className="text-[9px] font-bold uppercase tracking-wide text-cyan-400 border border-cyan-500/40 px-2 py-0.5 rounded-md hover:bg-cyan-500/10"
                                    >
                                      Trade
                                    </button>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      ))}
                    </table>
                  </div>
                </div>
              </section>
            ) : null}

            {/* Structural Progress (Cumulative Alpha) — 一時非表示
            {stocks.length > 0 && (data.cumulativeAlphaSeries?.length ?? 0) > 0 ? (
              <StructuralProgressChart
                series={data.cumulativeAlphaSeries}
                anchorDateLabel={data.cumulativeAlphaAnchorDate}
                totalPct={data.structuralAlphaTotalPct}
              />
            ) : null}
            */}

            {stocks.length > 0 ? (
              <section aria-labelledby="theme-charts-heading">
                <h2
                  id="theme-charts-heading"
                  className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3"
                >
                  Momentum cluster（保有銘柄 Alpha）
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {stocks.map((s) => (
                    <div
                      key={s.id}
                      className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 flex flex-col gap-2 min-h-[7.5rem]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-mono font-bold text-slate-100 text-sm">{s.ticker}</p>
                          {s.name ? (
                            <p className="text-[9px] text-slate-500 truncate" title={s.name}>
                              {s.name}
                            </p>
                          ) : null}
                        </div>
                        {s.alphaHistory.length > 0 ? (
                          <span
                            className={`text-[10px] font-mono font-bold shrink-0 ${
                              s.alphaHistory[s.alphaHistory.length - 1]! > 0
                                ? "text-emerald-400"
                                : s.alphaHistory[s.alphaHistory.length - 1]! < 0
                                  ? "text-rose-400"
                                  : "text-slate-400"
                            }`}
                          >
                            {s.alphaHistory[s.alphaHistory.length - 1]! > 0 ? "+" : ""}
                            {s.alphaHistory[s.alphaHistory.length - 1]}%
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-600">—</span>
                        )}
                      </div>
                      <div className="flex-1 flex items-center justify-center min-h-[3rem]">
                        {s.alphaHistory.length === 0 ? (
                          <span className="text-[10px] text-slate-600">No series</span>
                        ) : (
                          <TrendMiniChart history={s.alphaHistory} />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : (
              <p className="text-sm text-slate-500">このテーマに該当する保有がありません。</p>
            )}
          </>
        ) : null}

        <TradeEntryForm
          userId={DEFAULT_USER_ID}
          open={tradeFormOpen}
          initial={tradeInitial}
          onClose={() => {
            setTradeFormOpen(false);
            setTradeInitial(null);
          }}
          onSuccess={() => void load()}
        />
      </div>
    </div>
  );
}
