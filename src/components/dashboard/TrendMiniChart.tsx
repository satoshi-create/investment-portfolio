import React from "react";

import type { AlphaHistory } from "@/src/types/investment";

export function TrendMiniChart({ history, maxPoints = 12 }: { history: AlphaHistory; maxPoints?: number }) {
  const pts = Array.isArray(history) ? history.slice(-Math.max(1, Math.floor(maxPoints))) : [];
  return (
    <div className="flex justify-center gap-1 h-6 items-end">
      {pts.map((h, i) => (
        <div
          key={i}
          className={`w-1.5 rounded-full ${h > 0 ? "bg-emerald-500/40" : "bg-rose-500/40"}`}
          style={{ height: `${Math.min(Math.abs(h) * 5 + 2, 24)}px` }}
        />
      ))}
    </div>
  );
}

