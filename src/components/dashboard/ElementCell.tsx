"use client";

import React, { useMemo } from "react";

import { cn } from "@/src/lib/cn";
import type { ElementInfo } from "@/src/types/investment";
import type { PeriodicTableCellData } from "@/src/lib/dashboard-data";

function clamp01(x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return x;
}

function heatBg(changePct: number | null): string {
  if (changePct == null || !Number.isFinite(changePct)) return "bg-slate-950/30";
  const intensity = clamp01(Math.min(Math.abs(changePct) / 6, 1));
  if (changePct > 0) {
    return `bg-emerald-500/${Math.round(10 + intensity * 20)}`;
  }
  if (changePct < 0) {
    return `bg-rose-500/${Math.round(10 + intensity * 20)}`;
  }
  return "bg-slate-900/40";
}

function fmtPct(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

function pctClass(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "text-slate-500";
  if (v > 0) return "text-emerald-300";
  if (v < 0) return "text-rose-300";
  return "text-slate-300";
}

function MiniNenrin({ element, changePct }: { element: ElementInfo; changePct: number | null }) {
  const points = useMemo(() => {
    const base = changePct != null && Number.isFinite(changePct) ? changePct : 0;
    // deterministic "rings" from atomic number: no randomness in render.
    const seed = (element.number % 11) / 11;
    const mags = [0.55, 0.85, 1.05, 0.75, 0.95, 0.65].map((m, i) => {
      const wobble = Math.sin((i + 1) * 2.1 + seed * 9.3) * 0.18;
      return base * (m + wobble);
    });
    return mags;
  }, [changePct, element.number]);

  return (
    <div className="flex justify-center gap-0.5 h-5 items-end" aria-hidden>
      {points.map((h, i) => {
        const up = h >= 0;
        const height = Math.min(Math.abs(h) * 3.2 + 2, 18);
        return (
          <div
            key={i}
            className={cn("w-1 rounded-full", up ? "bg-emerald-400/40" : "bg-rose-400/40")}
            style={{ height: `${height}px` }}
          />
        );
      })}
    </div>
  );
}

export function ElementCell({
  cell,
  selected,
  onSelect,
}: {
  cell: PeriodicTableCellData;
  selected: boolean;
  onSelect: (cell: PeriodicTableCellData) => void;
}) {
  const { element, ticker, price, changePct } = cell;
  const clickable = ticker != null && ticker.trim().length > 0;
  const name = element.nameJa?.trim() ?? "";
  return (
    <button
      type="button"
      onClick={() => onSelect(cell)}
      disabled={!clickable}
      className={cn(
        "group relative w-full h-full min-h-[4.25rem] rounded-xl border border-white/10",
        "bg-slate-950/35 backdrop-blur-[1px] transition-all",
        "hover:border-cyan-400/35 hover:shadow-[0_0_22px_rgba(34,211,238,0.12)]",
        selected ? "ring-1 ring-cyan-400/55 border-cyan-400/40" : "",
        clickable ? "" : "opacity-60 cursor-default",
        heatBg(changePct),
      )}
      title={
        ticker
          ? `${element.symbol} (#${element.number}) — ${ticker}\n${fmtPct(changePct)}`
          : `${element.symbol} (#${element.number})`
      }
    >
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/5 via-transparent to-transparent pointer-events-none" />
      <div className="relative p-2.5 flex flex-col gap-1 h-full">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-mono text-slate-400/90 leading-none">
              {element.number}
            </p>
            <p className="text-lg font-black tracking-tight text-slate-100 leading-none">
              {element.symbol}
            </p>
            {name ? (
              <p className="text-[9px] text-slate-400/90 truncate max-w-[7.5rem]" title={name}>
                {name}
              </p>
            ) : null}
          </div>
          <div className="text-right min-w-0">
            <p className={cn("text-[10px] font-mono font-bold tabular-nums leading-none", pctClass(changePct))}>
              {fmtPct(changePct)}
            </p>
            <p className="text-[9px] font-mono text-slate-500 truncate max-w-[5.5rem]">
              {ticker ?? "—"}
            </p>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <MiniNenrin element={element} changePct={changePct} />
        </div>

        <div className="flex items-end justify-between gap-2">
          <p className="text-[9px] font-mono text-slate-600 truncate">
            {price != null && Number.isFinite(price) && price > 0
              ? price >= 1000
                ? price.toLocaleString(undefined, { maximumFractionDigits: 2 })
                : price.toFixed(2)
              : "—"}
          </p>
          {clickable ? (
            <span className="text-[9px] font-bold uppercase tracking-widest text-cyan-300/70 opacity-0 group-hover:opacity-100 transition-opacity">
              inspect
            </span>
          ) : (
            <span className="text-[9px] font-mono text-slate-700">—</span>
          )}
        </div>
      </div>
    </button>
  );
}

