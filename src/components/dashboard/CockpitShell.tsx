"use client";

import Link from "next/link";
import { Camera, Flame, LineChart, Menu, RefreshCw, ScrollText, X, Zap } from "lucide-react";
import { usePathname } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";

import { CockpitStockSearch } from "@/src/components/dashboard/CockpitStockSearch";
import { DashboardHeader } from "@/src/components/dashboard/DashboardHeader";
import { EventCalendarModal } from "@/src/components/dashboard/EventCalendarModal";
import { MarketBar } from "@/src/components/dashboard/MarketBar";
import { LiveSignalsStrip } from "@/src/components/dashboard/LiveSignalsStrip";
import { TradeEntryForm } from "@/src/components/dashboard/TradeEntryForm";
import { EMPTY_SUMMARY, useDashboardData } from "@/src/components/dashboard/DashboardDataContext";
import { Sidebar } from "@/src/components/dashboard/Sidebar";
import { StorySidePanel } from "@/src/components/dashboard/StorySidePanel";
import { useStoryPanel } from "@/src/components/dashboard/StoryPanelContext";
import { CockpitRouteFade } from "@/src/components/dashboard/CockpitRouteFade";
import { COCKPIT_MAIN_SCROLL_CLASS } from "@/src/components/dashboard/cockpit-layout-tokens";
import { ThemeToggle } from "@/src/components/dashboard/ThemeToggle";
import { useCurrencyConverter } from "@/src/hooks/use-currency-converter";
import { cn } from "@/src/lib/cn";
import { resolveStockCompoundingIgnited } from "@/src/lib/alpha-logic";
import { STORY_PANEL_PAGE_PAD_TRANSITION_CLASS } from "@/src/lib/story-panel-inset";

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
  const isHome = pathname === "/";
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [headerCompact, setHeaderCompact] = useState(false);
  const [marketOpen, setMarketOpen] = useState(false);
  const [koyomiOpen, setKoyomiOpen] = useState(false);
  const { viewCurrency, setViewCurrency } = useCurrencyConverter();

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
    resolveSignalOptimistic,
    setFocusedTicker,
  } = useDashboardData();

  const { storyOpen, panelWidth, setPanelWidth, closeStory, runAfterSave } = useStoryPanel();

  useEffect(() => {
    if (pathname !== "/") setFocusedTicker(null);
  }, [pathname, setFocusedTicker]);

  const summary = data?.summary ?? EMPTY_SUMMARY;
  const signals = data?.signals ?? [];

  const structuralCompoundingIgnitionStripModel = useMemo(() => {
    const stocks = data?.stocks;
    const ecosystemSearch = data?.ecosystemWatchlistSearch;
    if (stocks == null) return null;

    // 1. 保有銘柄の点火済みを抽出
    const ignitedStocks = stocks.filter((s) => resolveStockCompoundingIgnited(s));

    // 2. 観測銘柄（非保有）の点火済みを抽出
    const portfolioTickerSet = new Set(stocks.map((s) => s.ticker.toUpperCase()));
    const ignitedEcosystemAll = (ecosystemSearch ?? []).filter(
      (item) => item.isCompoundingIgnited && !portfolioTickerSet.has(item.ticker.toUpperCase()),
    );

    // エコシステム内でティッカーの重複を排除（複数のテーマに属する場合があるため）
    const ignitedEcosystemUniqueMap = new Map<string, (typeof ignitedEcosystemAll)[0]>();
    for (const item of ignitedEcosystemAll) {
      const t = item.ticker.toUpperCase();
      if (!ignitedEcosystemUniqueMap.has(t)) {
        ignitedEcosystemUniqueMap.set(t, item);
      }
    }
    const ignitedEcosystem = [...ignitedEcosystemUniqueMap.values()];

    const ignitedTotal = ignitedStocks.length + ignitedEcosystem.length;
    if (ignitedTotal === 0) {
      return { ignitedTotal: 0, themeLines: [], otherThemeGroups: 0, tickerLinks: [], otherTickers: 0 };
    }

    // テーマ（タグ）別の集計
    const byTagMap = new Map<string, number>();
    for (const s of ignitedStocks) {
      const raw = String(s.tag ?? "").trim();
      const key = raw.length > 0 ? raw : "その他";
      byTagMap.set(key, (byTagMap.get(key) ?? 0) + 1);
    }
    for (const item of ignitedEcosystemAll) {
      const raw = String(item.themeName ?? "").trim();
      const key = raw.length > 0 ? raw : "その他";
      byTagMap.set(key, (byTagMap.get(key) ?? 0) + 1);
    }

    const sortedTags = [...byTagMap.entries()].sort((a, b) => b[1] - a[1]);
    const maxThemeLines = 2;
    const themeLines = sortedTags.slice(0, maxThemeLines).map(([label, count]) => ({
      label,
      count,
      href: label === "その他" ? undefined : `/themes/${encodeURIComponent(label)}?ignition=1`,
    }));
    const otherThemeGroups = Math.max(0, sortedTags.length - maxThemeLines);

    // ティッカーリンクの作成（保有優先、次に観測）
    const sortedIgnitedStocks = [...ignitedStocks].sort((a, b) => b.marketValue - a.marketValue);
    const topStocks = sortedIgnitedStocks.slice(0, 3);
    const tickerLinks = topStocks.map((s) => ({
      ticker: s.ticker,
      href: `/?ticker=${encodeURIComponent(s.ticker)}`,
    }));

    if (tickerLinks.length < 3) {
      const remaining = 3 - tickerLinks.length;
      const topEcosystem = ignitedEcosystem.slice(0, remaining);
      for (const item of topEcosystem) {
        tickerLinks.push({
          ticker: item.ticker,
          href: `/themes/${encodeURIComponent(item.themeName)}?ignition=1`,
        });
      }
    }

    const otherTickers = Math.max(0, ignitedTotal - tickerLinks.length);
    return { ignitedTotal, themeLines, otherThemeGroups, tickerLinks, otherTickers };
  }, [data?.stocks, data?.ecosystemWatchlistSearch]);

  useEffect(() => {
    if (!marketOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMarketOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [marketOpen]);

  useEffect(() => {
    if (!marketOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [marketOpen]);

  if (!clientReady) {
    return <CockpitHydrationSkeleton />;
  }

  return (
    <div className="flex h-dvh max-h-dvh min-h-0 flex-col overflow-x-hidden overflow-hidden bg-background text-foreground font-sans">
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

      <div className="flex min-h-0 flex-1 flex-row min-w-0">
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
              signals={signals}
              liveSignalsPresentation={isHome ? "prominent" : "compact"}
              signalUserId={userId}
              onSignalResolved={resolveSignalOptimistic}
              onSignalTrade={(init) => openTradeForm(init)}
              ignitionCount={structuralCompoundingIgnitionStripModel?.ignitedTotal ?? 0}
            />
          ) : (
            <div className="h-full border-r border-border bg-card/40 backdrop-blur-sm">
              <div className="flex h-full flex-col items-center px-2 py-3">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="inline-flex items-center justify-center rounded-xl border border-border bg-background/70 p-2 text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground"
                  aria-label="Show sidebar"
                  title="Show sidebar"
                >
                  <Menu className="h-4 w-4" aria-hidden />
                </button>
                <Link
                  href="/signals?ignition=1"
                  prefetch
                  className="mt-auto inline-flex flex-col items-center gap-0.5 rounded-lg border border-cyan-500/30 bg-cyan-950/20 px-1.5 py-2 text-[9px] font-bold text-cyan-300 hover:bg-cyan-900/30"
                  title={`複利点火: ${structuralCompoundingIgnitionStripModel?.ignitedTotal ?? 0} 件`}
                >
                  <Flame className="h-4 w-4 text-cyan-400 animate-pulse" aria-hidden />
                  <span className="font-mono tabular-nums">{structuralCompoundingIgnitionStripModel?.ignitedTotal ?? 0}</span>
                </Link>
                <Link
                  href="/signals"
                  prefetch
                  className="mt-2 inline-flex flex-col items-center gap-0.5 rounded-lg border border-border bg-background/60 px-1.5 py-2 text-[9px] font-bold text-muted-foreground hover:bg-muted hover:text-foreground"
                  title="Live Signals"
                  aria-label={`Signals${signals.length > 0 ? `: ${signals.length} unresolved` : ""}`}
                >
                  <Zap className="h-4 w-4 text-amber-400" aria-hidden />
                  <span className="font-mono tabular-nums text-foreground">{signals.length}</span>
                </Link>
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
              <Sidebar
                onNavigate={() => setMobileSidebarOpen(false)}
                signals={signals}
                liveSignalsPresentation={isHome ? "prominent" : "compact"}
                signalUserId={userId}
                onSignalResolved={resolveSignalOptimistic}
                onSignalTrade={(init) => openTradeForm(init)}
                ignitionCount={structuralCompoundingIgnitionStripModel?.ignitedTotal ?? 0}
              />
            </div>
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 min-w-0 flex-row items-stretch">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div
            className={cn(
              "cockpit-chrome-inset flex shrink-0 flex-col",
              STORY_PANEL_PAGE_PAD_TRANSITION_CLASS,
            )}
          >
          {!hideHeader ? (
            <div
              className={`shrink-0 border-b border-border bg-background/92 backdrop-blur-sm transition-all md:sticky md:top-0 md:z-[60] ${
                headerCompact ? "px-4 py-1.5 md:px-6 md:py-2" : "px-4 py-3 md:px-6 md:py-4"
              }`}
            >
              <DashboardHeader
                dailyAvgAlpha={summary.portfolioAverageAlpha}
                portfolioFxNeutralAlpha={
                  summary.portfolioAverageFxNeutralAlpha ?? summary.portfolioAverageAlpha
                }
                averageDailyAlphaPct={summary.averageDailyAlphaPct ?? null}
                totalLiveAlphaPct={summary.portfolioTotalLiveAlphaPct ?? null}
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
            <div className="shrink-0 border-b border-border bg-background/92 backdrop-blur-sm px-4 py-2 md:px-6">
              <div className="flex flex-wrap items-center gap-3 justify-between">
                <div className="flex items-center gap-3 md:hidden">
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
                <div className="flex min-w-0 flex-1 items-center gap-3 justify-end md:justify-between">
                  <Link
                    href="/"
                    className="hidden md:inline text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground/80"
                  >
                    ホーム
                  </Link>
                  <CockpitStockSearch className="w-full max-w-md md:w-auto md:min-w-[16rem]" compact />
                </div>
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
            <div className="flex flex-wrap gap-2 items-center">
              <div
                className="inline-flex rounded-lg border border-border bg-background/80 p-0.5 shadow-sm"
                role="group"
                aria-label="表示通貨"
              >
                <button
                  type="button"
                  onClick={() => setViewCurrency("JPY")}
                  className={`rounded-md px-2 py-1 text-[10px] font-bold transition-colors ${
                    viewCurrency === "JPY"
                      ? "bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/35"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  ¥
                </button>
                <button
                  type="button"
                  onClick={() => setViewCurrency("USD")}
                  className={`rounded-md px-2 py-1 text-[10px] font-bold transition-colors ${
                    viewCurrency === "USD"
                      ? "bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/35"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  $
                </button>
              </div>

              <button
                type="button"
                onClick={() => setMarketOpen(true)}
                className="w-fit shrink-0 inline-flex items-center gap-1 rounded-md border border-border bg-card/60 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:gap-1.5 md:rounded-lg md:px-3 md:py-2 md:text-[10px]"
                aria-haspopup="dialog"
                aria-expanded={marketOpen}
              >
                <LineChart className="h-3 w-3 shrink-0 text-muted-foreground md:h-3.5 md:w-3.5" aria-hidden />
                Market glance
              </button>

              <button
                type="button"
                onClick={() => setKoyomiOpen(true)}
                className="w-fit shrink-0 inline-flex items-center gap-1 rounded-md border border-border bg-card/60 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:gap-1.5 md:rounded-lg md:px-3 md:py-2 md:text-[10px]"
                aria-haspopup="dialog"
                aria-expanded={koyomiOpen}
              >
                <span aria-hidden>📅</span>
                イベント（暦）
              </button>

              <div className="hidden sm:flex items-center gap-2">
                <ThemeToggle />
              </div>

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
          </div>

          {marketOpen ? (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4" role="presentation">
              <button
                type="button"
                className="absolute inset-0 bg-background/80 backdrop-blur-[2px]"
                aria-label="Close market glance"
                onClick={() => setMarketOpen(false)}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="market-glance-title"
                className="relative z-10 flex max-h-[min(90dvh,56rem)] w-[min(100%,90vw)] max-w-4xl min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-6 sm:py-4">
                  <h2
                    id="market-glance-title"
                    className="text-sm font-bold uppercase tracking-[0.12em] text-muted-foreground sm:text-base"
                  >
                    Market glance
                  </h2>
                  <button
                    type="button"
                    onClick={() => setMarketOpen(false)}
                    className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground touch-manipulation"
                    aria-label="Close"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 text-sm sm:px-6 sm:py-5 sm:text-base [-webkit-overflow-scrolling:touch]">
                  {(summary.marketIndicators ?? []).length === 0 ? (
                    <p className="text-muted-foreground">市場指標を取得できませんでした。</p>
                  ) : (
                    <MarketBar indicators={summary.marketIndicators ?? []} showTitle={false} layout="modal" />
                  )}
                </div>
              </div>
            </div>
          ) : null}

          <EventCalendarModal open={koyomiOpen} onOpenChange={setKoyomiOpen} userId={userId} />

          <div
            className={`${COCKPIT_MAIN_SCROLL_CLASS} cockpit-main-surface`}
            onScroll={(e) => {
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
        {storyOpen != null ? (
          storyOpen.variant === "holding" ? (
            <StorySidePanel
              variant="holding"
              stock={storyOpen.stock}
              userId={userId}
              onClose={closeStory}
              onAfterSave={runAfterSave}
              width={panelWidth}
              onWidthChange={setPanelWidth}
            />
          ) : (
            <StorySidePanel
              variant="themeMember"
              themeId={storyOpen.themeId}
              member={storyOpen.member}
              themeSlugForRevalidate={storyOpen.themeSlugForRevalidate}
              userId={userId}
              onClose={closeStory}
              onAfterSave={runAfterSave}
              width={panelWidth}
              onWidthChange={setPanelWidth}
            />
          )
        ) : null}
      </div>
      </div>

      {/* Mobile: Live Signals strip (desktopではサイドバー下部と同等の情報へアクセス) */}
      {!mobileSidebarOpen ? (
        <div
          className="fixed inset-x-0 bottom-0 z-[85] border-t border-border bg-background/95 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.35)] backdrop-blur-md md:hidden"
          style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom, 0px))" }}
        >
          <div className="max-h-[40vh] overflow-y-auto overscroll-contain px-3 pt-2">
            <LiveSignalsStrip
              signals={signals}
              presentation={isHome ? "prominent" : "compact"}
              userId={userId}
              onSignalResolved={resolveSignalOptimistic}
              onTrade={isHome ? (init) => openTradeForm(init) : undefined}
              sidebarMode={isHome}
            />
          </div>
        </div>
      ) : null}

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
