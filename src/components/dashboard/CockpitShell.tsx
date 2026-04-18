"use client";

import Link from "next/link";
import { Camera, Menu, RefreshCw, ScrollText, X } from "lucide-react";
import { usePathname } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";

import { DashboardHeader } from "@/src/components/dashboard/DashboardHeader";
import { TradeEntryForm } from "@/src/components/dashboard/TradeEntryForm";
import { EMPTY_SUMMARY, useDashboardData } from "@/src/components/dashboard/DashboardDataContext";
import { Sidebar } from "@/src/components/dashboard/Sidebar";
import { CockpitRouteFade } from "@/src/components/dashboard/CockpitRouteFade";
import { COCKPIT_MAIN_SCROLL_CLASS } from "@/src/components/dashboard/cockpit-layout-tokens";

function CockpitHydrationSkeleton() {
  return (
    <div className="flex h-dvh max-h-dvh flex-col bg-background text-foreground font-sans" aria-busy="true">
      <div className="flex min-h-0 flex-1 flex-row">
        <div className="hidden w-[13.5rem] shrink-0 border-r border-border bg-card/30 md:block" />
        <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:p-6">
          <div className="h-28 rounded-2xl bg-muted/15 animate-pulse" />
          <div className="h-24 rounded-2xl bg-muted/15 animate-pulse" />
          <div className="min-h-0 flex-1 rounded-2xl bg-muted/15 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

export function CockpitShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const hideHeader = useMemo(() => pathname === "/themes" || pathname.startsWith("/themes/"), [pathname]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [headerCompact, setHeaderCompact] = useState(false);

  useEffect(() => {
    // Close the drawer after navigation
    queueMicrotask(() => setMobileSidebarOpen(false));
  }, [pathname]);

  const {
    clientReady,
    userId,
    data,
    error,
    loading,
    slowLoading,
    actionMessage,
    refreshPending,
    snapshotPending,
    pending,
    tradeFormOpen,
    tradeInitial,
    loadDashboard,
    onGenerateSignals,
    onRefresh,
    onRecordSnapshot,
    openTradeForm,
    closeTradeForm,
  } = useDashboardData();

  const summary = data?.summary ?? EMPTY_SUMMARY;

  if (!clientReady) {
    return <CockpitHydrationSkeleton />;
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground font-sans overflow-x-hidden md:h-dvh md:max-h-dvh md:overflow-hidden">
      {/* Floating hamburger: stays clickable while scrolling */}
      <button
        type="button"
        onClick={() => setMobileSidebarOpen(true)}
        className="fixed left-[max(0.75rem,env(safe-area-inset-left))] top-[max(0.75rem,env(safe-area-inset-top))] z-[95] inline-flex items-center gap-2 rounded-xl border border-border bg-background/85 px-3 py-2 text-xs font-bold text-foreground/80 shadow-lg backdrop-blur-sm hover:bg-muted md:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-4 w-4" aria-hidden />
        Menu
      </button>

      <div className="flex flex-1 flex-row min-w-0 md:min-h-0">
        {/* Desktop sidebar */}
        <div
          className={`hidden md:block shrink-0 self-stretch h-full overflow-hidden transition-[width] duration-200 ease-out ${
            sidebarOpen ? "w-[13.5rem]" : "w-14"
          }`}
        >
          {sidebarOpen ? (
            <Sidebar
              collapsed={false}
              onToggleCollapse={() => setSidebarOpen((v) => !v)}
            />
          ) : (
            <div className="h-full border-r border-border bg-card/40 backdrop-blur-sm">
              <div className="flex h-full flex-col items-center gap-3 px-2 py-3">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="inline-flex items-center justify-center rounded-xl border border-border bg-background/70 p-2 text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground"
                  aria-label="Show sidebar"
                  title="Show sidebar"
                >
                  <Menu className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Mobile/tablet sidebar drawer */}
        {mobileSidebarOpen ? (
          <div className="fixed inset-0 z-[90] md:hidden" role="presentation">
            <button
              type="button"
              className="absolute inset-0 bg-background/70 backdrop-blur-[2px]"
              aria-label="Close navigation"
              onClick={() => setMobileSidebarOpen(false)}
            />
            <div className="absolute inset-y-0 left-0 w-[15rem] max-w-[84vw] shadow-2xl">
              <Sidebar onNavigate={() => setMobileSidebarOpen(false)} />
            </div>
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col">
          {!hideHeader ? (
            <div
              className={`shrink-0 border-b border-border bg-background/92 backdrop-blur-sm transition-all md:sticky md:top-0 md:z-[60] ${
                headerCompact ? "px-4 py-1.5 md:px-6 md:py-2" : "px-4 py-3 md:px-6 md:py-4"
              }`}
            >
              <DashboardHeader
                totalAlpha={summary.portfolioAverageAlpha}
                portfolioFxNeutralAlpha={
                  summary.portfolioAverageFxNeutralAlpha ?? summary.portfolioAverageAlpha
                }
                benchmarkPrice={summary.benchmarkLatestPrice}
                benchmarkChangePct={summary.benchmarkChangePct}
                benchmarkPriceSource={summary.benchmarkPriceSource ?? "close"}
                benchmarkAsOf={summary.benchmarkAsOf ?? null}
                portfolioAvgAlphaAsOfDisplay={summary.portfolioAvgAlphaAsOfDisplay ?? null}
                portfolioAvgDayChangePct={summary.portfolioAvgDayChangePct ?? null}
                marketIndicators={summary.marketIndicators ?? []}
                compact={headerCompact}
              />
            </div>
          ) : (
            <div className="shrink-0 border-b border-border bg-background/95 px-4 py-2 md:hidden">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setMobileSidebarOpen(true)}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-card/50 px-3 py-2 text-xs font-bold text-foreground/80 hover:bg-muted"
                  aria-label="Open navigation"
                >
                  <Menu className="h-4 w-4" aria-hidden />
                  Menu
                </button>
                <Link
                  href="/"
                  className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground/80"
                >
                  Cockpit
                </Link>
              </div>
            </div>
          )}

          <div className="flex shrink-0 flex-col gap-3 border-b border-border bg-card/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between md:px-6">
            <div className="text-xs text-muted-foreground">
              <span className="font-bold uppercase tracking-wider text-muted-foreground/90">Profile</span>{" "}
              <span className="font-mono text-foreground/90">{userId}</span>
              {loading && (
                <span className="ml-2 text-muted-foreground/80">
                  Loading…
                  {slowLoading ? (
                    <span className="ml-2 text-muted-foreground/80">通信に時間がかかっています...</span>
                  ) : null}
                </span>
              )}
              {error && (
                <span className="ml-2 mt-1 block text-rose-400 sm:mt-0 sm:inline">{error}</span>
              )}
              {actionMessage && (
                <span
                  className={`ml-2 mt-1 block sm:mt-0 sm:inline ${
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
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[10px] font-bold text-muted-foreground transition-all hover:bg-muted"
              >
                <ScrollText size={14} />
                ログ
              </Link>
              <button
                type="button"
                onClick={() => setMobileSidebarOpen((v) => !v)}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card/50 px-3 py-2 text-[10px] font-bold text-foreground/70 transition-all hover:bg-muted md:hidden"
                aria-label={mobileSidebarOpen ? "Close navigation" : "Open navigation"}
              >
                {mobileSidebarOpen ? <X size={14} /> : <Menu size={14} />}
                Menu
              </button>
              <button
                type="button"
                onClick={() => openTradeForm(null)}
                disabled={!!error || loading}
                className="flex items-center gap-2 rounded-lg border border-cyan-500/35 px-3 py-2 text-[10px] font-bold text-cyan-300 transition-all hover:bg-cyan-500/10 disabled:opacity-50"
              >
                取引入力
              </button>
              {error ? (
                <button
                  type="button"
                  onClick={() => void loadDashboard()}
                  disabled={loading}
                  className="flex items-center gap-2 rounded-lg border border-rose-500/35 px-3 py-2 text-[10px] font-bold text-rose-200 transition-all hover:bg-rose-500/10 disabled:opacity-50"
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
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[10px] font-bold text-foreground/80 transition-all hover:bg-muted disabled:opacity-50"
              >
                <RefreshCw size={14} className={refreshPending || loading ? "animate-spin" : ""} />
                Refresh
              </button>
              <button
                type="button"
                onClick={onGenerateSignals}
                disabled={pending || !!error || loading}
                className="flex items-center gap-2 rounded-lg border border-amber-400/40 px-3 py-2 text-[10px] font-bold text-amber-400 transition-all hover:bg-amber-400/10 disabled:opacity-50"
              >
                <RefreshCw size={14} className={pending ? "animate-spin" : ""} />
                Generate signals
              </button>
              <button
                type="button"
                onClick={onRecordSnapshot}
                disabled={snapshotPending || !!error || loading}
                className="flex items-center gap-2 rounded-lg border border-cyan-500/35 px-3 py-2 text-[10px] font-bold text-cyan-400 transition-all hover:bg-cyan-500/10 disabled:opacity-50"
                title="Writes portfolio_daily_snapshots + holding_daily_snapshots (UTC date). Same day overwrites."
              >
                <Camera size={14} className={snapshotPending ? "animate-pulse" : ""} />
                Record snapshot
              </button>
            </div>
          </div>

          <div
            className={`${COCKPIT_MAIN_SCROLL_CLASS} cockpit-main-surface`}
            onScroll={(e) => {
              if (typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches === false) {
                return;
              }
              const top = (e.currentTarget as HTMLDivElement).scrollTop;
              setHeaderCompact(top > 12);
            }}
          >
            {error && data == null ? (
              <div className="rounded-2xl border border-rose-500/25 bg-rose-500/5 p-5">
                <p className="text-sm font-bold text-rose-300">データ取得に失敗しました</p>
                <p className="mt-1 text-xs text-rose-200/80">{error}</p>
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => void loadDashboard()}
                    className="inline-flex items-center gap-2 rounded-lg border border-rose-500/35 px-4 py-2 text-[11px] font-bold text-rose-100 transition-all hover:bg-rose-500/10"
                  >
                    <RefreshCw size={14} />
                    再読み込み（Retry）
                  </button>
                </div>
              </div>
            ) : loading && data == null ? (
              <div className="space-y-4 pb-4" aria-busy="true">
                <div className="h-36 rounded-2xl bg-muted/15 animate-pulse" />
                <div className="h-48 rounded-2xl bg-muted/15 animate-pulse" />
              </div>
            ) : (
              <CockpitRouteFade>{children}</CockpitRouteFade>
            )}
          </div>
        </div>
      </div>

      <TradeEntryForm
        userId={userId}
        open={tradeFormOpen}
        initial={tradeInitial}
        onClose={closeTradeForm}
        onSuccess={() => void loadDashboard()}
        fxUsdJpy={summary.fxUsdJpy}
        holdingOptions={(data?.stocks ?? []).map((s) => ({ ticker: s.ticker, name: s.name }))}
      />
    </div>
  );
}
