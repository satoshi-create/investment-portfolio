'use client';

import React, { useState } from "react";

import type { Stock } from "@/src/types/investment";
import { useAlphaSignals } from "@/src/hooks/use-alpha-signals";
import { DashboardHeader } from "@/src/components/dashboard/DashboardHeader";
import { InventoryTable } from "@/src/components/dashboard/InventoryTable";
import { SignalsSection } from "@/src/components/dashboard/SignalsSection";
import { StrategySection } from "@/src/components/dashboard/StrategySection";

export function DashboardPage() {
  const [stocks] = useState<Stock[]>([
    {
      id: 1,
      ticker: "06311181",
      name: "iFreeNEXT FANG+",
      tag: "FANG+ (Core-Sat)",
      alphaHistory: [0.5, 1.2, 0.3, 0.8, 1.1],
      weight: 45,
      quantity: 389,
    },
    {
      id: 2,
      ticker: "NVDA",
      name: "Nvidia",
      tag: "AI Infrastructure",
      alphaHistory: [-1.2, -0.5, -0.2, -0.1, 2.5],
      weight: 15,
      quantity: 1,
    },
    {
      id: 4,
      ticker: "NIO",
      name: "Nio Inc - ADR",
      tag: "Non-Oil (EV)",
      alphaHistory: [-0.5, -1.2, -2.5, -3.1, -2.8],
      weight: 5,
      quantity: 1,
    },
    {
      id: 5,
      ticker: "ENPH",
      name: "Enphase Energy",
      tag: "Non-Oil (Solar)",
      alphaHistory: [1.5, -0.2, -1.8, -2.2, -3.5],
      weight: 5,
      quantity: 1,
    },
    {
      id: 7,
      ticker: "WMT",
      name: "Walmart",
      tag: "Real Economy",
      alphaHistory: [-0.1, 0.2, 0.1, -0.2, 0.3],
      weight: 10,
      quantity: 1,
    },
  ]);

  const signals = useAlphaSignals(stocks);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        <DashboardHeader />
        <StrategySection />
        <SignalsSection signals={signals} />
        <InventoryTable stocks={stocks} />
      </div>
    </div>
  );
}

