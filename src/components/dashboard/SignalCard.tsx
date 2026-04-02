import React from "react";
import { AlertTriangle, Zap } from "lucide-react";

import type { Signal } from "@/src/types/investment";

export function SignalCard({ signal }: { signal: Signal }) {
  return (
    <div
      className={`group flex items-center gap-4 p-5 rounded-2xl border transition-all cursor-pointer ${
        signal.isWarning
          ? "bg-rose-500/5 border-rose-500/20 hover:border-rose-500/40"
          : "bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40"
      }`}
    >
      <div
        className={`p-4 rounded-full ${
          signal.isWarning
            ? "bg-rose-500/10 text-rose-500"
            : "bg-emerald-500/10 text-emerald-500"
        }`}
      >
        {signal.isWarning ? <AlertTriangle size={28} /> : <Zap size={28} />}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-bold text-xl text-white">{signal.ticker}</h3>
          <span className="text-[10px] px-2 py-0.5 bg-slate-800 text-slate-400 rounded font-bold uppercase">
            {signal.tag}
          </span>
        </div>
        <p className="text-sm text-slate-400 leading-relaxed">
          {signal.isWarning
            ? "3回連続でAlphaマイナス。構造的停滞の疑い。"
            : "Alphaがプラス転換。モメンタムの反転を検知。"}
        </p>
      </div>
      <div className="text-right">
        <p
          className={`text-xl font-mono font-bold ${
            signal.currentAlpha > 0 ? "text-emerald-400" : "text-rose-400"
          }`}
        >
          {signal.currentAlpha > 0 ? "+" : ""}
          {signal.currentAlpha}%
        </p>
      </div>
    </div>
  );
}

