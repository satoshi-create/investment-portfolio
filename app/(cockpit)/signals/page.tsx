"use client";

import { SignalsSection } from "@/src/components/dashboard/SignalsSection";
import { useDashboardData } from "@/src/components/dashboard/DashboardDataContext";

export default function CockpitSignalsPage() {
  const { data, userId, resolveSignalOptimistic, openTradeForm } = useDashboardData();
  const signals = data?.signals ?? [];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 lg:max-w-7xl 2xl:max-w-[104rem]">
      <SignalsSection
        signals={signals}
        userId={userId}
        onSignalResolved={resolveSignalOptimistic}
        onTrade={(init) => openTradeForm(init)}
      />
    </div>
  );
}
