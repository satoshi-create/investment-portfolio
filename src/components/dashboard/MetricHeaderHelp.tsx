"use client";

import { Info } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/src/components/ui/tooltip";
import { cn } from "@/src/lib/cn";

/** 列ヘッダー用: ソート用ボタンと並べ、説明はホバー（タッチは長押し相当で Radix が出す） */
export function MetricHeaderHelp({ text, className }: { text: string; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex shrink-0 rounded p-0.5 text-muted-foreground opacity-60 transition-opacity hover:opacity-100 focus:outline-none focus:ring-1 focus:ring-ring/60",
            className,
          )}
          aria-label="この指標の説明"
          onClick={(e) => e.stopPropagation()}
        >
          <Info className="h-3 w-3" strokeWidth={2.25} aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-left font-normal normal-case tracking-normal">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
