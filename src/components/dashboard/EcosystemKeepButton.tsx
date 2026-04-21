"use client";

import React from "react";
import { Star } from "lucide-react";

import { cn } from "@/src/lib/cn";

/** キープ状態は ☆ の充填で表現（短冊型 Bookmark アイコンは不使用）。 */
export function EcosystemKeepButton({
  isKept,
  disabled,
  onClick,
  size = "sm",
  label = "投資候補としてキープ",
}: {
  isKept: boolean;
  disabled?: boolean;
  onClick: () => void | Promise<void>;
  size?: "sm" | "xs";
  /** アクセシビリティ用（キープ時は解除の説明を親で title してもよい） */
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => void onClick()}
      disabled={disabled}
      title={isKept ? `${label}（クリックで解除）` : label}
      aria-label={isKept ? "キープ解除" : label}
      aria-pressed={isKept}
      className={cn(
        "inline-flex items-center justify-center rounded-md border transition-colors shrink-0",
        isKept
          ? "text-amber-300 border-amber-500/50 bg-amber-500/15"
          : "text-slate-500 border-slate-700 hover:text-amber-200/90 hover:border-amber-500/40",
        size === "sm" ? "h-8 w-8" : "h-7 w-7",
        disabled && "opacity-50 pointer-events-none",
      )}
    >
      <Star
        className={size === "sm" ? "h-4 w-4" : "h-3.5 w-3.5"}
        fill={isKept ? "currentColor" : "none"}
        strokeWidth={isKept ? 0 : 2}
      />
    </button>
  );
}
