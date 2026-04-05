"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Crosshair, TrendingUp } from "lucide-react";

import type { InvestmentThemeRecord, Stock, ThemeDetailData } from "@/src/types/investment";
import { InventoryTable } from "@/src/components/dashboard/InventoryTable";
import { TradeEntryForm, type TradeEntryInitial } from "@/src/components/dashboard/TradeEntryForm";
import { TrendMiniChart } from "@/src/components/dashboard/TrendMiniChart";

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
      setData(rest as ThemeDetailData);
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
              <section aria-labelledby="theme-charts-heading">
                <h2
                  id="theme-charts-heading"
                  className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3"
                >
                  Momentum cluster（各銘柄 Alpha）
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

            {stocks.length > 0 ? (
              <InventoryTable
                stocks={stocks}
                totalHoldings={stocks.length}
                averageAlpha={data.themeAverageAlpha}
                onTrade={(init) => openTradeForm(init)}
              />
            ) : null}
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
