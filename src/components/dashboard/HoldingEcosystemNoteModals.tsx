"use client";

import React from "react";
import { X } from "lucide-react";

import { EarningsNoteMarkdownPreview } from "@/src/components/dashboard/EarningsNoteMarkdownPreview";
import {
  EarningsSummaryNoteTextarea,
  HoldingOrEcosystemMemoTextarea,
} from "@/src/components/dashboard/HoldingEcosystemNoteFields";

const shellCls =
  "fixed inset-0 z-[100] flex items-center justify-center p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4";

function Backdrop({ disabled, onClose }: { disabled: boolean; onClose: () => void }) {
  return (
    <button
      type="button"
      className="absolute inset-0 bg-background/80 backdrop-blur-[2px]"
      aria-label="モーダルを閉じる"
      onClick={() => !disabled && onClose()}
    />
  );
}

export type EarningsSummaryNoteEditorModalProps = {
  eyebrow?: string;
  title: string;
  titleId?: string;
  ticker: string;
  companyName: string | null;
  /** ヘッダー直下の追加行（例: 次回決算・Inventory） */
  headerExtra?: React.ReactNode;
  draft: string;
  onDraftChange: (next: string) => void;
  tab: "edit" | "preview";
  onTabChange: (next: "edit" | "preview") => void;
  saving: boolean;
  errorText: string | null;
  onClose: () => void;
  onSave: () => void | Promise<void>;
  textareaId: string;
  /** Inventory 表はやや狭め・エコ系は広め */
  variant?: "inventory" | "ecosystem";
  placeholder?: string;
  /** true のときメイン見出しをティッカーに（エコ表の決算要約モーダルと同じ）。false なら title を見出しにしティッカーは mono 行（Inventory）。 */
  prominentTicker?: boolean;
};

/**
 * 保有の決算要約（holdings.earnings_summary_note）と、テーマメンバーの決算要約（theme_ecosystem_members.earnings_summary_note）で共通のシェル。
 */
export function EarningsSummaryNoteEditorModal({
  eyebrow = "Research",
  title,
  titleId = "earnings-summary-note-modal-title",
  ticker,
  companyName,
  headerExtra,
  prominentTicker = false,
  draft,
  onDraftChange,
  tab,
  onTabChange,
  saving,
  errorText,
  onClose,
  onSave,
  textareaId,
  variant = "inventory",
  placeholder,
}: EarningsSummaryNoteEditorModalProps) {
  const isEco = variant === "ecosystem";
  const dialogCls = isEco
    ? "relative z-10 flex max-h-[min(92dvh,52rem)] w-[min(100%,36rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:max-w-2xl"
    : "relative z-10 flex max-h-[min(90dvh,42rem)] w-[min(100%,26rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl min-h-0 sm:max-w-2xl";
  const taCls = isEco
    ? "min-h-[16rem] flex-1 resize-y border-0 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-inset focus:ring-violet-500/35 disabled:opacity-50 sm:px-5 sm:py-4"
    : "min-h-[12rem] w-full resize-y rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent-cyan/40 disabled:opacity-50";
  const counterCls = isEco
    ? "shrink-0 border-t border-border/60 px-4 py-1.5 text-[10px] text-muted-foreground sm:px-5"
    : "flex items-center justify-between gap-2 text-[10px] text-muted-foreground";
  const saveBtnCls = isEco
    ? "text-[11px] font-bold uppercase tracking-wide text-background bg-violet-600 px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-40"
    : "text-[11px] font-bold uppercase tracking-wide text-background bg-accent-cyan px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-40";

  const defaultPlaceholder = isEco
    ? "Markdown 可。空にして保存でクリア（theme_ecosystem_members.earnings_summary_note）"
    : "Markdown 対応（見出し・リスト・表・コードブロックなど）。空にして保存で削除。";

  return (
    <div className={shellCls} role="presentation">
      <Backdrop disabled={saving} onClose={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className={dialogCls} onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <div className="min-w-0 space-y-1">
            <p
              className={
                prominentTicker
                  ? "text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
                  : "text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground"
              }
            >
              {eyebrow}
            </p>
            {prominentTicker ? (
              <>
                <p id={titleId} className="text-base font-bold text-foreground mt-1 font-mono sm:text-lg">
                  {ticker}
                </p>
                {companyName ? <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1">{companyName}</p> : null}
              </>
            ) : (
              <>
                <h2 id={titleId} className="text-base font-bold tracking-tight text-foreground sm:text-lg">
                  {title}
                </h2>
                <p className="text-[11px] font-mono text-accent-cyan truncate">{ticker}</p>
                {companyName ? <p className="text-[11px] text-muted-foreground line-clamp-2">{companyName}</p> : null}
              </>
            )}
            {headerExtra}
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground touch-manipulation disabled:opacity-40"
            aria-label="閉じる"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex shrink-0 gap-0 border-b border-border px-3 pt-2 sm:px-4" role="tablist" aria-label="決算要約の表示">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "edit"}
            disabled={saving}
            onClick={() => onTabChange("edit")}
            className={`rounded-t-lg px-3 py-2 text-[11px] font-bold uppercase tracking-wide transition-colors disabled:opacity-40 ${
              tab === "edit"
                ? "bg-background text-foreground border border-b-0 border-border -mb-px"
                : "text-muted-foreground hover:text-foreground/90"
            }`}
          >
            編集
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "preview"}
            disabled={saving}
            onClick={() => onTabChange("preview")}
            className={`rounded-t-lg px-3 py-2 text-[11px] font-bold uppercase tracking-wide transition-colors disabled:opacity-40 ${
              tab === "preview"
                ? "bg-background text-foreground border border-b-0 border-border -mb-px"
                : "text-muted-foreground hover:text-foreground/90"
            }`}
          >
            プレビュー
          </button>
        </div>

        <div className="min-h-0 flex-1 flex flex-col gap-3 px-4 py-3 sm:px-5 sm:py-4 bg-background">
          {tab === "edit" ? (
            <>
              <EarningsSummaryNoteTextarea
                id={textareaId}
                value={draft}
                onChange={onDraftChange}
                disabled={saving}
                rows={isEco ? 16 : 10}
                className={taCls}
                placeholder={placeholder ?? defaultPlaceholder}
                counterClassName={counterCls}
                counterTrailing={errorText ? <span className="text-destructive font-bold text-right flex-1">{errorText}</span> : null}
              />
            </>
          ) : (
            <>
              <p className="text-[10px] text-muted-foreground -mt-1 mb-1">
                入力中の内容を Markdown として表示します（未保存の編集も反映）。
              </p>
              <div className="min-h-[12rem] max-h-[min(52vh,24rem)] overflow-y-auto overscroll-contain rounded-xl border border-border bg-card px-3 py-3 sm:px-4">
                <EarningsNoteMarkdownPreview markdown={draft} />
              </div>
              {errorText ? (
                <div className="flex items-center justify-end text-[10px] text-destructive font-bold">{errorText}</div>
              ) : null}
            </>
          )}
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground border border-border px-4 py-2 rounded-lg hover:bg-muted/60 disabled:opacity-40"
            >
              キャンセル
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void onSave()}
              className={saveBtnCls}
            >
              {saving ? "保存中…" : "保存"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export type EcosystemMarkdownMemoModalProps = {
  eyebrow?: string;
  ticker: string;
  companyName: string | null;
  draft: string;
  onDraftChange: (next: string) => void;
  tab: "edit" | "preview";
  onTabChange: (next: "edit" | "preview") => void;
  saving: boolean;
  onClose: () => void;
  onSave: () => void | Promise<void>;
  textareaId: string;
  placeholder: string;
  /** プレビュータブ直上の短い説明 */
  previewLeadText?: string;
};

/** theme_ecosystem_members.memo 等 — 編集 / Markdown プレビューのタブ付き。 */
export function EcosystemMarkdownMemoModal({
  eyebrow = "Ecosystem memo",
  ticker,
  companyName,
  draft,
  onDraftChange,
  tab,
  onTabChange,
  saving,
  onClose,
  onSave,
  textareaId,
  placeholder,
  previewLeadText = "入力中の内容を Markdown として表示します（未保存の編集も反映）。",
}: EcosystemMarkdownMemoModalProps) {
  return (
    <div className={shellCls} role="presentation">
      <Backdrop disabled={saving} onClose={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex max-h-[min(92dvh,52rem)] w-[min(100%,36rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{eyebrow}</p>
            <p className="text-base font-bold text-foreground mt-1 font-mono sm:text-lg">{ticker}</p>
            {companyName ? <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1">{companyName}</p> : null}
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground touch-manipulation disabled:opacity-40"
            aria-label="閉じる"
          >
            <X size={20} />
          </button>
        </div>
        <div className="inline-flex shrink-0 gap-0 border-b border-border px-3 sm:px-4 pt-2" role="tablist" aria-label="メモの表示">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "edit"}
            disabled={saving}
            onClick={() => onTabChange("edit")}
            className={`rounded-t-lg px-3 py-2 text-[11px] font-bold uppercase tracking-wide transition-colors disabled:opacity-40 ${
              tab === "edit"
                ? "bg-background text-foreground border border-b-0 border-border -mb-px"
                : "text-muted-foreground hover:text-foreground/90"
            }`}
          >
            編集
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "preview"}
            disabled={saving}
            onClick={() => onTabChange("preview")}
            className={`rounded-t-lg px-3 py-2 text-[11px] font-bold uppercase tracking-wide transition-colors disabled:opacity-40 ${
              tab === "preview"
                ? "bg-background text-foreground border border-b-0 border-border -mb-px"
                : "text-muted-foreground hover:text-foreground/90"
            }`}
          >
            プレビュー（Markdown）
          </button>
        </div>
        <div className="min-h-0 flex flex-1 flex-col bg-background">
          {tab === "edit" ? (
            <HoldingOrEcosystemMemoTextarea
              id={textareaId}
              value={draft}
              onChange={onDraftChange}
              disabled={saving}
              rows={16}
              className="min-h-[16rem] flex-1 resize-y border-0 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent-cyan/40 disabled:opacity-50 sm:px-5 sm:py-4"
              placeholder={placeholder}
            />
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-2 px-4 py-3 sm:px-5 sm:py-4">
              <p className="shrink-0 text-[10px] text-muted-foreground">{previewLeadText}</p>
              <div className="min-h-[12rem] flex-1 overflow-y-auto overscroll-contain rounded-xl border border-border bg-card px-3 py-3 sm:px-4">
                <EarningsNoteMarkdownPreview markdown={draft} />
              </div>
            </div>
          )}
          <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-border bg-card/80 px-4 py-3 sm:px-5">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground border border-border px-4 py-2 rounded-lg hover:bg-muted/60"
            >
              キャンセル
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void onSave()}
              className="text-[11px] font-bold uppercase tracking-wide text-background bg-accent-cyan px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-40"
            >
              {saving ? "保存中…" : "保存"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export type HoldingMemoPlainModalProps = {
  title: string;
  ticker: string;
  name: string | null;
  draft: string;
  onDraftChange: (next: string) => void;
  saving: boolean;
  errorText: string | null;
  onClose: () => void;
  onSave: () => void | Promise<void>;
  textareaId: string;
  placeholder?: string;
};

/** holdings.memo — プレビュータブなし。 */
export function HoldingMemoPlainModal({
  title,
  ticker,
  name,
  draft,
  onDraftChange,
  saving,
  errorText,
  onClose,
  onSave,
  textareaId,
  placeholder = "holdings.memo（短文・長文可）",
}: HoldingMemoPlainModalProps) {
  return (
    <div className={shellCls} role="presentation">
      <Backdrop disabled={saving} onClose={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex max-h-[min(92dvh,48rem)] w-[min(100%,36rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-foreground sm:text-lg">{title}</h2>
            <p className="text-[11px] font-mono text-accent-cyan mt-0.5">{ticker}</p>
            {name ? <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1">{name}</p> : null}
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground touch-manipulation disabled:opacity-40"
            aria-label="閉じる"
          >
            <X size={20} />
          </button>
        </div>
        {errorText ? <p className="shrink-0 px-4 pt-2 text-[10px] text-destructive font-bold sm:px-5">{errorText}</p> : null}
        <HoldingOrEcosystemMemoTextarea
          id={textareaId}
          value={draft}
          onChange={onDraftChange}
          disabled={saving}
          rows={14}
          className="min-h-[14rem] flex-1 resize-y rounded-none border-0 border-t border-border bg-background px-4 py-3 text-sm sm:px-5 sm:py-4 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent-cyan/40 disabled:opacity-50"
          placeholder={placeholder}
        />
        <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-border bg-card/80 px-4 py-3 sm:px-5">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground border border-border px-4 py-2 rounded-lg hover:bg-muted/60"
          >
            キャンセル
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void onSave()}
            className="text-[11px] font-bold uppercase tracking-wide text-background bg-accent-cyan px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-40"
          >
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
