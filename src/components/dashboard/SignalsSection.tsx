import React from "react";
import { Zap } from "lucide-react";

import type { Signal } from "@/src/types/investment";
import { SignalCard } from "@/src/components/dashboard/SignalCard";
import type { TradeEntryInitial } from "@/src/components/dashboard/TradeEntryForm";

type Props = {
  signals: Signal[];
  userId: string;
  onSignalResolved?: (signalId: string) => void;
  onTrade?: (initial: TradeEntryInitial) => void;
};

export function SignalsSection({ signals, userId, onSignalResolved, onTrade }: Props) {
  return (
    <div className="space-y-4">
      <h2 className="text-xs font-bold text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2">
        <Zap size={14} className="text-amber-400 fill-amber-400" />
        Live Signals
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {signals.length === 0 ? (
          <p className="text-sm text-slate-500 col-span-full">
            No unresolved signals. Run <span className="font-mono text-slate-400">Generate signals</span> after
            loading alpha history.
          </p>
        ) : (
          signals.map((signal) => (
            <SignalCard
              key={signal.id}
              signal={signal}
              userId={userId}
              onResolved={onSignalResolved}
              onTrade={onTrade}
            />
          ))
        )}
      </div>
    </div>
  );
}

