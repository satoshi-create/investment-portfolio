"use client";

import { AlertTriangle, ArrowUp, Eye, Star } from "lucide-react";

import type { JudgmentStatus } from "@/src/lib/judgment-logic";

export function JudgmentBadge({ status, reason }: { status: JudgmentStatus; reason: string }) {
  const cfg: Record<
    JudgmentStatus,
    { Icon: typeof Star; label: string; wrap: string; icon: string }
  > = {
    ELITE: {
      Icon: Star,
      label: "ELITE",
      wrap: "border-sky-500/45 bg-sky-500/15 text-sky-100",
      icon: "text-sky-300",
    },
    ACCUMULATE: {
      Icon: ArrowUp,
      label: "ACCUM",
      wrap: "border-emerald-500/45 bg-emerald-500/12 text-emerald-50",
      icon: "text-emerald-300",
    },
    WATCH: {
      Icon: Eye,
      label: "WATCH",
      wrap: "border-border bg-muted/50 text-muted-foreground",
      icon: "text-muted-foreground",
    },
    DANGER: {
      Icon: AlertTriangle,
      label: "RISK",
      wrap: "border-red-500/55 bg-red-950/40 text-red-100",
      icon: "text-red-400",
    },
  };
  const m = cfg[status];
  const Icon = m.Icon;
  return (
    <span
      title={reason}
      className={`inline-flex items-center justify-center gap-1 rounded-md border px-2 py-1 text-[9px] font-bold uppercase tracking-wide ${m.wrap}`}
    >
      <Icon size={12} className={`shrink-0 ${m.icon}`} aria-hidden />
      {m.label}
    </span>
  );
}
