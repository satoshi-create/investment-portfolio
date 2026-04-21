"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Columns3 } from "lucide-react";

import { cn } from "@/src/lib/cn";
import {
  ECOSYSTEM_WATCHLIST_COLUMN_LABEL_JA,
  ecosystemWatchlistOverviewHiddenPreset,
} from "@/src/lib/ecosystem-watchlist-column-visibility";
import type { EcosystemWatchlistColId } from "@/src/lib/ecosystem-watchlist-column-order";

export type EcosystemWatchlistColumnToolbarProps = {
  /** ページ由来の表示可能列（テーマ／構造・ディフェンシブ等は呼び出し側で既にフィルタ済み） */
  baseVisibleColumnIds: EcosystemWatchlistColId[];
  hiddenColumnIds: EcosystemWatchlistColId[];
  setHiddenColumnIds: (next: EcosystemWatchlistColId[]) => void;
  compactTable: boolean;
  setCompactTable: (v: boolean) => void;
  isDefensiveTheme: boolean;
};

export function EcosystemWatchlistColumnToolbar({
  baseVisibleColumnIds,
  hiddenColumnIds,
  setHiddenColumnIds,
  compactTable,
  setCompactTable,
  isDefensiveTheme,
}: EcosystemWatchlistColumnToolbarProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const togglableIds = useMemo(
    () => baseVisibleColumnIds.filter((id) => id !== "asset"),
    [baseVisibleColumnIds],
  );

  const hiddenSet = useMemo(() => new Set(hiddenColumnIds), [hiddenColumnIds]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (ev: MouseEvent) => {
      const el = wrapRef.current;
      if (!el?.contains(ev.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc, true);
    return () => document.removeEventListener("mousedown", onDoc, true);
  }, [open]);

  function toggleColumn(id: EcosystemWatchlistColId) {
    if (hiddenSet.has(id)) {
      setHiddenColumnIds(hiddenColumnIds.filter((x) => x !== id));
    } else {
      setHiddenColumnIds([...hiddenColumnIds, id]);
    }
  }

  const overviewTargetHidden = useMemo(() => {
    const preset = ecosystemWatchlistOverviewHiddenPreset(isDefensiveTheme);
    return togglableIds.filter((id) => preset.includes(id));
  }, [togglableIds, isDefensiveTheme]);

  function applyPresetOverview() {
    setHiddenColumnIds(overviewTargetHidden);
  }

  function applyPresetFull() {
    setHiddenColumnIds([]);
  }

  const presetActiveFull = hiddenColumnIds.length === 0;
  const presetActiveOverview =
    overviewTargetHidden.length > 0 &&
    hiddenColumnIds.length === overviewTargetHidden.length &&
    overviewTargetHidden.every((id) => hiddenSet.has(id));

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] font-bold uppercase tracking-wide transition-colors",
          open
            ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-200"
            : "border-border text-muted-foreground hover:bg-muted/70",
        )}
        aria-expanded={open}
        aria-controls="eco-column-toolbar-panel"
        title="列の表示・非表示と行の密度"
      >
        <Columns3 className="h-3.5 w-3.5 shrink-0" aria-hidden />
        列・密度
      </button>
      {open ? (
        <div
          id="eco-column-toolbar-panel"
          role="dialog"
          aria-label="Ecosystem 列の表示設定"
          className="absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-border bg-popover/95 p-3 shadow-2xl backdrop-blur-md"
        >
          <div className="flex flex-wrap gap-2 border-b border-border/80 pb-3 mb-3">
            <button
              type="button"
              onClick={() => {
                applyPresetFull();
              }}
              className={cn(
                "rounded-md border px-2.5 py-1.5 text-[10px] font-bold transition-colors",
                presetActiveFull
                  ? "border-emerald-500/45 bg-emerald-500/10 text-emerald-200"
                  : "border-border text-muted-foreground hover:bg-muted/60",
              )}
            >
              フル表示
            </button>
            <button
              type="button"
              onClick={() => {
                applyPresetOverview();
              }}
              className={cn(
                "rounded-md border px-2.5 py-1.5 text-[10px] font-bold transition-colors",
                presetActiveOverview
                  ? "border-cyan-500/45 bg-cyan-500/10 text-cyan-200"
                  : "border-border text-muted-foreground hover:bg-muted/60",
              )}
              title={
                isDefensiveTheme
                  ? "ディフェンシブ役割列を非表示にして横幅を確保"
                  : "Research・江戸的役割を非表示にして横幅を確保"
              }
            >
              一覧（幅を抑える）
            </button>
          </div>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/80 bg-muted/40 px-2.5 py-2 mb-3">
            <input
              type="checkbox"
              checked={compactTable}
              onChange={(ev) => setCompactTable(ev.target.checked)}
              className="accent-cyan-500"
            />
            <span className="text-[11px] font-bold text-foreground">
              コンパクト行（余白・文字を詰める）
            </span>
          </label>
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-2">
            列を表示（Asset は常に表示）
          </p>
          <ul className="max-h-[min(40vh,16rem)] space-y-1 overflow-y-auto pr-1">
            {togglableIds.map((id) => {
              const on = !hiddenSet.has(id);
              const label = ECOSYSTEM_WATCHLIST_COLUMN_LABEL_JA[id] ?? id;
              return (
                <li key={id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggleColumn(id)}
                      className="accent-cyan-500"
                    />
                    <span className="text-[11px] text-foreground">{label}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">{id}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-3 w-full rounded-md border border-border py-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground hover:bg-muted/70"
          >
            閉じる
          </button>
        </div>
      ) : null}
    </div>
  );
}
