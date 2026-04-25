"use client";

import React from "react";

import { cn } from "@/src/lib/cn";
import { EARNINGS_SUMMARY_NOTE_MAX_LEN, HOLDING_MEMO_MAX_LEN } from "@/src/lib/earnings-summary-note-meta";

type TextareaBase = {
  id: string;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  rows?: number;
  className?: string;
  placeholder?: string;
  /** カウンタ行の左に付加（エラー等） */
  counterTrailing?: React.ReactNode;
  counterClassName?: string;
};

/**
 * 決算要約（holdings / theme ecosystem 共通）— 最大長・文字カウンタを揃える。
 */
export function EarningsSummaryNoteTextarea({
  id,
  value,
  onChange,
  disabled,
  rows = 10,
  className,
  placeholder = "Markdown 対応（見出し・リスト・表・コードブロックなど）。空にして保存で削除。",
  counterTrailing,
  counterClassName,
}: TextareaBase) {
  return (
    <>
      <label htmlFor={id} className="sr-only">
        決算要約メモ
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={EARNINGS_SUMMARY_NOTE_MAX_LEN}
        rows={rows}
        disabled={disabled}
        className={className}
        placeholder={placeholder}
      />
      <div
        className={cn("flex items-center justify-between gap-2 text-[10px] text-muted-foreground", counterClassName)}
      >
        <span>
          {value.length} / {EARNINGS_SUMMARY_NOTE_MAX_LEN}
        </span>
        {counterTrailing ? <span className="ml-auto min-w-0 text-right font-bold">{counterTrailing}</span> : null}
      </div>
    </>
  );
}

/**
 * 銘柄メモ（holdings.memo）/ エコシステム観測メモ（Markdown）— 最大長を共有。
 */
export function HoldingOrEcosystemMemoTextarea({
  id,
  value,
  onChange,
  disabled,
  rows = 14,
  className,
  placeholder = "holdings.memo（短文・長文可）",
  showCounter = true,
}: Omit<TextareaBase, "counterTrailing" | "counterClassName"> & { showCounter?: boolean }) {
  return (
    <>
      <label htmlFor={id} className="sr-only">
        メモ
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={HOLDING_MEMO_MAX_LEN}
        rows={rows}
        disabled={disabled}
        className={className}
        placeholder={placeholder}
      />
      {showCounter ? (
        <p className="shrink-0 px-4 pb-1 text-[10px] text-muted-foreground sm:px-5">
          {value.length} / {HOLDING_MEMO_MAX_LEN}
        </p>
      ) : null}
    </>
  );
}
