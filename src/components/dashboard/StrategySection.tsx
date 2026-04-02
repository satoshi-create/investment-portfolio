import React from "react";
import { FlaskConical, LayoutGrid } from "lucide-react";

import { StatBox } from "@/src/components/dashboard/StatBox";

export function StrategySection() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 mb-4 tracking-widest">
          <LayoutGrid size={14} /> Structural Balance
        </h3>
        <div className="h-5 w-full bg-slate-800 rounded-full overflow-hidden flex border border-slate-700">
          <div className="h-full bg-indigo-500 transition-all" style={{ width: "45%" }} />
          <div className="h-full bg-emerald-500 transition-all" style={{ width: "25%" }} />
          <div className="h-full bg-cyan-500 transition-all" style={{ width: "30%" }} />
        </div>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
          <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-tighter">
            ● FANG+ (45%)
          </span>
          <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-tighter">
            ● AI Infra (25%)
          </span>
          <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-tighter">
            ● Non-Oil (30%)
          </span>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl md:col-span-2 flex items-center justify-between group overflow-hidden">
        <div className="flex gap-12">
          <StatBox label="Alpha Hit Rate" value="68.5%" subLabel="Stable performance" />
          <div className="h-12 w-px bg-slate-800 mt-2" />
          <StatBox
            label="Avoided DD"
            value="18.1%"
            subLabel="Risk management"
            valueColor="text-rose-400"
          />
        </div>
        <button className="text-[10px] font-bold text-blue-400 border border-blue-400/30 px-4 py-2 rounded-lg hover:bg-blue-400/10 transition-all flex items-center gap-2">
          <FlaskConical size={14} /> Tune Logic
        </button>
      </div>
    </div>
  );
}

