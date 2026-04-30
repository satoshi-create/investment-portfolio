"use client";

import React from "react";
import { Gem } from "lucide-react";

import { JudgmentBadge } from "@/src/components/dashboard/JudgmentBadge";
import { RegionMarketBadge } from "@/src/components/dashboard/RegionMarketBadge";
import { InstitutionalOwnershipSensor } from "@/src/components/dashboard/InstitutionalOwnershipSensor";
import { YahooReturnChips } from "@/src/components/dashboard/YahooReturnChips";
import { EcosystemCumulativeSparkline } from "@/src/components/dashboard/EcosystemCumulativeSparkline";
import { TrendMiniChart } from "@/src/components/dashboard/TrendMiniChart";
import { DailyAlphaContextTooltip } from "@/src/components/dashboard/DailyAlphaContextTooltip";
import { EcosystemKeepButton } from "@/src/components/dashboard/EcosystemKeepButton";
import { ecoFcfYieldTone, ecoRuleOf40Tone } from "@/src/components/dashboard/eco-efficiency-display";
import { useCurrencyConverter } from "@/src/hooks/use-currency-converter";
import { stickyTdFirst } from "@/src/components/dashboard/table-sticky";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import {
  EcosystemStructuralInsightExpandable,
  EcosystemStructuralInsightHoverWrap,
  EcosystemViScoreBar,
  ecosystemMemberHasStructuralInsight,
} from "@/src/components/dashboard/EcosystemStructuralInsight";
import {
  dividendPayoutCellClassName,
  ecosystemDividendPayoutPercent,
  formatDividendPayoutPercent,
} from "@/src/lib/eco-dividend-payout";
import { formatLocalPriceForView } from "@/src/lib/format-display-currency";
import { ecosystemRowNativeCurrency } from "@/src/lib/ecosystem-row-native-currency";
import { cn } from "@/src/lib/cn";
import { regionDisplayFromYahooCountry } from "@/src/lib/region-display";
import { formatTickerForDisplay, yahooSymbolForTooltip } from "@/src/lib/ticker-display";
import {
  expectationCategoryBadgeClass,
  expectationCategoryBadgeShortJa,
} from "@/src/lib/expectation-category";
import { lynchAlignmentHintLines } from "@/src/lib/lynch-alignment-hints";
import { getLynchCategoryFromWatchItem } from "@/src/lib/lynch-category-computed";
import { METRIC_HEADER_TIP } from "@/src/lib/metric-header-tooltips";
import {
  ecosystemCumulativeSparklineTooltip,
  ecosystemWatchlistAlphaCellTooltip,
} from "@/src/lib/alpha-story-tooltip";
import { downloadEcosystemCumulativeAlphaCsv } from "@/src/lib/ecosystem-cumulative-alpha-csv";
import {
  fmtExpectedGrowthPercent,
  fmtPegRatio,
  fmtTotalReturnYieldRatio,
  pegLynchTenbaggerEligible,
  pegLynchTreasureEligible,
  pegRatioTextClass,
  totalReturnYieldRatioTextClass,
} from "@/src/lib/peg-display";
import type { EcosystemWatchlistColId } from "@/src/lib/ecosystem-watchlist-column-order";
import { ECOSYSTEM_ASSET_COL_WIDTH_CLASS } from "@/src/lib/ecosystem-watchlist-table-layout";
import type { InvestmentThemeRecord, ThemeEcosystemWatchItem } from "@/src/types/investment";
import { LYNCH_CATEGORY_LABEL_JA } from "@/src/types/investment";
import type { TradeEntryInitial } from "@/src/components/dashboard/TradeEntryForm";

function fmtDdCol(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function fmtZsigma(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(2)}σ`;
}

function ecoPeOf(e: ThemeEcosystemWatchItem): number | null {
  const v = e.trailingPe ?? e.forwardPe ?? null;
  return v != null && Number.isFinite(v) && v > 0 ? v : null;
}

function ecoPbrOf(e: ThemeEcosystemWatchItem): number | null {
  const v = e.priceToBook;
  return v != null && Number.isFinite(v) && v > 0 ? v : null;
}

function ecoEpsOf(e: ThemeEcosystemWatchItem): number | null {
  const v = e.trailingEps ?? e.forwardEps ?? null;
  return v != null && Number.isFinite(v) ? v : null;
}

function ecoForecastEpsOf(e: ThemeEcosystemWatchItem): number | null {
  const v = e.forwardEps;
  return v != null && Number.isFinite(v) ? v : null;
}

function ecoTrrOf(e: ThemeEcosystemWatchItem): number | null {
  const v = e.totalReturnYieldRatio;
  return v != null && Number.isFinite(v) ? v : null;
}

function fmtPe(v: number | null): string {
  if (v == null || !Number.isFinite(v) || v <= 0) return "—";
  return v >= 100 ? v.toFixed(0) : v.toFixed(1);
}

function fmtPbr(v: number | null): string {
  if (v == null || !Number.isFinite(v) || v <= 0) return "—";
  return v >= 100 ? v.toFixed(0) : v.toFixed(2);
}

function fmtEps(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  if (abs >= 100) return v.toFixed(0);
  if (abs >= 10) return v.toFixed(2);
  return v.toFixed(3);
}

function pctClass(v: number): string {
  if (!Number.isFinite(v)) return "text-muted-foreground";
  if (v > 0) return "text-emerald-400";
  if (v < 0) return "text-rose-400";
  return "text-muted-foreground";
}

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

function extractGeopoliticalPotential(observationNotes: string | null | undefined): string | null {
  if (observationNotes == null) return null;
  const s = observationNotes.trim();
  if (s.length === 0) return null;
  const m = s.match(/地政学(?:ポテンシャル|リスク|要因)[:：]\s*([^\n]+)\s*$/);
  if (m?.[1]) return m[1].trim();
  return null;
}

export type EcosystemWatchlistTableRowProps = {
  e: ThemeEcosystemWatchItem;
  ecoVisibleColumnIds: EcosystemWatchlistColId[];
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
  ecoEditSaving: boolean;
  formatEcoPriceForView: (e: ThemeEcosystemWatchItem) => string;
  onOpenTrade: (initial: TradeEntryInitial) => void;
  beginEditEcosystem: (e: ThemeEcosystemWatchItem) => void;
  deleteEcoMember: (memberId: string, ticker: string) => void;
  handleToggleEcosystemKeep: (memberId: string) => void | Promise<void>;
  saveEditEcosystem: (memberId: string) => void | Promise<void>;
  cancelEditEcosystem: () => void;
  holderBadgeClass: (holder: string) => string;
  dividendCalendar: (months: number[]) => React.ReactNode;
  defensiveZClass: (z: number | null) => string;
};

export function EcosystemWatchlistTableRow({
  e,
  ecoVisibleColumnIds,
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
  ecoEditSaving,
  formatEcoPriceForView,
  onOpenTrade,
  beginEditEcosystem,
  deleteEcoMember,
  handleToggleEcosystemKeep,
  saveEditEcosystem,
  cancelEditEcosystem,
  holderBadgeClass,
  dividendCalendar,
  defensiveZClass,
}: EcosystemWatchlistTableRowProps) {
  const { convert, viewCurrency } = useCurrencyConverter();
  const region = regionDisplayFromYahooCountry(e.yahooCountry);
  return (
    <tr
      id={`eco-row-${e.id}`}
      className={cn("group hover:bg-muted/60 transition-all scroll-mt-24", region.rowBg)}
    >
      {ecoVisibleColumnIds.map((colId, colIdx) => {
        const stickyFirst = colIdx === 0 ? stickyTdFirst : "";
        switch (colId) {
          case "asset":
            return (
              <td
                key={colId}
                className={cn(
                  "box-border px-6 py-4 align-top overflow-hidden",
                  ECOSYSTEM_ASSET_COL_WIDTH_CLASS,
                  stickyFirst,
                )}
              >
                <div className="flex flex-col gap-1">
                  <div className="flex flex-row flex-nowrap items-center gap-2 min-w-0">
                    <div className="min-w-0 flex flex-row flex-nowrap items-center gap-1.5 flex-1 overflow-hidden">
                      {ecoOpp ? (
                        <span
                          className="shrink-0 text-base leading-none"
                          title="テーマの加重累積 Alpha は上向きだが、日次 Alpha は統計的に冷え込み（割安候補）"
                          aria-label="Opportunity"
                        >
                          ✨
                        </span>
                      ) : null}
                      <RegionMarketBadge yahooCountry={e.yahooCountry} />
                      <InstitutionalOwnershipSensor ownership={e.institutionalOwnership} className="ml-0" />
                      <EcosystemStructuralInsightHoverWrap e={e} className="min-w-0 shrink-0">
                        <span
                          className="font-bold text-foreground group-hover:text-blue-400 transition-colors font-mono whitespace-nowrap truncate inline-block max-w-full"
                          title={`Yahoo: ${yahooSymbolForTooltip(e.ticker, null)}${e.yahooCountry ? ` · ${e.yahooCountry}` : ""}`}
                        >
                          {formatTickerForDisplay(e.ticker, e.instrumentKind)}
                        </span>
                      </EcosystemStructuralInsightHoverWrap>
                    </div>
                    <div className="shrink-0 flex flex-row flex-nowrap items-center gap-1">
                      <EcosystemKeepButton
                        size="xs"
                        isKept={e.isKept}
                        onClick={() => void handleToggleEcosystemKeep(e.id)}
                      />
                      {e.isMajorPlayer ? (
                        <span className="text-[8px] font-bold uppercase tracking-wide text-amber-400/95 border border-amber-500/35 px-1.5 py-0.5 rounded whitespace-nowrap">
                          Major
                        </span>
                      ) : null}
                      {e.inPortfolio ? (
                        <span className="text-[8px] font-bold uppercase tracking-wide text-emerald-400/95 border border-emerald-500/35 px-1.5 py-0.5 rounded whitespace-nowrap">
                          In portfolio
                        </span>
                      ) : null}
                    </div>
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
                  {e.companyName ? (
                    <EcosystemStructuralInsightHoverWrap e={e} className="block min-w-0">
                      <span
                        className="text-[10px] text-muted-foreground leading-snug line-clamp-2 cursor-help"
                        title={ecosystemMemberHasStructuralInsight(e) ? undefined : e.companyName}
                      >
                        {e.companyName}
                      </span>
                    </EcosystemStructuralInsightHoverWrap>
                  ) : null}
                  <EcosystemStructuralInsightExpandable e={e} />
                  {ecoEditingId === e.id ? (
                    <div className="mt-2 space-y-2 rounded-lg border border-border bg-muted/40 p-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                          className="h-8 px-3 rounded-md border border-border text-xs font-bold text-foreground hover:bg-muted/70"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {e.observationNotes ? (
                    (() => {
                      const geo = extractGeopoliticalPotential(e.observationNotes);
                      return (
                        <span
                          className="text-[10px] text-muted-foreground leading-snug line-clamp-2"
                          title={e.observationNotes ?? undefined}
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
                  ) : null}
                  {e.observationStartedAt ? (
                    <span className="text-[10px] font-mono text-muted-foreground pt-0.5">
                      観測開始（投入） <span className="text-muted-foreground">{e.observationStartedAt}</span>
                      {e.alphaObservationStartDate && e.alphaObservationStartDate !== e.observationStartedAt ? (
                        <span className="block text-[9px] text-muted-foreground mt-0.5 font-normal">
                          系列起点 {e.alphaObservationStartDate}
                        </span>
                      ) : null}
                    </span>
                  ) : e.alphaObservationStartDate ? (
                    <span className="text-[10px] font-mono text-muted-foreground pt-0.5">
                      観測起点 <span className="text-muted-foreground">{e.alphaObservationStartDate}</span>
                    </span>
                  ) : null}
                </div>
              </td>
            );
          case "lynch": {
            const computedLynch = getLynchCategoryFromWatchItem(e);
            const hintLines =
              computedLynch != null
                ? lynchAlignmentHintLines({
                    lynchCategory: computedLynch,
                    expectedGrowth: e.expectedGrowth,
                    trailingPe: e.trailingPe,
                    forwardPe: e.forwardPe,
                    dividendYieldPercent: e.dividendYieldPercent,
                  })
                : [];
            return (
              <td
                key={colId}
                className={`px-3 py-4 align-middle min-w-[7.5rem] max-w-[11rem] text-center ${stickyFirst}`}
              >
                <div className="mx-auto flex max-w-full flex-col items-center gap-1 text-center">
                  {computedLynch ? (
                    <span
                      className={`inline-flex w-fit text-[8px] font-bold tracking-tight px-1.5 py-0.5 rounded border ${expectationCategoryBadgeClass(computedLynch)}`}
                      title={LYNCH_CATEGORY_LABEL_JA[computedLynch]}
                    >
                      {expectationCategoryBadgeShortJa(computedLynch)}
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">—</span>
                  )}
                  {hintLines.length > 0 ? (
                    <ul className="mt-0.5 w-full space-y-0.5 text-left text-[9px] leading-snug text-amber-700/90 dark:text-amber-400/85 list-disc pl-3.5">
                      {hintLines.map((line, hi) => (
                        <li key={hi}>{line}</li>
                      ))}
                    </ul>
                  ) : null}
                  <p className="text-[8px] text-muted-foreground leading-snug">
                    自動分類（DB の手動値は未使用）
                  </p>
                </div>
              </td>
            );
          }
          case "holder":
            return (
              <td key={colId} className={`px-6 py-4 align-middle whitespace-nowrap ${stickyFirst}`}>
                <div className="flex min-h-[2.5rem] flex-wrap content-center items-center justify-center gap-1.5">
                  {e.holderTags.length > 0 ? (
                    e.holderTags.map((h) => (
                      <span
                        key={h}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${holderBadgeClass(h)}`}
                        title={h}
                      >
                        {h}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
                <div className="mt-2 text-center md:hidden text-[10px] text-muted-foreground">{e.countryName}</div>
              </td>
            );
          case "dividend":
            return (
              <td key={colId} className={`px-6 py-4 align-top whitespace-nowrap ${stickyFirst}`}>
                {dividendCalendar(e.dividendMonths)}
              </td>
            );
          case "payout": {
            const po = ecosystemDividendPayoutPercent(e);
            return (
              <td
                key={colId}
                className={`whitespace-nowrap px-4 py-4 text-right font-mono text-xs font-bold tabular-nums ${dividendPayoutCellClassName(po)} ${stickyFirst}`}
                title="配当性向 = 年間配当（1株）÷ TTM EPS ×100"
              >
                {formatDividendPayoutPercent(po)}
              </td>
            );
          }
          case "defensiveRole":
            return (
              <td key={colId} className={`px-6 py-4 align-top min-w-[10rem] ${stickyFirst}`}>
                <div className="hidden md:block">
                  {e.defensiveStrength ? (
                    <p className="text-sm font-bold text-foreground leading-snug">{e.defensiveStrength}</p>
                  ) : null}
                  {e.role ? (
                    <p className="text-xs text-muted-foreground leading-relaxed mt-1 line-clamp-3" title={e.role}>
                      {e.role}
                    </p>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
                <div className="md:hidden">
                  <p
                    className="text-xs font-semibold text-foreground leading-snug line-clamp-2"
                    title={e.defensiveStrength ?? e.role}
                  >
                    {e.defensiveStrength ?? e.role ?? "—"}
                  </p>
                </div>
              </td>
            );
          case "research":
            return (
              <td key={colId} className={`px-6 py-4 align-top min-w-[12rem] ${stickyFirst}`}>
                <div className="flex flex-col gap-1">
                  <div className="flex flex-row flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold text-muted-foreground border border-border bg-muted/40 px-2 py-0.5 rounded-md whitespace-nowrap">
                      {e.countryName}
                    </span>
                    {e.nextEarningsDate ? (
                      <span
                        className="text-[10px] font-bold text-foreground border border-border bg-card/60 px-2 py-0.5 rounded-md whitespace-nowrap"
                        title={`次期決算予定日: ${e.nextEarningsDate}`}
                      >
                        E:{e.daysToEarnings != null ? `D${e.daysToEarnings}` : e.nextEarningsDate}
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">E:—</span>
                    )}
                    {e.dividendYieldPercent != null ? (
                      <span
                        className="text-[10px] font-bold text-foreground border border-border bg-card/60 px-2 py-0.5 rounded-md whitespace-nowrap"
                        title={
                          e.annualDividendRate != null ? `年間配当: ${e.annualDividendRate}` : "年間配当: —"
                        }
                      >
                        Div:{e.dividendYieldPercent.toFixed(2)}%
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">Div:—</span>
                    )}
                  </div>
                  <YahooReturnChips
                    consecutiveDividendYears={e.consecutiveDividendYears}
                    ttmRepurchaseOfStock={e.ttmRepurchaseOfStock}
                    yahooBuybackPosture={e.yahooBuybackPosture}
                    yahooQuoteSharesOutstanding={e.yahooQuoteSharesOutstanding}
                    yahooInsiderNetPurchaseShares={e.yahooInsiderNetPurchaseShares}
                  />
                </div>
              </td>
            );
          case "role":
            return (
              <td key={colId} className={`px-6 py-4 align-top min-w-[10rem] ${stickyFirst}`}>
                {e.role ? (
                  <div className="text-xs text-foreground leading-relaxed line-clamp-4" title={e.role}>
                    {e.role}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </td>
            );
          case "viScore":
            return (
              <td key={colId} className={`px-4 py-4 align-middle ${stickyFirst}`}>
                <EcosystemViScoreBar viScore={e.viScore ?? null} />
              </td>
            );
          case "ruleOf40":
            return (
              <td key={colId} className={`px-6 py-4 text-right font-mono text-xs whitespace-nowrap ${stickyFirst}`}>
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
              <td key={colId} className={`px-6 py-4 text-right font-mono text-xs whitespace-nowrap ${stickyFirst}`}>
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
          case "netCash":
            return (
              <td key={colId} className={`px-6 py-4 text-right font-mono text-xs whitespace-nowrap ${stickyFirst}`}>
                {e.netCash != null && Number.isFinite(e.netCash) ? (
                  <span title={METRIC_HEADER_TIP.netCash}>
                    {formatLocalPriceForView(
                      e.netCash,
                      ecosystemRowNativeCurrency(e),
                      viewCurrency,
                      convert,
                    )}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
            );
          case "netCashYield":
            return (
              <td key={colId} className={`px-6 py-4 text-right font-mono text-xs whitespace-nowrap ${stickyFirst}`}>
                {(() => {
                  const v = e.netCashYieldPercent;
                  if (v == null || !Number.isFinite(v)) {
                    return <span className="text-muted-foreground">—</span>;
                  }
                  const t = ecoFcfYieldTone(v);
                  return (
                    <span className={t.cls} title={METRIC_HEADER_TIP.netCashYield}>
                      {t.text}
                    </span>
                  );
                })()}
              </td>
            );
          case "judgment":
            return (
              <td key={colId} className={`px-4 py-4 text-center align-middle ${stickyFirst}`}>
                <JudgmentBadge status={e.judgmentStatus} reason={e.judgmentReason} />
              </td>
            );
          case "deviation":
            return (
              <td
                key={colId}
                className={`px-6 py-4 text-right font-mono text-xs font-bold whitespace-nowrap ${
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
                className={`px-6 py-4 text-right font-mono text-xs font-bold whitespace-nowrap ${
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
                className={`px-6 py-4 text-right font-mono font-bold tabular-nums whitespace-nowrap text-foreground ${stickyFirst}`}
                title={
                  e.trailingPe != null || e.forwardPe != null
                    ? `PE trailing=${e.trailingPe ?? "—"} / forward=${e.forwardPe ?? "—"}`
                    : "PE: 未取得"
                }
              >
                <DailyAlphaContextTooltip
                  metricLabel="PER"
                  dailyValues={e.alphaDailyHistory}
                  observationDates={e.alphaDailyObservationDates}
                >
                  <span className="inline-block w-full text-right">{fmtPe(ecoPeOf(e))}</span>
                </DailyAlphaContextTooltip>
              </td>
            );
          case "pbr":
            return (
              <td
                key={colId}
                className={`px-6 py-4 text-right font-mono font-bold tabular-nums whitespace-nowrap text-foreground ${stickyFirst}`}
                title={METRIC_HEADER_TIP.pbr}
              >
                {fmtPbr(ecoPbrOf(e))}
              </td>
            );
          case "peg": {
            const peg = e.pegRatio;
            return (
              <td
                key={colId}
                className={cn(
                  "px-6 py-4 text-right font-mono font-bold tabular-nums whitespace-nowrap align-middle",
                  pegRatioTextClass(peg),
                  stickyFirst,
                )}
                title={`PEG · 「成長%」列で予想成長率\n\n${METRIC_HEADER_TIP.divAdjPeg}`}
              >
                <div className="flex min-h-[2.25rem] flex-col items-end justify-center gap-0.5 leading-tight">
                  <div className="flex items-center justify-end gap-0.5">
                    {pegLynchTreasureEligible(peg) ? (
                      <span title="お宝（PEG < 1）">
                        <Gem className="h-3 w-3 shrink-0 text-amber-400" aria-hidden />
                      </span>
                    ) : null}
                    <span>{fmtPegRatio(peg)}</span>
                  </div>
                  {pegLynchTenbaggerEligible(peg) ? (
                    <span className="text-[9px] font-semibold tracking-tight text-amber-300/95">🚀 テンバガー候補</span>
                  ) : null}
                  {e.dividendAdjustedPeg != null && Number.isFinite(e.dividendAdjustedPeg) ? (
                    <span className="text-[10px] font-mono text-muted-foreground" title={METRIC_HEADER_TIP.divAdjPeg}>
                      D-PEG {e.dividendAdjustedPeg.toFixed(2)}
                    </span>
                  ) : null}
                </div>
              </td>
            );
          }
          case "trr": {
            const trr = ecoTrrOf(e);
            return (
              <td
                key={colId}
                className={cn(
                  "px-6 py-4 text-right font-mono font-bold tabular-nums whitespace-nowrap",
                  totalReturnYieldRatioTextClass(trr),
                  stickyFirst,
                )}
                title={METRIC_HEADER_TIP.trr}
              >
                {fmtTotalReturnYieldRatio(trr)}
              </td>
            );
          }
          case "egrowth":
            return (
              <td
                key={colId}
                className={`px-6 py-4 text-right font-mono font-bold tabular-nums whitespace-nowrap text-foreground ${stickyFirst}`}
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
                  "px-6 py-4 text-right font-mono font-bold tabular-nums whitespace-nowrap",
                  (() => {
                    const eps = ecoEpsOf(e);
                    if (eps == null) return "text-muted-foreground";
                    if (eps <= 0) return "text-rose-300";
                    return "text-foreground";
                  })(),
                  stickyFirst,
                )}
              >
                <DailyAlphaContextTooltip
                  metricLabel="EPS（Trailing 優先）"
                  dailyValues={e.alphaDailyHistory}
                  observationDates={e.alphaDailyObservationDates}
                >
                  <span className="inline-block w-full text-right">{fmtEps(ecoEpsOf(e))}</span>
                </DailyAlphaContextTooltip>
              </td>
            );
          case "forecastEps":
            return (
              <td
                key={colId}
                className={cn(
                  "px-6 py-4 text-right font-mono font-bold tabular-nums whitespace-nowrap",
                  (() => {
                    const fe = ecoForecastEpsOf(e);
                    if (fe == null) return "text-muted-foreground";
                    if (fe <= 0) return "text-rose-300";
                    return "text-cyan-200/90";
                  })(),
                  stickyFirst,
                )}
              >
                <DailyAlphaContextTooltip
                  metricLabel="予想EPS（Forward）"
                  dailyValues={e.alphaDailyHistory}
                  observationDates={e.alphaDailyObservationDates}
                >
                  <span className="inline-block w-full text-right">{fmtEps(ecoForecastEpsOf(e))}</span>
                </DailyAlphaContextTooltip>
              </td>
            );
          case "trend5d":
          case "listing":
          case "mktCap":
          case "perfListed":
          case "earnings":
            return (
              <td key={colId} className={`px-6 py-4 text-xs text-muted-foreground ${stickyFirst}`}>
                —
              </td>
            );
          case "alpha":
            return (
              <td
                key={colId}
                className={`px-6 py-4 text-right font-mono font-bold whitespace-nowrap ${
                  e.latestAlpha != null && Number.isFinite(e.latestAlpha) ? pctClass(e.latestAlpha) : "text-muted-foreground"
                } ${stickyFirst}`}
                title={ecosystemWatchlistAlphaCellTooltip(e)}
              >
                <div className="flex flex-col items-end gap-1 min-w-[5rem]">
                  {e.latestAlpha != null && Number.isFinite(e.latestAlpha) ? (
                    <span>
                      {e.latestAlpha > 0 ? "+" : ""}
                      {e.latestAlpha.toFixed(2)}%
                    </span>
                  ) : (
                    "—"
                  )}
                  {e.alphaHistory.length > 0 ? (
                    <button
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        downloadEcosystemCumulativeAlphaCsv(e, { themeLabel: themeLabel });
                      }}
                      className="text-[9px] font-bold uppercase tracking-wide text-cyan-400/90 border border-cyan-500/35 rounded px-1.5 py-0.5 hover:bg-cyan-500/10"
                    >
                      CSV
                    </button>
                  ) : null}
                  {e.alphaDailyHistory && e.alphaDailyHistory.length > 1 ? (
                    <TrendMiniChart history={e.alphaDailyHistory} maxPoints={18} lastBarPulse={e.priceSource === "live"} />
                  ) : null}
                </div>
              </td>
            );
          case "cumTrend":
            return (
              <td key={colId} title={ecosystemCumulativeSparklineTooltip(e)} className={`px-6 py-4 align-top min-w-[9rem] ${stickyFirst}`}>
                <div className="flex flex-col items-center gap-1">
                  {e.isUnlisted ? (
                    <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
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
                className={cn("px-4 py-4 text-right font-mono text-xs tabular-nums", volumeRatioToneClass(e.volumeRatio), stickyFirst)}
              >
                {fmtVolumeRatioCell(e.volumeRatio)}
              </td>
            );
          case "price":
            return (
              <td key={colId} className={`px-6 py-4 text-right align-middle min-w-[8rem] whitespace-nowrap ${stickyFirst}`}>
                <div className="flex min-h-[3.25rem] flex-col items-end justify-center gap-1.5">
                  <span className="font-mono text-foreground text-xs tabular-nums leading-none">
                    {formatEcoPriceForView(e)}
                  </span>
                  <div className="flex flex-col items-end gap-1">
                    {!e.inPortfolio ? (
                      <button
                        type="button"
                        onClick={() =>
                          onOpenTrade({
                            ticker: e.isUnlisted && e.proxyTicker ? e.proxyTicker : e.ticker,
                            name: e.companyName || undefined,
                            theme: themeLabel,
                            themeId: theme?.id,
                            quantityDefault: 1,
                            ...(e.currentPrice != null && Number.isFinite(e.currentPrice) && e.currentPrice > 0
                              ? { unitPrice: e.currentPrice }
                              : {}),
                          })
                        }
                        className="text-[9px] font-bold uppercase tracking-wide text-cyan-400 border border-cyan-500/40 px-2 py-0.5 rounded-md hover:bg-cyan-500/10"
                      >
                        Trade
                      </button>
                    ) : null}
                    <div className="flex flex-row flex-nowrap items-center gap-1">
                      {ecoEditingId !== e.id ? (
                        <button
                          type="button"
                          onClick={() => beginEditEcosystem(e)}
                          className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground border border-border px-2 py-0.5 rounded-md hover:bg-muted/70"
                        >
                          Edit
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void deleteEcoMember(e.id, e.ticker)}
                        className="text-[9px] font-bold uppercase tracking-wide text-rose-400 border border-rose-500/40 px-2 py-0.5 rounded-md hover:bg-rose-500/10"
                      >
                        Delete
                      </button>
                    </div>
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
    </tr>
  );
}
