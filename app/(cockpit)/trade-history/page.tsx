"use client";

import { HoldingsDetailTable } from "@/src/components/dashboard/HoldingsDetailTable";
import { InventoryTable } from "@/src/components/dashboard/InventoryTable";
import { EMPTY_SUMMARY, useDashboardData } from "@/src/components/dashboard/DashboardDataContext";

export default function CockpitTradeHistoryPage() {
  const { data, userId, loadDashboard, openTradeForm } = useDashboardData();
  const stocks = data?.stocks ?? [];
  const summary = data?.summary ?? EMPTY_SUMMARY;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 lg:max-w-7xl 2xl:max-w-[90rem]">
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
