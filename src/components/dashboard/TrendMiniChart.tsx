import React from "react";

import type { AlphaHistory } from "@/src/types/investment";
import { cn } from "@/src/lib/cn";

/** 5d / 短期トレンド用ミニチャート。色は `app/globals.css` の `--accent-emerald` / `--accent-rose` に準拠 */
export function TrendMiniChart({
  history,
  maxPoints = 12,
  lastBarPulse = false,
}: {
  history: AlphaHistory;
  maxPoints?: number;
  /** 最後の棒が本日の暫定 Alpha（ライブ）のときハイライト */
  lastBarPulse?: boolean;
}) {
  const pts = Array.isArray(history) ? history.slice(-Math.max(1, Math.floor(maxPoints))) : [];
  return (
    <div
      className="mx-auto flex min-w-[4.25rem] shrink-0 justify-center gap-1 h-6 items-end"
      role="img"
      aria-label="短期 Alpha トレンド"
    >
      {pts.map((h, i) => {
        const isLast = i === pts.length - 1;
        return (
          <div
            key={i}
            className={cn(
              "w-1.5 rounded-full",
              h > 0 ? "bg-accent-emerald/50" : "bg-accent-rose/50",
              lastBarPulse && isLast && "ring-1 ring-cyan-400/55",
            )}
            style={{ height: `${Math.min(Math.abs(h) * 5 + 2, 24)}px` }}
          />
        );
      })}
    </div>
  );
}
