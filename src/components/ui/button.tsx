"use client";

import * as React from "react";

import { cn } from "@/src/lib/cn";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost";
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
        "disabled:pointer-events-none disabled:opacity-50",
        variant === "default" &&
          "bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/25",
        variant === "outline" &&
          "border border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800/60",
        variant === "ghost" && "text-slate-300 hover:bg-slate-800/60",
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
