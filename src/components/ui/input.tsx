import * as React from "react";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

/**
 * Shadcn/UI 互換の単一行入力（このリポジトリ用に slate 系トーンでスタイル）。
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className = "", type = "text", ...props }, ref) => (
  <input
    type={type}
    className={`flex h-9 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-1 text-sm text-slate-200 shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/35 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    ref={ref}
    {...props}
  />
));
Input.displayName = "Input";

export { Input };
