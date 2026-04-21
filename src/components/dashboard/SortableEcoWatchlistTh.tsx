"use client";

import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

import type { EcosystemWatchlistColId } from "@/src/lib/ecosystem-watchlist-column-order";

export function SortableEcoWatchlistTh({
  id,
  className,
  align = "left",
  title,
  children,
}: {
  id: EcosystemWatchlistColId;
  className?: string;
  align?: "left" | "right" | "center";
  title?: string;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(isDragging ? { opacity: 0.88, zIndex: 50 } : {}),
  };
  const justify =
    align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start";
  return (
    <th ref={setNodeRef} style={style} className={className} title={title} scope="col">
      <div className={`flex w-full items-center gap-1 ${justify}`}>
        <button
          type="button"
          className="cursor-grab touch-none shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground active:cursor-grabbing"
          {...attributes}
          {...listeners}
          aria-label="列をドラッグして並べ替え"
          onClick={(ev) => ev.stopPropagation()}
        >
          <GripVertical className="h-3.5 w-3.5" aria-hidden />
        </button>
        <div
          className={`min-w-0 ${align === "right" ? "text-right" : align === "center" ? "text-center" : ""}`}
        >
          {children}
        </div>
      </div>
    </th>
  );
}
