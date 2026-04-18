"use client";

import React, { useTransition } from "react";
import { AlertTriangle, Flame, Zap } from "lucide-react";

import { resolveSignalAction } from "@/app/actions/signals";
import type { TradeEntryInitial } from "@/src/components/dashboard/TradeEntryForm";
import type { Signal } from "@/src/types/investment";

function formatDetectedAt(iso: string): string {
  if (!iso || iso.trim().length === 0) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:${min}`;
}

function signalChannelBadge(signal: Signal): { label: string; className: string } | null {
  switch (signal.signalType) {
    case "WARN":
      return { label: "Trend", className: "bg-slate-800 text-slate-400" };
    case "BREAK":
      return { label: "Structural σ", className: "bg-red-950/80 text-red-300 ring-1 ring-red-500/35" };
    case "CRITICAL":
      return {
        label: "Phase collapse",
        className: "bg-red-950 text-red-200 ring-1 ring-red-600/70 font-extrabold",
      };
    default:
      return null;
  }
}

function warningBodyCopy(signal: Signal): string {
  switch (signal.signalType) {
    case "WARN":
      return "3回連続で Alpha マイナス（緩やかなトレンド悪化）。構造的停滞の疑い。";
    case "BREAK":
      return "日次 Alpha の Z が統計的に Deep Outlier（Structural Strain）。構造崩壊の萌芽として即確認。";
    case "CRITICAL":
      return "日次 Alpha の Z が極端に低下（Phase Transition）。急激な構造崩壊への移行リスクとして最優先で確認。";
    default:
      return "";
  }
}

type Props = {
  signal: Signal;
  userId: string;
  onResolved?: (signalId: string) => void;
  onTrade?: (initial: TradeEntryInitial) => void;
};

export function SignalCard({ signal, userId, onResolved, onTrade }: Props) {
  const [pending, startTransition] = useTransition();

  const onCheck = () => {
    startTransition(async () => {
      const result = await resolveSignalAction(signal.id, userId);
      if (result.ok) {
        onResolved?.(signal.id);
      }
    });
  };

  const channel = signalChannelBadge(signal);
  const isStructuralPulse = signal.signalType === "BREAK";
  const isCriticalPulse = signal.signalType === "CRITICAL";

  return (
    <div
      className={`group flex flex-col gap-3 sm:flex-row sm:items-stretch p-5 rounded-2xl border transition-all relative overflow-hidden ${
        signal.signalType === "BUY"
          ? "bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40"
          : isCriticalPulse
            ? "bg-red-950/25 border-red-600/45 hover:border-red-500/70 animate-structural-critical-pulse"
            : isStructuralPulse
              ? "bg-red-950/15 border-red-500/35 hover:border-red-500/55 animate-structural-break-pulse"
              : "bg-rose-500/5 border-rose-500/20 hover:border-rose-500/40"
      }`}
    >
      <div className="flex items-start gap-4 flex-1 min-w-0">
        <div
          className={`shrink-0 p-4 rounded-full ${
            signal.signalType === "BUY"
              ? "bg-emerald-500/10 text-emerald-500"
              : isCriticalPulse
                ? "bg-red-600/20 text-red-400"
                : isStructuralPulse
                  ? "bg-red-500/15 text-red-400"
                  : "bg-rose-500/10 text-rose-500"
          }`}
        >
          {signal.signalType === "BUY" ? (
            <Zap size={28} />
          ) : isCriticalPulse ? (
            <Flame size={28} />
          ) : (
            <AlertTriangle size={28} className={isStructuralPulse ? "animate-pulse" : undefined} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="font-bold text-xl text-white">{signal.ticker}</h3>
            {channel ? (
              <span
                className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wide ${channel.className}`}
              >
                {channel.label}
              </span>
            ) : null}
            <span className="text-[10px] px-2 py-0.5 bg-slate-800 text-slate-400 rounded font-bold uppercase">
              {signal.tag}
            </span>
          </div>
          <p className="text-[10px] font-mono text-slate-500 mb-2">
            {formatDetectedAt(signal.detectedAt)}
          </p>
          <p className="text-sm text-slate-400 leading-relaxed">
            {signal.signalType === "BUY"
              ? "Alpha がプラス転換。モメンタムの反転を検知。"
              : warningBodyCopy(signal)}
          </p>
        </div>
      </div>

      <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-between gap-3 shrink-0 border-t border-slate-800/60 sm:border-t-0 sm:border-l sm:border-slate-800/60 sm:pl-4 pt-3 sm:pt-0">
        <p
          className={`text-xl font-mono font-bold ${
            signal.currentAlpha > 0 ? "text-emerald-400" : "text-rose-400"
          }`}
        >
          {signal.currentAlpha > 0 ? "+" : ""}
          {signal.currentAlpha}%
        </p>
        <div className="flex flex-wrap gap-2 justify-end">
          {onTrade ? (
            <button
              type="button"
              onClick={() =>
                onTrade({
                  ticker: signal.ticker,
                  name: signal.name || undefined,
                  theme: signal.tag,
                  sector: signal.sector ?? signal.secondaryTag,
                })
              }
              className="text-[10px] font-bold uppercase tracking-wider px-4 py-2 rounded-lg border border-cyan-500/40 text-cyan-300 bg-cyan-950/40 hover:bg-cyan-900/50 transition-colors"
            >
              Trade
            </button>
          ) : null}
          <button
            type="button"
            onClick={onCheck}
            disabled={pending}
            className="text-[10px] font-bold uppercase tracking-wider px-4 py-2 rounded-lg border border-slate-600 text-slate-200 bg-slate-800/80 hover:bg-slate-700 hover:border-slate-500 transition-colors disabled:opacity-50 disabled:pointer-events-none"
          >
            {pending ? "…" : "確認"}
          </button>
        </div>
      </div>
    </div>
  );
}
