import React from "react";
import { Target } from "lucide-react";

import { StatBox } from "@/src/components/dashboard/StatBox";

type Props = {
  totalAlpha: number;
  benchmarkPrice: number;
};

function formatAlphaPercent(value: number): { text: string; color: string } {
  if (!Number.isFinite(value)) {
    return { text: "—", color: "text-slate-500" };
  }
  const sign = value > 0 ? "+" : "";
  const color = value > 0 ? "text-emerald-400" : value < 0 ? "text-rose-400" : "text-slate-400";
  return { text: `${sign}${value.toFixed(2)}%`, color };
}

export function DashboardHeader({ totalAlpha, benchmarkPrice }: Props) {
  const alphaFmt = formatAlphaPercent(totalAlpha);
  const benchText =
    benchmarkPrice > 0 && Number.isFinite(benchmarkPrice)
      ? benchmarkPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })
      : "—";

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
        <StatBox
          label="Portfolio avg Alpha"
          value={alphaFmt.text}
          valueColor={alphaFmt.color}
          subLabel="Latest daily α vs VOO, equal-weighted"
        />
        <div className="h-12 w-px bg-slate-800 hidden md:block" />
        <StatBox
          label="VOO (S&P 500 ETF)"
          value={benchText}
          valueColor="text-slate-300"
          subLabel="Latest close (USD, Yahoo)"
        />
      </div>
    </header>
  );
}
