"use client";

import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

import type { EcosystemWatchlistColId } from "@/src/lib/ecosystem-watchlist-column-order";
import { MetricHeaderHelp } from "@/src/components/dashboard/MetricHeaderHelp";
import { cn } from "@/src/lib/cn";

export function SortableEcoWatchlistTh({
  id,
  className,
  align = "left",
  title,
  metricHelpText,
  disableColumnReorder = false,
  onRequestHideColumn,
  children,
}: {
  id: EcosystemWatchlistColId;
  className?: string;
  align?: "left" | "right" | "center";
  title?: string;
  /** 指定時は `th` の `title` を付けず Radix ツールチップ（二重表示防止） */
  metricHelpText?: string;
  /** リンチレンズ中でも列 DnD は有効（並べ替えは保存列順に反映） */
  disableColumnReorder?: boolean;
  /** ヘッダ右クリックで列を非表示（Asset 除く） */
  onRequestHideColumn?: (id: EcosystemWatchlistColId) => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: disableColumnReorder,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(isDragging ? { opacity: 0.88, zIndex: 50 } : {}),
  };
  const justify =
    align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start";
  return (
    <th
      ref={setNodeRef}
      style={style}
      className={cn("align-middle", className)}
      title={metricHelpText ? undefined : title}
      scope="col"
      onContextMenu={(e) => {
        if (!onRequestHideColumn) return;
        if (id === "asset") return;
        e.preventDefault();
        onRequestHideColumn(id);
      }}
    >
      <div className={cn("flex w-full min-h-[2.25rem] items-center gap-1", justify)}>
        <button
          type="button"
          className={`touch-none shrink-0 rounded p-0.5 text-muted-foreground ${
            disableColumnReorder
              ? "cursor-not-allowed opacity-40"
              : "cursor-grab hover:bg-muted/60 hover:text-foreground active:cursor-grabbing"
          }`}
          {...attributes}
          {...(disableColumnReorder ? {} : listeners)}
          aria-label={disableColumnReorder ? "列の並べ替え不可" : "列をドラッグして並べ替え"}
          aria-disabled={disableColumnReorder}
          disabled={disableColumnReorder}
          onClick={(ev) => ev.stopPropagation()}
        >
          <GripVertical className="h-3.5 w-3.5" aria-hidden />
        </button>
        <div
          className={cn(
            "min-w-0",
            align === "right" && "text-right",
            align === "center" && "text-center",
            metricHelpText &&
              cn(
                "flex min-w-0 gap-0.5",
                align === "center" ? "items-center justify-center" : "items-start",
                align === "right" && "justify-end",
              ),
          )}
        >
          {metricHelpText ? (
            <>
              <div className="min-w-0 flex-1 text-inherit">{children}</div>
              <MetricHeaderHelp
                text={metricHelpText}
                className={cn("shrink-0", align === "center" ? "mt-0" : "mt-0.5")}
              />
            </>
          ) : (
            children
          )}
        </div>
      </div>
    </th>
  );
}
