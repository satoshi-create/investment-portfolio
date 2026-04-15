'use client';

import React, { useCallback, useEffect, useState, useTransition } from "react";

import { recordPortfolioSnapshotAction } from "@/app/actions/snapshot";
import { generateSignalsAction } from "@/app/actions/signals";
import { defaultProfileUserId } from "@/src/lib/authorize-signals";
import { fetchWithTimeout } from "@/src/lib/fetch-utils";
import type { DashboardSummary, InvestmentThemeRecord, Signal, Stock, StructureTagSlice } from "@/src/types/investment";
import { DashboardHeader } from "@/src/components/dashboard/DashboardHeader";
import { HoldingsDetailTable } from "@/src/components/dashboard/HoldingsDetailTable";
import { InventoryTable } from "@/src/components/dashboard/InventoryTable";
import { SignalsSection } from "@/src/components/dashboard/SignalsSection";
import { StrategySection } from "@/src/components/dashboard/StrategySection";
import { ThemesNavigationSection } from "@/src/components/dashboard/ThemesNavigationSection";
import { TradeEntryForm, type TradeEntryInitial } from "@/src/components/dashboard/TradeEntryForm";
import Link from "next/link";
import { Camera, RefreshCw, ScrollText } from "lucide-react";
import { toast } from "sonner";

const DEFAULT_USER_ID = defaultProfileUserId();

const EMPTY_SUMMARY: DashboardSummary = {
  portfolioAverageAlpha: 0,
  benchmarkLatestPrice: 0,
  benchmarkChangePct: null,
  benchmarkPriceSource: "close",
  benchmarkAsOf: null,
  fxUsdJpy: null,
  totalHoldings: 0,
  marketIndicators: [],
  goldPrice: null,
  btcPrice: null,
  totalCostBasisJpy: 0,
  totalRealizedPnlJpy: 0,
  totalProfitJpy: 0,
  totalReturnPct: 0,
  portfolioAvgDayChangePct: null,
};

type DashboardPayload = {
  userId: string;
  stocks: Stock[];
  allThemes: InvestmentThemeRecord[];
  signals: Signal[];
  structureBySector: StructureTagSlice[];
  totalMarketValue: number;
  summary: DashboardSummary;
};

export function DashboardPage() {
  /** Lucide SVG を SSR→クライアントでハイドレーションすると、Dark Reader 等が DOM に挿入した属性で不一致になる。マウント後のみ本体を描画する。 */
  const [clientReady, setClientReady] = useState(false);
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [slowLoading, setSlowLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [refreshPending, startRefreshTransition] = useTransition();
  const [snapshotPending, startSnapshotTransition] = useTransition();
  const [tradeFormOpen, setTradeFormOpen] = useState(false);
  const [tradeInitial, setTradeInitial] = useState<TradeEntryInitial | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setSlowLoading(false);
    setError(null);
    const slowTimer = setTimeout(() => setSlowLoading(true), 3000);
    try {
      const res = await fetchWithTimeout(`/api/dashboard?userId=${encodeURIComponent(DEFAULT_USER_ID)}`, {
        cache: "no-store",
      }, { timeoutMs: 12_000 });
      const json = (await res.json()) as Partial<DashboardPayload> & { error?: string; hint?: string };
      if (!res.ok) {
        // Keep last good snapshot on failures so the screen doesn't go blank.
        setError(json.error ?? `HTTP ${res.status}${json.hint ? ` — ${json.hint}` : ""}`);
        return;
      }
      setData({
        userId: json.userId!,
        stocks: json.stocks ?? [],
        allThemes: json.allThemes ?? [],
        signals: json.signals ?? [],
        structureBySector: json.structureBySector ?? [],
        totalMarketValue: json.totalMarketValue ?? 0,
        summary: { ...EMPTY_SUMMARY, ...(json.summary ?? {}) },
      });
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        setError("接続タイムアウト：通信環境を確認してください");
      } else {
        setError(e instanceof Error ? e.message : "Failed to load dashboard");
      }
    } finally {
      clearTimeout(slowTimer);
      setSlowLoading(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    setClientReady(true);
  }, []);

  const onGenerateSignals = () => {
    setActionMessage(null);
    startTransition(async () => {
      const result = await generateSignalsAction(DEFAULT_USER_ID);
      setActionMessage(result.message);
      await loadDashboard();
    });
  };

  /** Re-link / backfill alpha_history (via server action → generate pipeline), then reload dashboard data. */
  const onRefresh = () => {
    setActionMessage(null);
    startRefreshTransition(async () => {
      const result = await generateSignalsAction(DEFAULT_USER_ID);
      setActionMessage(result.message);
      await loadDashboard();
    });
  };

  const onRecordSnapshot = () => {
    setActionMessage(null);
    startSnapshotTransition(async () => {
      const result = await recordPortfolioSnapshotAction(DEFAULT_USER_ID);
      setActionMessage(result.message);
      // Sonner inside startTransition can be deferred or obscured; fire on the next task + high z-index Toaster.
      const msg = result.message;
      setTimeout(() => {
        if (result.ok) toast.success(msg, { duration: 10_000 });
        else toast.error(msg, { duration: 12_000 });
      }, 0);
      if (result.ok) await loadDashboard();
    });
  };

  const stocks = data?.stocks ?? [];
  const allThemes = data?.allThemes ?? [];
  const signals = data?.signals ?? [];
  const structureBySector = data?.structureBySector ?? [];
  const totalMarketValue = data?.totalMarketValue ?? 0;
  const summary = data?.summary ?? EMPTY_SUMMARY;

  const portfolioThemeSet = new Set(
    stocks.map((s) => (s.tag ?? "").trim()).filter((x) => x.length > 0),
  );

  const satelliteStockCount = stocks.filter(
    (s) => s.category === "Satellite" && s.quantity > 0 && s.marketValue > 0,
  ).length;

  const openTradeForm = useCallback((initial: TradeEntryInitial | null) => {
    setTradeInitial(initial);
    setTradeFormOpen(true);
  }, []);

  if (!clientReady) {
    return (
      <div className="min-h-screen bg-background text-foreground p-4 md:p-8 font-sans">
        <div className="max-w-6xl mx-auto space-y-6" aria-busy="true">
          <div className="h-28 rounded-2xl border border-border bg-muted/20 animate-pulse" />
          <div className="h-24 rounded-2xl border border-border bg-muted/20 animate-pulse" />
          <div className="h-64 rounded-2xl border border-border bg-muted/20 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Initial load skeleton (keeps layout stable even when offline/slow). */}
        {loading && data == null ? (
          <div className="space-y-4" aria-busy="true">
            <div className="h-28 rounded-2xl border border-border bg-muted/20 animate-pulse" />
            <div className="h-24 rounded-2xl border border-border bg-muted/20 animate-pulse" />
            <div className="h-64 rounded-2xl border border-border bg-muted/20 animate-pulse" />
            <div className="h-80 rounded-2xl border border-border bg-muted/20 animate-pulse" />
          </div>
        ) : null}

        <DashboardHeader
          totalAlpha={summary.portfolioAverageAlpha}
          benchmarkPrice={summary.benchmarkLatestPrice}
          benchmarkChangePct={summary.benchmarkChangePct}
          benchmarkPriceSource={summary.benchmarkPriceSource ?? "close"}
          benchmarkAsOf={summary.benchmarkAsOf ?? null}
          portfolioAvgDayChangePct={summary.portfolioAvgDayChangePct ?? null}
          marketIndicators={summary.marketIndicators ?? []}
        />

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-border bg-card/60 px-4 py-3">
          <div className="text-xs text-muted-foreground">
            <span className="font-bold uppercase tracking-wider text-muted-foreground/90">Profile</span>{" "}
            <span className="text-foreground/90 font-mono">{DEFAULT_USER_ID}</span>
            {loading && (
              <span className="ml-2 text-muted-foreground/80">
                Loading…
                {slowLoading ? (
                  <span className="ml-2 text-muted-foreground/80">
                    通信に時間がかかっています...
                  </span>
                ) : null}
              </span>
            )}
            {error && (
              <span className="ml-2 text-rose-400 block sm:inline mt-1 sm:mt-0">{error}</span>
            )}
            {actionMessage && (
              <span
                className={`ml-2 block sm:inline mt-1 sm:mt-0 ${
                  actionMessage.includes("failed") ||
                  actionMessage.includes("not configured") ||
                  actionMessage.includes("missing") ||
                  actionMessage.includes("Table missing")
                    ? "text-rose-400"
                    : "text-emerald-400"
                }`}
              >
                {actionMessage}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/logs"
                className="text-[10px] font-bold text-muted-foreground border border-border px-3 py-2 rounded-lg hover:bg-muted transition-all flex items-center gap-2"
            >
              <ScrollText size={14} />
              ログ
            </Link>
            <button
              type="button"
              onClick={() => openTradeForm(null)}
              disabled={!!error || loading}
              className="text-[10px] font-bold text-cyan-300 border border-cyan-500/35 px-3 py-2 rounded-lg hover:bg-cyan-500/10 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              取引入力
            </button>
            {error ? (
              <button
                type="button"
                onClick={() => void loadDashboard()}
                disabled={loading}
                className="text-[10px] font-bold text-rose-200 border border-rose-500/35 px-3 py-2 rounded-lg hover:bg-rose-500/10 transition-all flex items-center gap-2 disabled:opacity-50"
                title="データ取得を再試行"
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                再読み込み（Retry）
              </button>
            ) : null}
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshPending || !!error || loading}
              className="text-[10px] font-bold text-foreground/80 border border-border px-3 py-2 rounded-lg hover:bg-muted transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw size={14} className={refreshPending || loading ? "animate-spin" : ""} />
              Refresh
            </button>
            <button
              type="button"
              onClick={onGenerateSignals}
              disabled={pending || !!error || loading}
              className="text-[10px] font-bold text-amber-400 border border-amber-400/40 px-3 py-2 rounded-lg hover:bg-amber-400/10 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw size={14} className={pending ? "animate-spin" : ""} />
              Generate signals
            </button>
            <button
              type="button"
              onClick={onRecordSnapshot}
              disabled={snapshotPending || !!error || loading}
              className="text-[10px] font-bold text-cyan-400 border border-cyan-500/35 px-3 py-2 rounded-lg hover:bg-cyan-500/10 transition-all flex items-center gap-2 disabled:opacity-50"
              title="Writes portfolio_daily_snapshots + holding_daily_snapshots (UTC date). Same day overwrites."
            >
              <Camera size={14} className={snapshotPending ? "animate-pulse" : ""} />
              Record snapshot
            </button>
          </div>
        </div>

        {/* Clear error card when there's no cached snapshot */}
        {error && data == null ? (
          <div className="rounded-2xl border border-rose-500/25 bg-rose-500/5 p-5">
            <p className="text-sm font-bold text-rose-300">データ取得に失敗しました</p>
            <p className="text-xs text-rose-200/80 mt-1">{error}</p>
            <div className="mt-4">
              <button
                type="button"
                onClick={() => void loadDashboard()}
                className="text-[11px] font-bold text-rose-100 border border-rose-500/35 px-4 py-2 rounded-lg hover:bg-rose-500/10 transition-all inline-flex items-center gap-2"
              >
                <RefreshCw size={14} />
                再読み込み（Retry）
              </button>
            </div>
          </div>
        ) : null}

        <StrategySection
          structureBySector={structureBySector}
          satelliteStockCount={satelliteStockCount}
          totalMarketValue={totalMarketValue}
          totalProfitJpy={summary.totalProfitJpy}
          totalReturnPct={summary.totalReturnPct}
          totalCostBasisJpy={summary.totalCostBasisJpy}
          fxUsdJpy={summary.fxUsdJpy}
        />
        <SignalsSection
          signals={signals}
          userId={DEFAULT_USER_ID}
          onSignalResolved={() => void loadDashboard()}
          onTrade={(init) => openTradeForm(init)}
        />
        <InventoryTable
          stocks={stocks}
          totalHoldings={summary.totalHoldings}
          averageAlpha={summary.portfolioAverageAlpha}
          onTrade={(init) => openTradeForm(init)}
          onTradeNew={() => openTradeForm(null)}
        />
        <ThemesNavigationSection
          themes={allThemes}
          inPortfolioThemeNames={portfolioThemeSet}
        />
        <HoldingsDetailTable stocks={stocks} />
        <TradeEntryForm
          userId={DEFAULT_USER_ID}
          open={tradeFormOpen}
          initial={tradeInitial}
          onClose={() => {
            setTradeFormOpen(false);
            setTradeInitial(null);
          }}
          onSuccess={() => void loadDashboard()}
          fxUsdJpy={summary.fxUsdJpy}
          holdingOptions={stocks.map((s) => ({ ticker: s.ticker, name: s.name }))}
        />
      </div>
    </div>
  );
}
