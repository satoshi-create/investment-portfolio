"use client";

import React, { useMemo, useTransition } from "react";
import Link from "next/link";
import { Zap } from "lucide-react";

import { resolveSignalAction } from "@/app/actions/signals";
import type { TradeEntryInitial } from "@/src/components/dashboard/TradeEntryForm";
import { cn } from "@/src/lib/cn";
import type { LiveSignalType, Signal } from "@/src/types/investment";

function rank(t: LiveSignalType): number {
  switch (t) {
    case "CRITICAL":
      return 0;
    case "BREAK":
      return 1;
    case "WARN":
      return 2;
    case "BUY":
      return 3;
    default:
      return 9;
  }
}

function shortLabel(t: LiveSignalType): string {
  switch (t) {
    case "CRITICAL":
      return "崩壊";
    case "BREAK":
      return "σ歪み";
    case "WARN":
      return "警報";
    case "BUY":
      return "反転";
    default:
      return t;
  }
}

function stripTone(t: LiveSignalType): string {
  switch (t) {
    case "CRITICAL":
      return "border-red-500/45 bg-red-950/35 text-red-100 shadow-[0_0_12px_-4px_rgba(239,68,68,0.45)]";
    case "BREAK":
      return "border-red-500/35 bg-red-950/20 text-red-100/95";
    case "WARN":
      return "border-amber-500/35 bg-amber-950/20 text-amber-100/90";
    case "BUY":
      return "border-emerald-500/35 bg-emerald-950/25 text-emerald-100/90";
    default:
      return "border-border bg-card/60 text-foreground";
  }
}

function rowTone(t: LiveSignalType): string {
  switch (t) {
    case "CRITICAL":
      return "border-red-500/40 bg-red-950/20";
    case "BREAK":
      return "border-red-500/30 bg-red-950/15";
    case "WARN":
      return "border-amber-500/35 bg-amber-950/15";
    case "BUY":
      return "border-emerald-500/35 bg-emerald-950/20";
    default:
      return "border-border bg-card/50";
  }
}

type Props = {
  signals: Signal[];
  /** `prominent`: トップ向け・大きめ・取引＋確認。`compact`: チップ＋確認のみ */
  presentation: "prominent" | "compact";
  userId: string;
  onSignalResolved?: (signalId: string) => void;
  /** 指定時のみ Trade を表示（`presentation === "prominent"` で渡す想定） */
  onTrade?: (initial: TradeEntryInitial) => void;
  /** 旧ヘッダー向け余白（未使用に近いが互換のため残す） */
  headerCompact?: boolean;
  /** サイドバー幅向け：1 列・余白タイト */
  sidebarMode?: boolean;
};

const PROMINENT_MAX = 6;
const COMPACT_MAX_CHIPS = 8;

/** Live structural signals: home = large rows with actions; elsewhere = ticker + confirm only */
export function LiveSignalsStrip({
  signals,
  presentation,
  userId,
  onSignalResolved,
  onTrade,
  headerCompact = false,
  sidebarMode = false,
}: Props) {
  const sorted = useMemo(
    () =>
      [...signals].sort((a, b) => {
        const dr = rank(a.signalType) - rank(b.signalType);
        return dr !== 0 ? dr : a.ticker.localeCompare(b.ticker);
      }),
    [signals],
  );

  const [pending, startTransition] = useTransition();
  const interactive = userId.length > 0;

  function confirm(signal: Signal) {
    if (!interactive) return;
    startTransition(async () => {
      const result = await resolveSignalAction(signal.id, userId);
      if (result.ok) {
        onSignalResolved?.(signal.id);
      }
    });
  }

  if (presentation === "prominent") {
    const visible = sorted.slice(0, PROMINENT_MAX);
    const rest = sorted.length - visible.length;
    const narrow = sidebarMode;

    return (
      <div
        className={cn("space-y-3", headerCompact ? "space-y-2.5" : "", narrow && "space-y-2")}
        aria-label="Live structural signals"
      >
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Zap size={narrow ? 14 : 18} className="shrink-0 text-amber-400" aria-hidden />
            <h2
              className={cn(
                "font-bold uppercase tracking-[0.28em] text-amber-400/95",
                narrow ? "text-[10px]" : "text-xs sm:text-sm",
              )}
            >
              Live Signals
            </h2>
          </div>
          <Link
            href="/signals"
            prefetch
            className={cn(
              "shrink-0 font-semibold text-accent-cyan hover:underline",
              narrow ? "text-[10px]" : "text-[11px] sm:text-xs",
            )}
          >
            一覧で開く
          </Link>
        </div>

        {signals.length === 0 ? (
          <p className={cn("text-muted-foreground", narrow ? "text-xs leading-snug" : "text-sm sm:text-base")}>
            未処理シグナルなし —{" "}
            <span className="font-mono text-muted-foreground/85">Generate signals</span> で再計算
          </p>
        ) : (
          <div className={cn("grid grid-cols-1", narrow ? "gap-2" : "gap-3 lg:grid-cols-2")}>
            {visible.map((s) => (
              <div
                key={s.id}
                className={cn(
                  "flex flex-col rounded-xl border",
                  narrow ? "gap-2 p-2.5" : "gap-3 p-4 sm:flex-row sm:items-stretch sm:justify-between sm:gap-4",
                  rowTone(s.signalType),
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "font-mono font-bold tracking-tight text-foreground",
                        narrow ? "text-sm" : "text-lg",
                      )}
                    >
                      {s.ticker}
                    </span>
                    <span className="rounded border border-border/60 bg-background/40 px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                      {s.tag}
                    </span>
                    <span
                      className={cn(
                        "rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                        stripTone(s.signalType),
                      )}
                    >
                      {shortLabel(s.signalType)}
                    </span>
                  </div>
                  {!narrow ? (
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                      {s.signalType === "BUY"
                        ? "Alpha がプラス転換。モメンタムの反転を検知。"
                        : s.signalType === "WARN"
                          ? "3回連続で Alpha マイナス。構造的停滞の疑い。"
                          : s.signalType === "BREAK" || s.signalType === "CRITICAL"
                            ? "日次 Alpha の統計的アウトライア。構造ストレスの確認が必要。"
                            : ""}
                    </p>
                  ) : (
                    <p className="mt-1 font-mono text-[11px] font-bold tabular-nums text-foreground">
                      α {s.currentAlpha > 0 ? "+" : ""}
                      {s.currentAlpha}%
                    </p>
                  )}
                </div>
                <div
                  className={cn(
                    "flex shrink-0 border-t border-border/50 pt-3",
                    !narrow &&
                      "flex-row items-center justify-between gap-3 sm:w-48 sm:flex-col sm:items-stretch sm:justify-center sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0",
                    narrow && "flex-col gap-2 border-border/40 pt-2",
                  )}
                >
                  {!narrow ? (
                    <p
                      className={cn(
                        "font-mono text-xl font-bold tabular-nums",
                        s.currentAlpha > 0 ? "text-emerald-400" : "text-rose-400",
                      )}
                    >
                      {s.currentAlpha > 0 ? "+" : ""}
                      {s.currentAlpha}%
                    </p>
                  ) : null}
                  <div
                    className={cn(
                      "flex flex-wrap gap-2",
                      !narrow && "justify-end sm:justify-stretch",
                      narrow && "w-full justify-stretch",
                    )}
                  >
                    {onTrade ? (
                      <button
                        type="button"
                        onClick={() =>
                          onTrade({
                            ticker: s.ticker,
                            name: s.name || undefined,
                            theme: s.tag,
                            sector: s.sector ?? s.secondaryTag,
                          })
                        }
                        className={cn(
                          "rounded-lg border border-cyan-500/40 bg-cyan-950/40 font-bold uppercase tracking-wider text-cyan-300 transition-colors hover:bg-cyan-900/50",
                          narrow ? "flex-1 px-2 py-1.5 text-[9px]" : "px-3 py-2 text-[10px]",
                        )}
                      >
                        Trade
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => confirm(s)}
                      disabled={!interactive || pending}
                      className={cn(
                        "rounded-lg border border-slate-600 bg-slate-800/80 font-bold uppercase tracking-wider text-slate-200 transition-colors hover:border-slate-500 hover:bg-slate-700 disabled:pointer-events-none disabled:opacity-50",
                        narrow ? "flex-1 px-2 py-1.5 text-[9px]" : "px-3 py-2 text-[10px]",
                      )}
                    >
                      {pending ? "…" : "確認"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {signals.length > 0 && rest > 0 ? (
          <p className={cn("text-center text-muted-foreground", narrow ? "text-[10px]" : "text-[11px]")}>
            あと <span className="font-mono font-bold text-foreground">{rest}</span> 件は{" "}
            <Link href="/signals" prefetch className="font-semibold text-accent-cyan hover:underline">
              Signals
            </Link>{" "}
            で
          </p>
        ) : null}
      </div>
    );
  }

  /* compact: 小さめチップ + 各銘柄に確認のみ */
  const visible = sorted.slice(0, COMPACT_MAX_CHIPS);
  const rest = sorted.length - visible.length;

  return (
    <div
      className={cn("flex min-w-0 items-start gap-2 sm:gap-3", headerCompact ? "py-0.5" : "py-1")}
      aria-label="Live structural signals"
    >
      <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
        <Zap size={12} className="shrink-0 text-amber-400" aria-hidden />
        <span className="text-[9px] font-bold uppercase tracking-[0.22em] text-amber-400/95">地脈</span>
      </div>

      {signals.length === 0 ? (
        <p className="truncate text-[10px] font-medium text-muted-foreground sm:text-[11px]">
          未処理シグナルなし — <span className="font-mono text-muted-foreground/80">Generate signals</span>
        </p>
      ) : (
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-2 overflow-x-auto overscroll-x-contain pb-0.5 [scrollbar-width:thin]">
            {visible.map((s) => (
              <div
                key={s.id}
                className={cn(
                  "inline-flex max-w-[min(100%,18rem)] shrink-0 items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] tabular-nums",
                  stripTone(s.signalType),
                )}
              >
                <span className="font-mono font-bold tracking-tight">{s.ticker}</span>
                <span className="text-[9px] text-muted-foreground/90">·</span>
                <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide">
                  {shortLabel(s.signalType)}
                </span>
                <button
                  type="button"
                  onClick={() => confirm(s)}
                  disabled={!interactive || pending}
                  className="ml-0.5 shrink-0 rounded border border-slate-600/80 bg-slate-900/80 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-slate-100 hover:bg-slate-700 disabled:opacity-40"
                >
                  {pending ? "…" : "確認"}
                </button>
              </div>
            ))}
            {rest > 0 ? (
              <Link
                href="/signals"
                prefetch
                className="shrink-0 whitespace-nowrap text-[10px] font-bold text-accent-cyan hover:underline"
              >
                +{rest} 件
              </Link>
            ) : (
              <Link
                href="/signals"
                prefetch
                className="shrink-0 whitespace-nowrap text-[10px] font-semibold text-muted-foreground hover:text-foreground"
              >
                詳細
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
