"use client";

import { InventoryTable } from "@/src/components/dashboard/InventoryTable";
import { HoldingsDetailTable } from "@/src/components/dashboard/HoldingsDetailTable";
import { StrategySection } from "@/src/components/dashboard/StrategySection";
import { EMPTY_SUMMARY, useDashboardData } from "@/src/components/dashboard/DashboardDataContext";

export default function CockpitPortfolioPage() {
  const {
    data,
    satelliteStockCount,
    userId,
    loadDashboard,
    openTradeForm,
  } = useDashboardData();
  const summary = data?.summary ?? EMPTY_SUMMARY;
  const structureBySector = data?.structureBySector ?? [];
  const totalMarketValue = data?.totalMarketValue ?? 0;
  const stocks = data?.stocks ?? [];
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 lg:max-w-[90rem] xl:max-w-[100rem] 2xl:max-w-[120rem]">
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
        averageFxNeutralAlpha={
          summary.portfolioAverageFxNeutralAlpha ?? summary.portfolioAverageAlpha
        }
        userId={userId}
        onEarningsNoteSaved={() => void loadDashboard()}
        onTrade={(init) => openTradeForm(init)}
        onTradeNew={() => openTradeForm(null)}
        livePricePollIntervalMs={45_000}
        onLivePricePoll={() => void loadDashboard()}
      />

      <HoldingsDetailTable stocks={stocks} />
    </div>
  );
}
