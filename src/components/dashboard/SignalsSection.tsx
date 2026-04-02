import React from "react";
import { Zap } from "lucide-react";

import type { Signal } from "@/src/types/investment";
import { SignalCard } from "@/src/components/dashboard/SignalCard";

export function SignalsSection({ signals }: { signals: Signal[] }) {
  return (
    <div className="space-y-4">
      <h2 className="text-xs font-bold text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2">
        <Zap size={14} className="text-amber-400 fill-amber-400" />
        Live Signals
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {signals.map((signal) => (
          <SignalCard key={signal.id} signal={signal} />
        ))}
      </div>
    </div>
  );
}

