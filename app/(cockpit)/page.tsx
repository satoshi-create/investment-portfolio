"use client";

import { InventoryTable } from "@/src/components/dashboard/InventoryTable";
import { HoldingsDetailTable } from "@/src/components/dashboard/HoldingsDetailTable";
import { SignalsSection } from "@/src/components/dashboard/SignalsSection";
import { StrategySection } from "@/src/components/dashboard/StrategySection";
import { EMPTY_SUMMARY, useDashboardData } from "@/src/components/dashboard/DashboardDataContext";

export default function CockpitPortfolioPage() {
  const {
    data,
    satelliteStockCount,
    userId,
    loadDashboard,
    openTradeForm,
    resolveSignalOptimistic,
  } = useDashboardData();
  const summary = data?.summary ?? EMPTY_SUMMARY;
  const structureBySector = data?.structureBySector ?? [];
  const totalMarketValue = data?.totalMarketValue ?? 0;
  const stocks = data?.stocks ?? [];
  const signals = data?.signals ?? [];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 lg:max-w-7xl 2xl:max-w-[90rem]">
      <SignalsSection
        signals={signals}
        userId={userId}
        onSignalResolved={resolveSignalOptimistic}
        onTrade={(init) => openTradeForm(init)}
      />

      <StrategySection
        structureBySector={structureBySector}
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
      />

      <HoldingsDetailTable stocks={stocks} />
    </div>
  );
}
