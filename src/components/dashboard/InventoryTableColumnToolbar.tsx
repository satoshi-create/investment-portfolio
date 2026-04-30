"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Columns3 } from "lucide-react";

import { cn } from "@/src/lib/cn";
import {
  INVENTORY_COLUMN_LABEL_JA,
  INVENTORY_COLUMN_ALWAYS_VISIBLE,
  inventoryHiddenIdsForDisplayPreset,
  inventoryUserHiddenMatchesPreset,
} from "@/src/lib/inventory-column-visibility";
import type { InventoryColId } from "@/src/lib/inventory-column-order";

export type InventoryTableColumnToolbarProps = {
  baseVisibleColumnIds: InventoryColId[];
  /** 永続化されているユーザー非表示（プリセット判定用） */
  userHiddenColumnIds: InventoryColId[];
  /** 実際の非表示（リンチレンズ等を反映。チェックボックス用） */
  hiddenColumnIds: InventoryColId[];
  setHiddenColumnIds: (next: InventoryColId[]) => void;
  applyDisplayPreset: (preset: "full" | "medium" | "simple") => void;
  markDisplayPresetCustom: () => void;
  compactTable: boolean;
  setCompactTable: (v: boolean) => void;
};

export function InventoryTableColumnToolbar({
  baseVisibleColumnIds,
  userHiddenColumnIds,
  hiddenColumnIds,
  setHiddenColumnIds,
  applyDisplayPreset,
  markDisplayPresetCustom,
  compactTable,
  setCompactTable,
}: InventoryTableColumnToolbarProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const togglableIds = useMemo(
    () =>
      baseVisibleColumnIds.filter((id) => !INVENTORY_COLUMN_ALWAYS_VISIBLE.has(id)),
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

  function toggleColumn(id: InventoryColId) {
    markDisplayPresetCustom();
    if (hiddenSet.has(id)) {
      setHiddenColumnIds(hiddenColumnIds.filter((x) => x !== id));
    } else {
      setHiddenColumnIds([...hiddenColumnIds, id]);
    }
  }

  const presetActiveFull = inventoryUserHiddenMatchesPreset(
    userHiddenColumnIds,
    "full",
    togglableIds,
  );
  const presetActiveMedium = inventoryUserHiddenMatchesPreset(
    userHiddenColumnIds,
    "medium",
    togglableIds,
  );
  const presetActiveSimple = inventoryUserHiddenMatchesPreset(
    userHiddenColumnIds,
    "simple",
    togglableIds,
  );

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] font-bold uppercase tracking-wide transition-colors",
          open
            ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-200"
            : "border-border text-muted-foreground hover:bg-muted/50",
        )}
        aria-expanded={open}
        aria-controls="inventory-column-toolbar-panel"
        title="列の表示プリセット・手動調整と行の密度"
      >
        <Columns3 className="h-3.5 w-3.5 shrink-0" aria-hidden />
        列・密度
      </button>
      {open ? (
        <div
          id="inventory-column-toolbar-panel"
          role="dialog"
          aria-label="Inventory 列の表示設定"
          className="absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-border bg-popover/95 p-3 shadow-2xl backdrop-blur-md"
        >
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-2">
            表示プリセット
          </p>
          <div className="flex flex-wrap gap-2 border-b border-border/80 pb-3 mb-3">
            <button
              type="button"
              onClick={() => applyDisplayPreset("full")}
              className={cn(
                "rounded-md border px-2.5 py-1.5 text-[10px] font-bold transition-colors",
                presetActiveFull
                  ? "border-emerald-500/45 bg-emerald-500/10 text-emerald-200"
                  : "border-border text-muted-foreground hover:bg-muted/60",
              )}
              title="切替可能な列はすべて表示（リンチ列は常に非表示。リンチレンズON時のみ表示）"
            >
              フル
            </button>
            <button
              type="button"
              onClick={() => applyDisplayPreset("medium")}
              className={cn(
                "rounded-md border px-2.5 py-1.5 text-[10px] font-bold transition-colors",
                presetActiveMedium
                  ? "border-cyan-500/45 bg-cyan-500/10 text-cyan-200"
                  : "border-border text-muted-foreground hover:bg-muted/60",
              )}
              title={`Research ほか ${inventoryHiddenIdsForDisplayPreset("medium", togglableIds).length} 列を非表示`}
            >
              ミディアム
            </button>
            <button
              type="button"
              onClick={() => applyDisplayPreset("simple")}
              className={cn(
                "rounded-md border px-2.5 py-1.5 text-[10px] font-bold transition-colors",
                presetActiveSimple
                  ? "border-amber-500/45 bg-amber-500/10 text-amber-100"
                  : "border-border text-muted-foreground hover:bg-muted/60",
              )}
              title="主要指標・判定・Alpha 中心に列を絞る"
            >
              シンプル
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
            列を個別に表示（Asset は常に表示）
          </p>
          <ul className="max-h-[min(40vh,16rem)] space-y-1 overflow-y-auto pr-1">
            {togglableIds.map((id) => {
              const on = !hiddenSet.has(id);
              const label = INVENTORY_COLUMN_LABEL_JA[id] ?? id;
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
