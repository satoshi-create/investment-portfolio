"use client";

import type { ThemeEcosystemWatchItem } from "@/src/types/investment";

function fmtPct0(v: number): string {
  if (!Number.isFinite(v)) return "—";
  return `${v.toFixed(1)}%`;
}

export function ecoRuleOf40Tone(v: number): { text: string; cls: string } {
  if (!Number.isFinite(v)) return { text: "—", cls: "text-muted-foreground" };
  if (v >= 40) return { text: fmtPct0(v), cls: "text-green-500 font-bold" };
  if (v >= 0) return { text: fmtPct0(v), cls: "text-foreground/90 font-bold" };
  return { text: fmtPct0(v), cls: "text-rose-300 font-bold" };
}

export function ecoFcfYieldTone(v: number): { text: string; cls: string } {
  if (!Number.isFinite(v)) return { text: "—", cls: "text-muted-foreground" };
  if (v >= 6) return { text: fmtPct0(v), cls: "text-emerald-300 font-bold" };
  if (v >= 0) return { text: fmtPct0(v), cls: "text-foreground/90 font-bold" };
  return { text: fmtPct0(v), cls: "text-rose-300 font-bold" };
}

export function ecoRuleOf40SortValue(e: ThemeEcosystemWatchItem): number | null {
  return Number.isFinite(e.ruleOf40) ? e.ruleOf40 : null;
}

export function ecoFcfYieldSortValue(e: ThemeEcosystemWatchItem): number | null {
  return Number.isFinite(e.fcfYield) ? e.fcfYield : null;
}

export function ecoNetCashSortValue(e: ThemeEcosystemWatchItem): number | null {
  return e.netCash != null && Number.isFinite(e.netCash) ? e.netCash : null;
}

export function ecoNetCashYieldSortValue(e: ThemeEcosystemWatchItem): number | null {
  return e.netCashYieldPercent != null && Number.isFinite(e.netCashYieldPercent) ? e.netCashYieldPercent : null;
}
