"use client";

import React from "react";
import { CalendarClock, FileText, MessageSquare, Star } from "lucide-react";

import { JudgmentBadge } from "@/src/components/dashboard/JudgmentBadge";
import { EcosystemCumulativeSparkline } from "@/src/components/dashboard/EcosystemCumulativeSparkline";
import { EcosystemKeepButton } from "@/src/components/dashboard/EcosystemKeepButton";
import { TrendMiniChart } from "@/src/components/dashboard/TrendMiniChart";
import { ecoFcfYieldTone, ecoRuleOf40Tone } from "@/src/components/dashboard/eco-efficiency-display";
import { stickyTdFirst } from "@/src/components/dashboard/table-sticky";
import { fiveDayPulseForEcosystem } from "@/src/lib/eco-trend-daily";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { cn } from "@/src/lib/cn";
import {
  dividendPayoutCellClassName,
  ecosystemDividendPayoutPercent,
  formatDividendPayoutPercent,
} from "@/src/lib/eco-dividend-payout";
import { ECOSYSTEM_MEMBER_FIELD_MAX_LEN } from "@/src/lib/ecosystem-field-meta";
import { EARNINGS_SUMMARY_NOTE_MAX_LEN } from "@/src/lib/earnings-summary-note-meta";
import { fmtExpectedGrowthPercent, fmtPegRatio, pegRatioTextClass } from "@/src/lib/peg-display";
import type { EcosystemWatchlistColId } from "@/src/lib/ecosystem-watchlist-column-order";
import type { InvestmentThemeRecord, ThemeEcosystemWatchItem } from "@/src/types/investment";
import { INVESTMENT_METRIC_TONE_TEXT_CLASS, investmentMetricToneForSignedPercent } from "@/src/types/investment";
import type { TradeEntryInitial } from "@/src/components/dashboard/TradeEntryForm";

function fmtVolumeRatioCell(r: number | null): string {
  if (r == null || !Number.isFinite(r)) return "—";
  return `${r.toFixed(2)}×`;
}

function volumeRatioToneClass(r: number | null): string {
  if (r == null || !Number.isFinite(r)) return "text-muted-foreground";
  if (r >= 2) return "text-amber-400 font-bold";
  if (r >= 1.2) return "text-cyan-300/90";
  if (r >= 0.8) return "text-foreground/90";
  return "text-slate-500";
}

function fmtDdCol(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function fmtZsigma(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(2)}σ`;
}

function pctClass(v: number): string {
  if (!Number.isFinite(v)) return "text-muted-foreground";
  if (v > 0) return "text-emerald-400";
  if (v < 0) return "text-rose-400";
  return "text-muted-foreground";
}

function countdownJa(days: number | null, label: string): string | null {
  if (days == null || !Number.isFinite(days)) return null;
  if (days < 0) return null;
  if (days === 0) return `今日が${label}`;
  if (days === 1) return `あと1日で${label}`;
  return `あと${days}日で${label}`;
}

/** Div%・配当落ち/権利確定・カウントダウン・近接警告（ディフェンシブの「配当カレンダー」列と Research 列で共有） */
function EcosystemDividendTradingStrip({ e }: { e: ThemeEcosystemWatchItem }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-row flex-wrap items-center gap-2">
        {e.dividendYieldPercent != null ? (
          <span
            className="rounded-md border border-border bg-card/60 px-2 py-0.5 text-[10px] font-bold text-foreground"
            title={e.annualDividendRate != null ? `年間配当: ${e.annualDividendRate}` : "年間配当: —"}
          >
            Div:{e.dividendYieldPercent.toFixed(2)}%
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground">Div:—</span>
        )}
        {(() => {
          const d = e.daysToExDividend;
          const soon = d != null && Number.isFinite(d) && d >= 0 && d <= 7;
          if (!soon) return null;
          return (
            <span
              className="inline-flex items-center gap-1 rounded-md border border-cyan-400/40 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold text-cyan-200 motion-safe:animate-pulse"
              title="配当落ち日が近い（7日以内）"
            >
              <CalendarClock className="h-3.5 w-3.5 shrink-0 text-cyan-200" aria-hidden />
              X近
            </span>
          );
        })()}
      </div>
      <div className="flex flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-mono text-muted-foreground">
          <span title="配当落ち日（ex-dividend date）">
            X:{e.exDividendDate ?? "—"}
            {e.daysToExDividend != null && e.daysToExDividend >= 0 ? ` (D-${e.daysToExDividend})` : ""}
          </span>
          <span title="権利確定日（record date）">
            R:{e.recordDate ?? "—"}
            {e.daysToRecordDate != null && e.daysToRecordDate >= 0 ? ` (D-${e.daysToRecordDate})` : ""}
          </span>
        </div>
        {(() => {
          const r = countdownJa(e.daysToRecordDate, "権利確定");
          const x = countdownJa(e.daysToExDividend, "配当落ち");
          const text = r ?? x;
          if (!text) return null;
          return <span className="text-[10px] text-muted-foreground">{text}</span>;
        })()}
      </div>
    </div>
  );
}

function ecoPeOf(e: ThemeEcosystemWatchItem): number | null {
  const v = e.trailingPe ?? e.forwardPe ?? null;
  return v != null && Number.isFinite(v) && v > 0 ? v : null;
}

function ecoEpsOf(e: ThemeEcosystemWatchItem): number | null {
  const v = e.trailingEps ?? e.forwardEps ?? null;
  return v != null && Number.isFinite(v) ? v : null;
}

function fmtPe(v: number | null): string {
  if (v == null || !Number.isFinite(v) || v <= 0) return "—";
  return v >= 100 ? v.toFixed(0) : v.toFixed(1);
}

function fmtEps(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  if (abs >= 100) return v.toFixed(0);
  if (abs >= 10) return v.toFixed(2);
  return v.toFixed(3);
}

function ecoListingYmdKey(e: ThemeEcosystemWatchItem): string | null {
  const d = e.listingDate;
  if (d == null || String(d).trim().length < 10) return null;
  const ymd = String(d).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null;
}

function ecoListingYearLabel(e: ThemeEcosystemWatchItem): string {
  const fk = ecoListingYmdKey(e);
  if (fk == null) return "—";
  return fk.slice(0, 4);
}

function ecoFmtMarketCapShort(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const v = Math.abs(n);
  if (v >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n));
}

function extractGeopoliticalPotential(observationNotes: string | null | undefined): string | null {
  if (observationNotes == null) return null;
  const s = observationNotes.trim();
  if (s.length === 0) return null;
  const m = s.match(/地政学(?:ポテンシャル|リスク|要因)[:：]\s*([^\n]+)\s*$/);
  if (m?.[1]) return m[1].trim();
  return null;
}

export type EcosystemThemeTableMappedRowProps = {
  visibleColumnIds: EcosystemWatchlistColId[];
  e: ThemeEcosystemWatchItem;
  ecoOpp: boolean;
  zEco: number | null;
  ddEco: number | null;
  isDefensiveTheme: boolean;
  themeLabel: string;
  theme: InvestmentThemeRecord | null;
  ecoEditingId: string | null;
  ecoEditCompanyName: string;
  setEcoEditCompanyName: (v: string) => void;
  ecoEditRole: string;
  setEcoEditRole: (v: string) => void;
  ecoEditMajor: boolean;
  setEcoEditMajor: (v: boolean) => void;
  ecoEditListingDate: string;
  setEcoEditListingDate: (v: string) => void;
  ecoEditMarketCap: string;
  setEcoEditMarketCap: (v: string) => void;
  ecoEditListingPrice: string;
  setEcoEditListingPrice: (v: string) => void;
  /** 未指定時は分類タグ（field）のインライン編集を出さない（ThemePageClient 等） */
  ecoEditField?: string;
  setEcoEditField?: (v: string) => void;
  /** テーマ内の既存 field 候補（datalist） */
  ecosystemFieldSuggestions?: string[];
  ecoEditEarningsSummaryNote?: string;
  setEcoEditEarningsSummaryNote?: (v: string) => void;
  ecoEditSaving: boolean;
  /** 構造テーマ表: Asset 内にメモボタンを出す */
  showEcoMemoButton?: boolean;
  /** Theme ページでは決算列が無く Research 列に E: を含める */
  ecoResearchIncludeEarnings?: boolean;
  /** ツールバーのコンパクト行: 長文列の clamp を強める */
  compactRows?: boolean;
  formatEcoPriceForView: (e: ThemeEcosystemWatchItem) => string;
  onOpenTrade: (initial: TradeEntryInitial) => void;
  beginEditEcosystem: (e: ThemeEcosystemWatchItem) => void;
  deleteEcoMember: (memberId: string, ticker: string) => void;
  handleToggleEcosystemKeep: (memberId: string) => void | Promise<void>;
  handleToggleEcosystemBookmark: (memberId: string) => void | Promise<void>;
  saveEditEcosystem: (memberId: string) => void | Promise<void>;
  cancelEditEcosystem: () => void;
  setEcoMemoTarget?: (e: ThemeEcosystemWatchItem | null) => void;
  setEcoEarningsSummaryTarget?: (e: ThemeEcosystemWatchItem | null) => void;
  holderBadgeClass: (holder: string) => string;
  dividendCalendar: (months: number[]) => React.ReactNode;
  defensiveZClass: (z: number | null) => string;
};

export function EcosystemThemeTableMappedRow(props: EcosystemThemeTableMappedRowProps) {
  const {
    visibleColumnIds,
    e,
    ecoOpp,
    zEco,
    ddEco,
    isDefensiveTheme,
  themeLabel,
    theme,
    ecoEditingId,
    ecoEditCompanyName,
    setEcoEditCompanyName,
    ecoEditRole,
    setEcoEditRole,
    ecoEditMajor,
    setEcoEditMajor,
    ecoEditListingDate,
    setEcoEditListingDate,
    ecoEditMarketCap,
    setEcoEditMarketCap,
    ecoEditListingPrice,
    setEcoEditListingPrice,
    ecoEditField,
    setEcoEditField,
    ecosystemFieldSuggestions = [],
    ecoEditEarningsSummaryNote,
    setEcoEditEarningsSummaryNote,
    ecoEditSaving,
    showEcoMemoButton = false,
    ecoResearchIncludeEarnings = false,
    compactRows = false,
    formatEcoPriceForView,
    onOpenTrade,
    beginEditEcosystem,
    deleteEcoMember,
    handleToggleEcosystemKeep,
    handleToggleEcosystemBookmark,
    saveEditEcosystem,
    cancelEditEcosystem,
    setEcoMemoTarget,
    setEcoEarningsSummaryTarget,
    holderBadgeClass,
    dividendCalendar,
    defensiveZClass,
  } = props;

  return (
    <>
      {visibleColumnIds.map((colId, colIdx) => {
        const stickyFirst = colIdx === 0 ? stickyTdFirst : "";
        switch (colId) {
          case "asset":
            return (
              <td
                key={colId}
                className={cn(
                  "px-6 py-3 align-top min-w-0",
                  compactRows ? "max-w-[15rem]" : "max-w-[18rem]",
                  stickyFirst,
                )}
              >
                <div className="flex min-w-0 flex-col gap-1.5">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
                    <button
                      type="button"
                      onClick={() => void handleToggleEcosystemBookmark(e.id)}
                      className={cn(
                        "inline-flex shrink-0 rounded-md p-0.5 transition-colors hover:bg-muted/80",
                        e.isBookmarked ? "text-accent-amber" : "text-muted-foreground",
                      )}
                      title={e.isBookmarked ? "ブックマークを外す" : "ブックマーク"}
                      aria-pressed={e.isBookmarked}
                    >
                      <Star
                        className={cn("h-4 w-4", e.isBookmarked ? "fill-accent-amber text-accent-amber" : "")}
                      />
                    </button>
                    {ecoOpp ? (
                      <span
                        className="shrink-0 text-base leading-none"
                        title="テーマの加重累積 Alpha は上向きだが、日次 Alpha は統計的に冷え込み（割安候補）"
                        aria-label="Opportunity"
                      >
                        ✨
                      </span>
                    ) : null}
                    <span className="shrink-0 font-bold font-mono text-foreground group-hover:text-blue-400 transition-colors">
                      {e.ticker}
                    </span>
                    {e.companyName ? (
                      <span
                        className="min-w-0 flex-1 basis-[6rem] truncate text-[10px] text-muted-foreground"
                        title={e.companyName}
                      >
                        {e.companyName}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {/* <EcosystemKeepButton size="xs" isKept={e.isKept} onClick={() => void handleToggleEcosystemKeep(e.id)} /> */}
                    {e.isMajorPlayer ? (
                      <span className="shrink-0 text-[8px] font-bold uppercase tracking-wide text-amber-400/95 border border-amber-500/35 px-1.5 py-0.5 rounded">
                        Major
                      </span>
                    ) : null}
                    {e.inPortfolio ? (
                      <span className="shrink-0 text-[8px] font-bold uppercase tracking-wide text-emerald-400/95 border border-emerald-500/35 px-1.5 py-0.5 rounded">
                        In portfolio
                      </span>
                    ) : null}
                    {e.field.trim().length > 0 ? (
                      <span
                        className="shrink-0 text-[8px] font-bold tracking-wide px-1.5 py-0.5 rounded border text-muted-foreground border-border/60"
                        title="分類タグ（field）"
                      >
                        {e.field.trim()}
                      </span>
                    ) : null}
                  </div>
                  {e.isUnlisted ? (
                    <div className="flex flex-wrap items-center gap-1">
                      {e.estimatedIpoDate ? (
                        <span className="text-[8px] font-bold uppercase tracking-wide text-fuchsia-300/95 border border-fuchsia-500/30 px-1.5 py-0.5 rounded">
                          IPO {e.estimatedIpoDate}
                        </span>
                      ) : null}
                      {e.estimatedValuation ? (
                        <span className="text-[8px] font-bold uppercase tracking-wide text-foreground/95 border border-border/50 px-1.5 py-0.5 rounded">
                          {e.estimatedValuation}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  {ecoEditingId === e.id ? (
                    <div className="mt-1 space-y-2 rounded-lg border border-border bg-muted/40 p-2">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div className="space-y-1">
                          <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Company</p>
                          <Input
                            value={ecoEditCompanyName}
                            onChange={(ev) => setEcoEditCompanyName(ev.target.value)}
                            placeholder="企業名（任意）"
                            className="h-8 text-xs"
                            autoComplete="off"
                          />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Role</p>
                          <Input
                            value={ecoEditRole}
                            onChange={(ev) => setEcoEditRole(ev.target.value)}
                            placeholder="役割（任意）"
                            className="h-8 text-xs"
                            autoComplete="off"
                          />
                        </div>
                      </div>
                      <label className="flex items-center gap-2 text-[10px] text-muted-foreground select-none">
                        <input
                          type="checkbox"
                          checked={ecoEditMajor}
                          onChange={(ev) => setEcoEditMajor(ev.target.checked)}
                          className="accent-amber-500"
                        />
                        Major
                      </label>
                      {setEcoEditField != null ? (
                        <div className="space-y-1">
                          <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                            分類タグ（field）
                          </p>
                          <Input
                            list="eco-inline-field-datalist"
                            value={ecoEditField ?? ""}
                            onChange={(ev) => setEcoEditField(ev.target.value)}
                            placeholder="未設定でクリア"
                            maxLength={ECOSYSTEM_MEMBER_FIELD_MAX_LEN}
                            className="h-8 text-xs font-mono max-w-xs"
                            autoComplete="off"
                          />
                          {ecosystemFieldSuggestions.length > 0 ? (
                            <datalist id="eco-inline-field-datalist">
                              {ecosystemFieldSuggestions.map((opt) => (
                                <option key={opt} value={opt} />
                              ))}
                            </datalist>
                          ) : null}
                        </div>
                      ) : null}
                      {setEcoEditEarningsSummaryNote != null ? (
                        <div className="space-y-1">
                          <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                            決算要約（Markdown・保存で更新）
                          </p>
                          <textarea
                            value={ecoEditEarningsSummaryNote ?? ""}
                            onChange={(ev) => setEcoEditEarningsSummaryNote(ev.target.value)}
                            rows={4}
                            maxLength={EARNINGS_SUMMARY_NOTE_MAX_LEN}
                            placeholder="決算サマリー（memo とは別）"
                            className="w-full resize-y rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground"
                          />
                          <p className="text-[9px] text-muted-foreground">
                            {(ecoEditEarningsSummaryNote ?? "").length} / {EARNINGS_SUMMARY_NOTE_MAX_LEN}
                          </p>
                        </div>
                      ) : null}
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <div className="space-y-1">
                          <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                            初回取引日（DB）
                          </p>
                          <Input
                            value={ecoEditListingDate}
                            onChange={(ev) => setEcoEditListingDate(ev.target.value)}
                            placeholder="YYYY-MM-DD（Yahoo 近似・手修正可）"
                            className="h-8 text-xs font-mono"
                            autoComplete="off"
                          />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                            MCAP（任意・同期時点）
                          </p>
                          <Input
                            value={ecoEditMarketCap}
                            onChange={(ev) => setEcoEditMarketCap(ev.target.value)}
                            placeholder="時価総額・生値（参照: Yahoo）"
                            className="h-8 text-xs font-mono"
                            autoComplete="off"
                          />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                            listing_price（フォールバック用）
                          </p>
                          <Input
                            value={ecoEditListingPrice}
                            onChange={(ev) => setEcoEditListingPrice(ev.target.value)}
                            placeholder="長期％が取得不能のときのみ（現在価÷この値）"
                            className="h-8 text-xs font-mono"
                            autoComplete="off"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          onClick={() => void saveEditEcosystem(e.id)}
                          disabled={ecoEditSaving}
                          className="h-8 px-3 text-xs"
                        >
                          {ecoEditSaving ? "保存中…" : "保存"}
                        </Button>
                        <button
                          type="button"
                          onClick={cancelEditEcosystem}
                          className="h-8 rounded-md border border-border px-3 text-xs font-bold text-foreground hover:bg-muted/70"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {e.observationNotes
                    ? (() => {
                        const geo = extractGeopoliticalPotential(e.observationNotes);
                        return (
                          <span
                            className={cn(
                              "text-[10px] text-muted-foreground leading-snug",
                              compactRows ? "line-clamp-1" : "line-clamp-2",
                            )}
                            title={e.observationNotes}
                          >
                            {e.observationNotes}
                            {geo ? (
                              <span
                                className="ml-2 inline-flex items-center rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-300/90"
                                title={`地政学ポテンシャル: ${geo}`}
                              >
                                Geo
                              </span>
                            ) : null}
                          </span>
                        );
                      })()
                    : null}
                  {e.observationStartedAt ? (
                    <span className="text-[10px] font-mono text-muted-foreground pt-0.5">
                      観測開始（投入） <span className="text-muted-foreground">{e.observationStartedAt}</span>
                      {e.alphaObservationStartDate && e.alphaObservationStartDate !== e.observationStartedAt ? (
                        <span className="mt-0.5 block text-[9px] font-normal text-muted-foreground">
                          系列起点 {e.alphaObservationStartDate}
                        </span>
                      ) : null}
                    </span>
                  ) : e.alphaObservationStartDate ? (
                    <span className="text-[10px] font-mono text-muted-foreground pt-0.5">
                      観測起点 <span className="text-muted-foreground">{e.alphaObservationStartDate}</span>
                    </span>
                  ) : null}
                  {showEcoMemoButton && setEcoMemoTarget ? (
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => setEcoMemoTarget(e)}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide transition-colors",
                          e.memo != null && e.memo.trim().length > 0
                            ? "border-accent-cyan/45 bg-accent-cyan/10 text-accent-cyan"
                            : "border-border text-muted-foreground hover:bg-muted/70",
                        )}
                        title={
                          [e.memo, e.observationNotes].filter(Boolean).join("\n---\n") ||
                          "メモを編集（memo / observation_notes）"
                        }
                      >
                        <MessageSquare size={11} className="shrink-0" aria-hidden />
                        メモ
                      </button>
                      {setEcoEarningsSummaryTarget ? (
                        <button
                          type="button"
                          onClick={() => setEcoEarningsSummaryTarget(e)}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide transition-colors",
                            e.earningsSummaryNote != null && e.earningsSummaryNote.trim().length > 0
                              ? "border-violet-500/45 bg-violet-500/10 text-violet-200"
                              : "border-border text-muted-foreground hover:bg-muted/70",
                          )}
                          title="決算要約メモ（Markdown）を表示・編集"
                        >
                          <FileText size={11} className="shrink-0" aria-hidden />
                          決算要約
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </td>
            );
          case "trend5d": {
            const { series, hasIntradayPulse } = fiveDayPulseForEcosystem(e);
            return (
              <td key={colId} className={`px-4 py-3 align-middle text-center ${stickyFirst}`}>
                {series.length === 0 ? (
                  <span className="text-muted-foreground text-xs">No data</span>
                ) : (
                  <TrendMiniChart history={series} maxPoints={5} lastBarPulse={hasIntradayPulse} />
                )}
              </td>
            );
          }
          case "listing":
            return (
              <td
                key={colId}
                className={`px-3 py-3 text-center font-mono text-xs tabular-nums text-foreground/90 ${stickyFirst}`}
                title={
                  e.listingDate
                    ? `初回取引日（参照）: ${e.listingDate}（IPO 日とは限らない）`
                    : undefined
                }
              >
                {ecoListingYearLabel(e)}
              </td>
            );
          case "mktCap":
            return (
              <td
                key={colId}
                className={`px-4 py-3 text-right font-mono text-xs text-foreground/90 ${stickyFirst}`}
                title={e.marketCap != null ? `時価総額（参照・同期時点）: ${e.marketCap}` : undefined}
              >
                {ecoFmtMarketCapShort(e.marketCap)}
              </td>
            );
          case "perfListed": {
            const pf = e.performanceSinceFoundation;
            const tone = pf == null ? "text-muted-foreground" : INVESTMENT_METRIC_TONE_TEXT_CLASS[investmentMetricToneForSignedPercent(pf)];
            return (
              <td
                key={colId}
                className={`px-4 py-3 text-right font-mono text-xs font-bold tabular-nums ${tone} ${stickyFirst}`}
                title="長期変動率: 日足の最古〜最新（adj ペア優先）。チャート取得不能時は現在価÷listing_price（IPO 公式ではない）"
              >
                {pf == null || !Number.isFinite(pf) ? "—" : (
                  <>
                    {pf > 0 ? "+" : ""}
                    {pf.toFixed(1)}%
                  </>
                )}
              </td>
            );
          }
          case "earnings":
            return (
              <td key={colId} className={`px-4 py-3 text-center ${stickyFirst}`}>
                {e.nextEarningsDate ? (
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[11px] font-bold font-mono tabular-nums text-foreground">
                      {e.daysToEarnings != null ? `D-${e.daysToEarnings}` : "—"}
                    </span>
                    <span className="font-mono text-[9px] text-muted-foreground">{e.nextEarningsDate}</span>
                  </div>
                ) : (
                  <span className="text-muted-foreground text-xs">—</span>
                )}
              </td>
            );
          case "holder":
            return (
              <td key={colId} className={`px-6 py-3 align-top ${stickyFirst}`}>
                <div className="flex flex-wrap gap-1.5">
                  {e.holderTags.length > 0 ? (
                    e.holderTags.map((h) => (
                      <span key={h} className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${holderBadgeClass(h)}`} title={h}>
                        {h}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
                <div className="mt-2 text-[10px] text-muted-foreground md:hidden">{e.countryName}</div>
              </td>
            );
          case "dividend":
            return (
              <td key={colId} className={`px-6 py-3 align-top min-w-0 ${stickyFirst}`}>
                <div className="flex flex-col gap-2">
                  <div className="whitespace-nowrap">{dividendCalendar(e.dividendMonths)}</div>
                  {isDefensiveTheme ? <EcosystemDividendTradingStrip e={e} /> : null}
                </div>
              </td>
            );
          case "payout": {
            const po = ecosystemDividendPayoutPercent(e);
            return (
              <td
                key={colId}
                className={`whitespace-nowrap px-4 py-3 text-right font-mono text-xs font-bold tabular-nums ${dividendPayoutCellClassName(po)} ${stickyFirst}`}
                title="配当性向 = 年間配当（1株）÷ TTM EPS ×100。高すぎると内部留保が薄く減配リスクに注意"
              >
                {formatDividendPayoutPercent(po)}
              </td>
            );
          }
          case "defensiveRole":
            return (
              <td key={colId} className={`min-w-[10rem] px-6 py-3 align-top ${stickyFirst}`}>
                <div className="hidden md:block">
                  {e.defensiveStrength ? (
                    <p
                      className={cn(
                        "font-bold leading-snug text-foreground",
                        compactRows ? "text-xs line-clamp-2" : "text-sm",
                      )}
                      title={e.defensiveStrength}
                    >
                      {e.defensiveStrength}
                    </p>
                  ) : null}
                  {e.role ? (
                    <p
                      className={cn(
                        "mt-1 text-xs leading-relaxed text-muted-foreground",
                        compactRows ? "line-clamp-2" : "line-clamp-3",
                      )}
                      title={e.role}
                    >
                      {e.role}
                    </p>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
                <div className="md:hidden">
                  <p className="line-clamp-2 text-xs font-semibold leading-snug text-foreground" title={e.defensiveStrength ?? e.role}>
                    {e.defensiveStrength ?? e.role ?? "—"}
                  </p>
                </div>
              </td>
            );
          case "research":
            return (
              <td key={colId} className={`min-w-[12rem] px-6 py-3 align-top ${stickyFirst}`}>
                <div className="flex flex-col gap-1">
                  <div className="flex flex-row flex-wrap items-center gap-2">
                    <span className="rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                      {e.countryName}
                    </span>
                    {ecoResearchIncludeEarnings ? (
                      e.nextEarningsDate ? (
                        <span
                          className="rounded-md border border-border bg-card/60 px-2 py-0.5 text-[10px] font-bold text-foreground"
                          title={`次期決算予定日: ${e.nextEarningsDate}`}
                        >
                          E:{e.daysToEarnings != null ? `D${e.daysToEarnings}` : e.nextEarningsDate}
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">E:—</span>
                      )
                    ) : null}
                  </div>
                  <EcosystemDividendTradingStrip e={e} />
                </div>
              </td>
            );
          case "role":
            return (
              <td key={colId} className={`min-w-[10rem] px-6 py-3 align-top ${stickyFirst}`}>
                {e.role ? (
                  <div
                    className={cn(
                      "text-xs leading-relaxed text-foreground",
                      compactRows ? "line-clamp-2" : "line-clamp-4",
                    )}
                    title={e.role}
                  >
                    {e.role}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </td>
            );
          case "ruleOf40":
            return (
              <td key={colId} className={`px-6 py-3 text-right font-mono text-xs ${stickyFirst}`}>
                {(() => {
                  const t = ecoRuleOf40Tone(e.ruleOf40);
                  return (
                    <span className={t.cls} title="Rule of 40">
                      {t.text}
                    </span>
                  );
                })()}
              </td>
            );
          case "fcfYield":
            return (
              <td key={colId} className={`px-6 py-3 text-right font-mono text-xs ${stickyFirst}`}>
                {(() => {
                  const t = ecoFcfYieldTone(e.fcfYield);
                  return (
                    <span className={t.cls} title="FCF Yield（動的）">
                      {t.text}
                    </span>
                  );
                })()}
              </td>
            );
          case "judgment":
            return (
              <td key={colId} className={`px-4 py-3 text-center align-middle ${stickyFirst}`}>
                <JudgmentBadge status={e.judgmentStatus} reason={e.judgmentReason} />
              </td>
            );
          case "deviation":
            return (
              <td
                key={colId}
                className={`px-6 py-3 text-right font-mono text-xs font-bold ${
                  isDefensiveTheme
                    ? defensiveZClass(zEco)
                    : zEco == null
                      ? "text-muted-foreground"
                      : zEco < -1
                        ? "text-amber-400"
                        : zEco > 1
                          ? "text-emerald-400"
                          : "text-foreground"
                } ${stickyFirst}`}
              >
                {fmtZsigma(zEco)}
              </td>
            );
          case "drawdown":
            return (
              <td
                key={colId}
                className={`px-6 py-3 text-right font-mono text-xs font-bold ${
                  ddEco == null ? "text-muted-foreground" : ddEco < -10 ? "text-rose-400" : "text-foreground"
                } ${stickyFirst}`}
              >
                {fmtDdCol(ddEco)}
              </td>
            );
          case "pe":
            return (
              <td
                key={colId}
                className={`whitespace-nowrap px-6 py-3 text-right font-mono font-bold tabular-nums text-foreground ${stickyFirst}`}
                title={
                  e.trailingPe != null || e.forwardPe != null
                    ? `PE trailing=${e.trailingPe ?? "—"} / forward=${e.forwardPe ?? "—"}`
                    : "PE: 未取得"
                }
              >
                {fmtPe(ecoPeOf(e))}
              </td>
            );
          case "peg":
            return (
              <td
                key={colId}
                className={cn(
                  "whitespace-nowrap px-6 py-3 text-right font-mono font-bold tabular-nums",
                  pegRatioTextClass(e.pegRatio),
                  stickyFirst,
                )}
                title="PEG · 「成長%」列で予想成長率"
              >
                {fmtPegRatio(e.pegRatio)}
              </td>
            );
          case "egrowth":
            return (
              <td
                key={colId}
                className={`whitespace-nowrap px-6 py-3 text-right font-mono font-bold tabular-nums text-foreground ${stickyFirst}`}
                title={
                  e.expectedGrowth != null && Number.isFinite(e.expectedGrowth)
                    ? `内部値(小数)=${e.expectedGrowth.toFixed(6)}`
                    : undefined
                }
              >
                {fmtExpectedGrowthPercent(e.expectedGrowth)}
              </td>
            );
          case "eps":
            return (
              <td
                key={colId}
                className={cn(
                  "whitespace-nowrap px-6 py-3 text-right font-mono font-bold tabular-nums",
                  (() => {
                    const eps = ecoEpsOf(e);
                    if (eps == null) return "text-muted-foreground";
                    if (eps <= 0) return "text-rose-300";
                    return "text-foreground";
                  })(),
                  stickyFirst,
                )}
                title={
                  e.trailingEps != null || e.forwardEps != null
                    ? `EPS trailing=${e.trailingEps ?? "—"} / forward=${e.forwardEps ?? "—"}`
                    : "EPS: 未取得"
                }
              >
                {fmtEps(ecoEpsOf(e))}
              </td>
            );
          case "alpha":
            return (
              <td
                key={colId}
                className={`px-6 py-3 text-right font-mono font-bold ${
                  e.latestAlpha != null && Number.isFinite(e.latestAlpha) ? pctClass(e.latestAlpha) : "text-muted-foreground"
                } ${stickyFirst}`}
              >
                {e.latestAlpha != null && Number.isFinite(e.latestAlpha) ? (
                  <>
                    {e.latestAlpha > 0 ? "+" : ""}
                    {e.latestAlpha.toFixed(2)}%
                  </>
                ) : (
                  "—"
                )}
              </td>
            );
          case "cumTrend":
            return (
              <td key={colId} className={`px-6 py-3 ${stickyFirst}`}>
                <div className="flex flex-col items-center gap-1">
                  {e.isUnlisted ? (
                    <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                      Proxy Momentum{e.proxyTicker ? ` (${e.proxyTicker})` : ""}
                    </span>
                  ) : null}
                  <EcosystemCumulativeSparkline history={e.alphaHistory} />
                </div>
              </td>
            );
          case "volRatio":
            return (
              <td
                key={colId}
                title={e.volumeRatio != null ? `本日出来高 / 10 日平均: ${e.volumeRatio.toFixed(2)}×` : undefined}
                className={cn("px-4 py-3 text-right font-mono text-xs tabular-nums", volumeRatioToneClass(e.volumeRatio), stickyFirst)}
              >
                {fmtVolumeRatioCell(e.volumeRatio)}
              </td>
            );
          case "price":
            return (
              <td key={colId} className={`min-w-[8rem] whitespace-nowrap px-6 py-3 text-right align-top ${stickyFirst}`}>
                <div className="flex flex-col items-end gap-1">
                  <span className="font-mono text-xs text-foreground">{formatEcoPriceForView(e)}</span>
                  {!e.inPortfolio ? (
                    <button
                      type="button"
                      onClick={() =>
                        onOpenTrade({
                          ticker: e.isUnlisted && e.proxyTicker ? e.proxyTicker : e.ticker,
                          name: e.companyName || undefined,
                          theme: themeLabel,
                          themeId: theme?.id ?? e.themeId,
                          quantityDefault: 1,
                          ...(e.currentPrice != null && Number.isFinite(e.currentPrice) && e.currentPrice > 0
                            ? { unitPrice: e.currentPrice }
                            : {}),
                        })
                      }
                      className="rounded-md border border-cyan-500/40 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-cyan-400 hover:bg-cyan-500/10"
                    >
                      Trade
                    </button>
                  ) : null}
                  <div className="flex items-center gap-1">
                    {ecoEditingId !== e.id ? (
                      <button
                        type="button"
                        onClick={() => beginEditEcosystem(e)}
                        className="rounded-md border border-border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground hover:bg-muted/70"
                      >
                        Edit
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void deleteEcoMember(e.id, e.ticker)}
                      className="rounded-md border border-rose-500/40 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-rose-400 hover:bg-rose-500/10"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </td>
            );
          default: {
            const _exhaustive: never = colId;
            return _exhaustive;
          }
        }
      })}
    </>
  );
}
