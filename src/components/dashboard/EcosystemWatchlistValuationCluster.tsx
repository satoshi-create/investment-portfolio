"use client";

import React from "react";

import { cn } from "@/src/lib/cn";

/**
 * 乖離・落率 / 黒字のみ / 割安パトロール + 分析ソートを 1 か所にまとめ、ツールバー横方向の占有を抑える。
 */
export type EcosystemWatchlistValuationClusterProps = {
  ecoShowValueCols: boolean;
  onToggleValueCols: () => void;
  ecoEpsPositiveOnly: boolean;
  onToggleEpsPositive: () => void;
  patrolOn: boolean;
  onTogglePatrol: () => void;
  /** 分析モードのドロップダウン（親が state を保持） */
  analysisSlot: React.ReactNode;
};

export function EcosystemWatchlistValuationCluster({
  ecoShowValueCols,
  onToggleValueCols,
  ecoEpsPositiveOnly,
  onToggleEpsPositive,
  patrolOn,
  onTogglePatrol,
  analysisSlot,
}: EcosystemWatchlistValuationClusterProps) {
  return (
    <div
      className="flex min-w-0 max-w-full flex-col gap-1.5 rounded-lg border border-border bg-muted/40 px-2 py-1.5 sm:flex-row sm:flex-wrap sm:items-center"
      role="group"
      aria-label="株価指標・割安・分析ソート"
    >
      <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap shrink-0 px-0.5">
        値・割安
      </span>
      <div className="flex min-w-0 flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={onToggleValueCols}
          className={cn(
            "text-[10px] font-bold uppercase tracking-wide whitespace-nowrap shrink-0 rounded-md border px-2 py-1.5 transition-colors",
            ecoShowValueCols
              ? "text-amber-400 border-amber-500/50 bg-amber-500/10"
              : "text-muted-foreground border-border hover:bg-muted/70",
          )}
          title="日次 Alpha 乖離（σ）と 90 日高値比"
        >
          乖離・落率
        </button>
        <button
          type="button"
          onClick={onToggleEpsPositive}
          className={cn(
            "text-[10px] font-bold uppercase tracking-wide whitespace-nowrap shrink-0 rounded-md border px-2 py-1.5 transition-colors",
            ecoEpsPositiveOnly
              ? "text-rose-200 border-rose-500/45 bg-rose-500/10"
              : "text-muted-foreground border-border hover:bg-muted/70",
          )}
          title="EPS > 0（黒字）の銘柄のみ"
        >
          黒字のみ
        </button>
        <button
          type="button"
          onClick={onTogglePatrol}
          className={cn(
            "text-[10px] font-bold uppercase tracking-wide whitespace-nowrap shrink-0 rounded-md border px-2 py-1.5 transition-colors",
            patrolOn
              ? "text-cyan-400 border-cyan-500/50 bg-cyan-500/10"
              : "text-muted-foreground border-border hover:bg-muted/70",
          )}
          title="Alpha 乖離が大きい負け、または高値からの下落が大きい銘柄のみ"
        >
          割安パトロール
        </button>
      </div>
      <div className="hidden h-5 w-px shrink-0 bg-border/70 sm:block" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 sm:pl-0">{analysisSlot}</div>
    </div>
  );
}
