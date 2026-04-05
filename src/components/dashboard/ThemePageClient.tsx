"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import type { DashboardSummary, Stock } from "@/src/types/investment";
import { TrendMiniChart } from "@/src/components/dashboard/TrendMiniChart";

const DEFAULT_USER_ID =
  typeof process.env.NEXT_PUBLIC_DEFAULT_PROFILE_USER_ID === "string" &&
  process.env.NEXT_PUBLIC_DEFAULT_PROFILE_USER_ID.length > 0
    ? process.env.NEXT_PUBLIC_DEFAULT_PROFILE_USER_ID
    : "user-satoshi";

const EMPTY_SUMMARY: DashboardSummary = {
  portfolioAverageAlpha: 0,
  benchmarkLatestPrice: 0,
  totalHoldings: 0,
  totalCostBasisJpy: 0,
  totalRealizedPnlJpy: 0,
  totalProfitJpy: 0,
  totalReturnPct: 0,
};

type DashboardJson = {
  userId?: string;
  stocks?: Stock[];
  summary?: Partial<DashboardSummary>;
  error?: string;
};

function stocksForTheme(stocks: Stock[], themeLabel: string): Stock[] {
  return stocks.filter((s) => s.tag === themeLabel);
}

export function ThemePageClient({ themeLabel }: { themeLabel: string }) {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [summary, setSummary] = useState<DashboardSummary>(EMPTY_SUMMARY);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard?userId=${encodeURIComponent(DEFAULT_USER_ID)}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as DashboardJson;
      if (!res.ok) {
        setStocks([]);
        setError(json.error ?? `HTTP ${res.status}`);
        return;
      }
      const all = json.stocks ?? [];
      setStocks(stocksForTheme(all, themeLabel));
      setSummary({ ...EMPTY_SUMMARY, ...(json.summary ?? {}) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setStocks([]);
    } finally {
      setLoading(false);
    }
  }, [themeLabel]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalMv = useMemo(() => stocks.reduce((s, x) => s + (x.marketValue > 0 ? x.marketValue : 0), 0), [stocks]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="border-b border-slate-800 pb-6">
          <Link
            href="/"
            className="inline-flex text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-cyan-400 mb-3"
          >
            ← ダッシュボード
          </Link>
          <h1 className="text-2xl font-bold text-white tracking-tight">テーマ: {themeLabel}</h1>
          <p className="text-[10px] text-slate-600 mt-2">
            構造投資テーマ（structure_tags の先頭）が一致する保有のみ表示。プロファイル{" "}
            <span className="font-mono text-slate-500">{DEFAULT_USER_ID}</span>
          </p>
        </div>

        {loading ? <p className="text-sm text-slate-500">読み込み中…</p> : null}
        {error ? <p className="text-sm text-rose-400">{error}</p> : null}

        {!loading && !error ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
              <p className="text-[9px] font-bold uppercase text-slate-500">銘柄数</p>
              <p className="text-lg font-mono font-bold text-slate-100">{stocks.length}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
              <p className="text-[9px] font-bold uppercase text-slate-500">テーマ内評価額（円）</p>
              <p className="text-lg font-mono font-bold text-slate-100">
                {totalMv > 0 ? `¥${Math.round(totalMv).toLocaleString()}` : "—"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 col-span-2">
              <p className="text-[9px] font-bold uppercase text-slate-500">ポートフォリオ平均 Alpha（全体）</p>
              <p className="text-lg font-mono font-bold text-slate-100">
                {Number.isFinite(summary.portfolioAverageAlpha)
                  ? `${summary.portfolioAverageAlpha > 0 ? "+" : ""}${summary.portfolioAverageAlpha.toFixed(2)}%`
                  : "—"}
              </p>
            </div>
          </div>
        ) : null}

        {!loading && !error && stocks.length === 0 ? (
          <p className="text-sm text-slate-500">このテーマに該当する保有がありません。</p>
        ) : null}

        {!loading && stocks.length > 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-800">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">保有一覧</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950 text-slate-500 text-[10px] uppercase font-bold">
                  <tr>
                    <th className="px-4 py-3">銘柄</th>
                    <th className="px-4 py-3">セクター</th>
                    <th className="px-4 py-3 text-right">Alpha</th>
                    <th className="px-4 py-3 text-center">5D</th>
                    <th className="px-4 py-3 text-right">評価額</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {stocks.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-800/30">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-100 font-mono">{s.ticker}</div>
                        {s.name ? <div className="text-[10px] text-slate-500 truncate max-w-[12rem]">{s.name}</div> : null}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400 max-w-[8rem] truncate" title={s.secondaryTag}>
                        {s.sector?.trim() ? s.sector : s.secondaryTag}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs">
                        {s.alphaHistory.length === 0
                          ? "—"
                          : `${s.alphaHistory[s.alphaHistory.length - 1]! > 0 ? "+" : ""}${s.alphaHistory[s.alphaHistory.length - 1]}%`}
                      </td>
                      <td className="px-4 py-3 w-28">
                        {s.alphaHistory.length === 0 ? (
                          <span className="text-slate-600 text-xs">—</span>
                        ) : (
                          <TrendMiniChart history={s.alphaHistory} />
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-slate-300">
                        {s.marketValue > 0 ? `¥${Math.round(s.marketValue).toLocaleString()}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
