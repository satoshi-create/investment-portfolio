"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";

import { InventoryTable } from "@/src/components/dashboard/InventoryTable";
import { HoldingsDetailTable } from "@/src/components/dashboard/HoldingsDetailTable";
import { StrategySection } from "@/src/components/dashboard/StrategySection";
import { EMPTY_SUMMARY, useDashboardData } from "@/src/components/dashboard/DashboardDataContext";
import { cn } from "@/src/lib/cn";
import {
  STORY_PANEL_PAGE_PAD_TRANSITION_CLASS,
  STORY_PANEL_PAGE_SHELL_CLASS,
} from "@/src/lib/story-panel-inset";

function CockpitPortfolioContent() {
  const {
    data,
    satelliteStockCount,
    userId,
    loadDashboard,
    openTradeForm,
    focusedTicker,
    setFocusedTicker,
  } = useDashboardData();
  const searchParams = useSearchParams();
  const summary = data?.summary ?? EMPTY_SUMMARY;
  const structureBySector = data?.structureBySector ?? [];
  const totalMarketValue = data?.totalMarketValue ?? 0;
  const stocks = data?.stocks ?? [];

  useEffect(() => {
    const raw = searchParams.get("ticker");
    if (raw != null && raw.trim().length > 0) {
      setFocusedTicker(raw.trim());
    } else {
      setFocusedTicker(null);
    }
  }, [searchParams, setFocusedTicker]);

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-6xl space-y-6 lg:max-w-[90rem] xl:max-w-[100rem] 2xl:max-w-[150rem]",
        STORY_PANEL_PAGE_SHELL_CLASS,
        STORY_PANEL_PAGE_PAD_TRANSITION_CLASS,
      )}
    >
      <StrategySection
        structureBySector={structureBySector}
        stocks={stocks}
        satelliteStockCount={satelliteStockCount}
        totalMarketValue={totalMarketValue}
        totalProfitJpy={summary.totalProfitJpy}
        totalUnrealizedPnlJpy={summary.totalUnrealizedPnlJpy ?? 0}
        totalReturnPct={summary.totalReturnPct}
        totalCostBasisJpy={summary.totalCostBasisJpy}
        fxUsdJpy={summary.fxUsdJpy}
      />

      <InventoryTable
        stocks={stocks}
        totalHoldings={summary.totalHoldings}
        averageAlpha={summary.portfolioAverageAlpha}
        portfolioTotalLiveAlphaPct={summary.portfolioTotalLiveAlphaPct ?? null}
        averageFxNeutralAlpha={
          summary.portfolioAverageFxNeutralAlpha ?? summary.portfolioAverageAlpha
        }
        userId={userId}
        onEarningsNoteSaved={() => loadDashboard()}
        onAfterInstrumentMetaSync={() => void loadDashboard()}
        onTrade={(init) => openTradeForm(init)}
        onTradeNew={() => openTradeForm(null)}
        livePricePollIntervalMs={45_000}
        onLivePricePoll={() => void loadDashboard()}
        highlightTicker={focusedTicker}
      />

      <HoldingsDetailTable stocks={stocks} />
    </div>
  );
}

export default function CockpitPortfolioPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-6xl space-y-6 pb-8" aria-busy="true">
          <div className="h-40 rounded-2xl bg-muted/15 animate-pulse" />
          <div className="h-72 rounded-2xl bg-muted/15 animate-pulse" />
        </div>
      }
    >
      <CockpitPortfolioContent />
    </Suspense>
  );
}
