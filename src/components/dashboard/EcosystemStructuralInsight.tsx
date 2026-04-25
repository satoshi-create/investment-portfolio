"use client";

import React, { useState } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/src/components/ui/tooltip";
import { cn } from "@/src/lib/cn";
import type { ThemeEcosystemWatchItem } from "@/src/types/investment";

export function ecosystemMemberHasStructuralInsight(e: ThemeEcosystemWatchItem): boolean {
  const ch = e.chasm != null && e.chasm.trim().length > 0;
  const mo = e.moat != null && e.moat.trim().length > 0;
  const vi = e.viScore != null && Number.isFinite(e.viScore);
  return ch || mo || vi;
}

export function EcosystemViScoreBar({
  viScore,
  className,
}: {
  viScore: number | null;
  className?: string;
}) {
  if (viScore == null || !Number.isFinite(viScore)) {
    return <span className={cn("text-[10px] text-muted-foreground", className)}>VI: —</span>;
  }
  const pct = Math.min(100, Math.max(0, viScore));
  return (
    <div className={cn("flex flex-col gap-0.5 min-w-[4.5rem]", className)}>
      <div className="flex items-center justify-between gap-1">
        <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">VI</span>
        <span className="text-[10px] font-mono font-bold tabular-nums">{pct}</span>
      </div>
      <div className="h-1.5 w-full max-w-[6rem] rounded-full bg-muted overflow-hidden" title={`垂直統合スコア: ${pct}/100`}>
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-600/90 to-emerald-500/90"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function StructuralInsightTooltipBody({ e }: { e: ThemeEcosystemWatchItem }) {
  return (
    <div className="space-y-1.5 text-left">
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">構造的インサイト</p>
      {e.chasm != null && e.chasm.trim().length > 0 ? (
        <p className="text-[11px] leading-relaxed">
          <span className="font-semibold text-amber-200/95">Chasm（深淵）: </span>
          {e.chasm.trim()}
        </p>
      ) : null}
      {e.moat != null && e.moat.trim().length > 0 ? (
        <p className="text-[11px] leading-relaxed">
          <span className="font-semibold text-emerald-200/95">Moat（堀）: </span>
          {e.moat.trim()}
        </p>
      ) : null}
      {e.viScore != null && Number.isFinite(e.viScore) ? (
        <p className="text-[10px] text-muted-foreground">VI Score: {e.viScore}</p>
      ) : null}
    </div>
  );
}

/** ティッカー・社名ホバーで Chasm/Moat を表示（データがあるときのみ Tooltip を付与） */
export function EcosystemStructuralInsightHoverWrap({
  e,
  className,
  children,
}: {
  e: ThemeEcosystemWatchItem;
  className?: string;
  children: React.ReactNode;
}) {
  if (!ecosystemMemberHasStructuralInsight(e)) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("min-w-0 cursor-help", className)}>{children}</span>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="start" className="max-w-sm">
        <StructuralInsightTooltipBody e={e} />
      </TooltipContent>
    </Tooltip>
  );
}

export function EcosystemStructuralInsightExpandable({ e }: { e: ThemeEcosystemWatchItem }) {
  const [open, setOpen] = useState(false);
  if (!ecosystemMemberHasStructuralInsight(e)) return null;
  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-[9px] font-bold uppercase tracking-wide text-sky-400/90 border border-sky-500/35 px-1.5 py-0.5 rounded hover:bg-sky-500/10"
        aria-expanded={open}
      >
        {open ? "構造的インサイト ▲" : "構造的インサイト ▼"}
      </button>
      {open ? (
        <div className="mt-1.5 rounded-md border border-border/60 bg-muted/30 p-2 space-y-2 text-[10px] leading-snug">
          {e.chasm != null && e.chasm.trim().length > 0 ? (
            <div>
              <span className="font-bold text-amber-300/95">Chasm（深淵） </span>
              <span className="text-muted-foreground">{e.chasm.trim()}</span>
            </div>
          ) : null}
          {e.moat != null && e.moat.trim().length > 0 ? (
            <div>
              <span className="font-bold text-emerald-300/95">Moat（堀） </span>
              <span className="text-muted-foreground">{e.moat.trim()}</span>
            </div>
          ) : null}
          <EcosystemViScoreBar viScore={e.viScore ?? null} />
        </div>
      ) : null}
    </div>
  );
}
