import React from "react";
import { Target } from "lucide-react";

import { StatBox } from "@/src/components/dashboard/StatBox";

export function DashboardHeader() {
  return (
    <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-800 pb-6">
      <div>
        <div className="flex items-center gap-2 mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
          <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded border border-blue-500/30">
            Alpha Engine v1.2
          </span>
          <span>Satoshi&apos;s Investment OS</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
          <Target className="text-blue-500" size={28} />
          Structural Cockpit
        </h1>
      </div>
      <div className="flex items-center gap-6">
        <StatBox label="Total Alpha" value="+5.28%" valueColor="text-emerald-400" />
        <div className="h-12 w-px bg-slate-800 hidden md:block" />
        <StatBox label="S&P 500 Bench" value="5,254.3" valueColor="text-slate-300" />
      </div>
    </header>
  );
}

