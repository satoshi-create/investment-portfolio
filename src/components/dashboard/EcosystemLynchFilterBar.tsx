"use client";

import React, { useMemo } from "react";

import { cn } from "@/src/lib/cn";
import {
  aggregateEffectiveLynchCategoryCountsForWatchItems,
} from "@/src/lib/lynch-display";
import {
  LYNCH_RULE_TOOLTIP_ALL_JA,
  LYNCH_RULE_TOOLTIP_BY_CATEGORY_JA,
  LYNCH_RULE_TOOLTIP_UNSET_JA,
  sortLynchToolbarSegments,
} from "@/src/lib/lynch-category-computed";
import type { LynchCategory, ThemeEcosystemWatchItem } from "@/src/types/investment";
import { LYNCH_CATEGORY_LABEL_JA } from "@/src/types/investment";

export type EcosystemLynchFilterValue = "" | "__unset__" | LynchCategory;

export type EcosystemLynchFilterBarProps = {
  /** 件数の母集団: テーマの観測行すべて（検索・リンチ行フィルター等の前） */
  ecosystem: readonly ThemeEcosystemWatchItem[];
  lynchFilter: EcosystemLynchFilterValue;
  onLynchFilterChange: (v: EcosystemLynchFilterValue) => void;
};

export function EcosystemLynchFilterBar({
  ecosystem,
  lynchFilter,
  onLynchFilterChange,
}: EcosystemLynchFilterBarProps) {
  const lynchCountSnapshot = useMemo(
    () => aggregateEffectiveLynchCategoryCountsForWatchItems(ecosystem),
    [ecosystem],
  );
  const lynchToolbarSorted = useMemo(
    () => sortLynchToolbarSegments(lynchCountSnapshot),
    [lynchCountSnapshot],
  );

  return (
    <div
      className="flex min-w-0 max-w-full flex-col gap-1 rounded-lg border border-border bg-muted/40 px-2 py-1.5 sm:flex-row sm:flex-wrap sm:items-center"
      role="group"
      aria-label="リンチの6分類で絞り込み（観測テーブル・レンズ列プリセット）"
    >
      <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground px-1 shrink-0 whitespace-nowrap">
        リンチ
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
      <button
        type="button"
        onClick={() => onLynchFilterChange("")}
        aria-pressed={lynchFilter === ""}
        title={LYNCH_RULE_TOOLTIP_ALL_JA}
        className={cn(
          "text-[9px] font-bold uppercase tracking-wide whitespace-nowrap shrink-0 px-2 py-1 rounded-md border transition-colors",
          lynchFilter === ""
            ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-100"
            : "border-transparent text-muted-foreground hover:bg-muted/60",
        )}
      >
        すべて（{lynchCountSnapshot.total}）
      </button>
      {lynchToolbarSorted.map((seg) => {
        if (seg === "__unset__") {
          const n = lynchCountSnapshot.unset;
          return (
            <button
              key="__unset__"
              type="button"
              onClick={() => onLynchFilterChange("__unset__")}
              aria-pressed={lynchFilter === "__unset__"}
              title={LYNCH_RULE_TOOLTIP_UNSET_JA}
              className={cn(
                "text-[9px] font-bold whitespace-nowrap shrink-0 px-2 py-1 rounded-md border transition-colors max-w-[8rem]",
                lynchFilter === "__unset__"
                  ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-100"
                  : "border-transparent text-muted-foreground hover:bg-muted/60",
              )}
            >
              未分類（{n}）
            </button>
          );
        }
        const k = seg;
        const n = lynchCountSnapshot.byCategory[k];
        return (
          <button
            key={k}
            type="button"
            onClick={() => onLynchFilterChange(k)}
            aria-pressed={lynchFilter === k}
            title={LYNCH_RULE_TOOLTIP_BY_CATEGORY_JA[k]}
            className={cn(
              "text-[9px] font-bold shrink-0 px-2 py-1 rounded-md border transition-colors max-w-[8rem] truncate",
              lynchFilter === k
                ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-100"
                : "border-transparent text-muted-foreground hover:bg-muted/60",
            )}
          >
            {LYNCH_CATEGORY_LABEL_JA[k]}（{n}）
          </button>
        );
      })}
      </div>
    </div>
  );
}
