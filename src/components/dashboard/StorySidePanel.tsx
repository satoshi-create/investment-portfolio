"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, X } from "lucide-react";

import { EarningsNoteMarkdownPreview } from "@/src/components/dashboard/EarningsNoteMarkdownPreview";
import { useDashboardData } from "@/src/components/dashboard/DashboardDataContext";
import { useStoryPanel } from "@/src/components/dashboard/StoryPanelContext";
import {
  EarningsSummaryNoteTextarea,
  HoldingOrEcosystemMemoTextarea,
} from "@/src/components/dashboard/HoldingEcosystemNoteFields";
import { expectationCategoryBadgeClass, expectationCategoryBadgeShortJa } from "@/src/lib/expectation-category";
import { fetchWithTimeout } from "@/src/lib/fetch-utils";
import { getLynchCategory, getLynchCategoryFromWatchItem } from "@/src/lib/lynch-category-computed";
import {
  GROWTH_QUALITY_OPTIONS,
  pickUnclassifiedStoryPlaceholder,
  suggestCategoryFromDiagnostic,
  UNIVERSAL_FIVE_PATCHES,
  type GrowthQualityAnswer,
} from "@/src/lib/lynch-unclassified-diagnostic";
import { lynchStoryTemplateFor } from "@/src/lib/lynch-story-templates";
import {
  decodeStoryPanelLynchPersist,
  encodeStoryPanelLynchPersist,
} from "@/src/lib/story-panel-lynch-persist";
import { cn } from "@/src/lib/cn";
import type { StoryHubPersistFields } from "@/src/lib/story-hub-optimistic";
import { queueStoryForNotionSync } from "@/src/lib/notion-sync";
import {
  LYNCH_CATEGORY_KEYS,
  LYNCH_CATEGORY_LABEL_JA,
  type LynchCategory,
  type Stock,
  type ThemeEcosystemWatchItem,
} from "@/src/types/investment";

export type StorySidePanelProps =
  | {
      variant: "holding";
      stock: Stock;
      userId: string;
      onClose: () => void;
      /** メモ・決算要約いずれかの保存成功後にダッシュ/テーマを再取得 */
      onAfterSave?: () => void | Promise<void>;
      /** パネルの幅（px） */
      width?: number;
      /** 幅が変更された時のコールバック */
      onWidthChange?: (width: number) => void;
    }
  | {
      variant: "themeMember";
      themeId: string;
      member: ThemeEcosystemWatchItem;
      themeSlugForRevalidate: string | null;
      userId: string;
      onClose: () => void;
      onAfterSave?: () => void | Promise<void>;
      width?: number;
      onWidthChange?: (width: number) => void;
    };

type MainTab = "basic" | "lynch";
type EarningsSubTab = "edit" | "preview";

function normalizeGrowthQualityFromPersist(s: string): GrowthQualityAnswer {
  if (s === "") return "";
  return GROWTH_QUALITY_OPTIONS.some((o) => o.id === s) ? (s as GrowthQualityAnswer) : "";
}

function buildStoryHubPersistFields(
  memoNext: string | null,
  earningsDraft: string,
  composedNarrative: string,
  storyText: string,
): StoryHubPersistFields {
  const et = earningsDraft.trim();
  return {
    memo: memoNext,
    earningsSummaryNote: et.length > 0 ? et : null,
    lynchDriversNarrative: composedNarrative,
    lynchStoryText: storyText,
  };
}

/**
 * 保有行またはテーマウォッチ行向けストーリー・ハブ。
 */
export function StorySidePanel(props: StorySidePanelProps) {
  const variant = props.variant;
  const userId = props.userId;
  const onClose = props.onClose;
  const onAfterSave = props.onAfterSave;
  const width = props.width ?? 400;
  const onWidthChange = props.onWidthChange;
  const stock = variant === "holding" ? props.stock : null;
  const themeId = variant === "themeMember" ? props.themeId : null;
  const member = variant === "themeMember" ? props.member : null;
  const themeSlugForRevalidate = variant === "themeMember" ? props.themeSlugForRevalidate : null;
  const { patchStockStoryHubFields } = useDashboardData();
  const { applyThemeMemberStoryOptimistic } = useStoryPanel();
  const [mainTab, setMainTab] = useState<MainTab>("basic");
  const [earningsSubTab, setEarningsSubTab] = useState<EarningsSubTab>("edit");
  const [memoDraft, setMemoDraft] = useState("");
  const [earningsDraft, setEarningsDraft] = useState("");
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  const [driversNarrative, setDriversNarrative] = useState("");
  const [storyText, setStoryText] = useState("");
  const [manualLens, setManualLens] = useState<LynchCategory>("Stalwart");
  const [growthQualityAnswer, setGrowthQualityAnswer] = useState<GrowthQualityAnswer>("");
  const [universalPatches, setUniversalPatches] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= 320 && newWidth <= window.innerWidth * 0.8) {
        onWidthChange?.(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, onWidthChange]);

  const computedLynch = useMemo(() => {
    if (variant === "holding" && stock) return getLynchCategory(stock);
    if (variant === "themeMember" && member) return getLynchCategoryFromWatchItem(member);
    return null;
  }, [variant, stock, member]);
  const effectiveCategory = computedLynch ?? manualLens;
  const template = useMemo(() => lynchStoryTemplateFor(effectiveCategory), [effectiveCategory]);

  const suggestedFromDiagnostic = useMemo(
    () => suggestCategoryFromDiagnostic(growthQualityAnswer),
    [growthQualityAnswer],
  );

  const storyPlaceholder = useMemo(
    () =>
      computedLynch == null
        ? pickUnclassifiedStoryPlaceholder(growthQualityAnswer, universalPatches)
        : template.storyTemplate,
    [computedLynch, growthQualityAnswer, universalPatches, template.storyTemplate],
  );

  useEffect(() => {
    if (variant === "holding" && stock) {
      setMemoDraft(stock.memo ?? "");
      setEarningsDraft(stock.earningsSummaryNote ?? "");
      const { meta, narrative } = decodeStoryPanelLynchPersist(stock.lynchDriversNarrative);
      setDriversNarrative(narrative);
      setSelectedDrivers(meta.drivers);
      setGrowthQualityAnswer(normalizeGrowthQualityFromPersist(meta.growthQuality));
      const allowedPatch = new Set(UNIVERSAL_FIVE_PATCHES.map((p) => p.id));
      setUniversalPatches(meta.universalPatches.filter((id) => allowedPatch.has(id)));
      setStoryText(stock.lynchStoryText ?? "");
    } else if (variant === "themeMember" && member) {
      setMemoDraft(member.memo ?? "");
      setEarningsDraft(member.earningsSummaryNote ?? "");
      const { meta, narrative } = decodeStoryPanelLynchPersist(member.lynchDriversNarrative);
      setDriversNarrative(narrative);
      setSelectedDrivers(meta.drivers);
      setGrowthQualityAnswer(normalizeGrowthQualityFromPersist(meta.growthQuality));
      const allowedPatch = new Set(UNIVERSAL_FIVE_PATCHES.map((p) => p.id));
      setUniversalPatches(meta.universalPatches.filter((id) => allowedPatch.has(id)));
      setStoryText(member.lynchStoryText ?? "");
    }
    setEarningsSubTab("edit");
    setMainTab("basic");
    setManualLens("Stalwart");
    setSaveErr(null);
  }, [variant, stock, member]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saving, onClose]);

  const toggleDriver = useCallback((label: string) => {
    setSelectedDrivers((prev) => (prev.includes(label) ? prev.filter((d) => d !== label) : [...prev, label]));
  }, []);

  const toggleUniversalPatch = useCallback((id: string) => {
    setUniversalPatches((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  async function handleSave() {
    if (variant === "themeMember" && member && themeId) {
      setSaving(true);
      setSaveErr(null);
      try {
        const composedNarrative = encodeStoryPanelLynchPersist(
          {
            drivers: selectedDrivers,
            growthQuality: growthQualityAnswer,
            universalPatches,
          },
          driversNarrative,
        );
        const memoNext = memoDraft.trim().length > 0 ? memoDraft.trim() : null;
        const memoPrev = member.memo != null && member.memo.trim().length > 0 ? member.memo.trim() : null;
        const earnPrev = (member.earningsSummaryNote ?? "").trim();
        const earnNext = earningsDraft.trim();
        const narrPrevFull = (member.lynchDriversNarrative ?? "").trim();
        const narrNextFull = composedNarrative.trim();
        const storyPrev = (member.lynchStoryText ?? "").trim();
        const storyNext = storyText.trim();
        if (
          memoNext === memoPrev &&
          earnNext === earnPrev &&
          narrNextFull === narrPrevFull &&
          storyNext === storyPrev
        ) {
          void onAfterSave?.();
          onClose();
          return;
        }
        const res = await fetchWithTimeout(
          "/api/theme-ecosystem/member",
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId,
              themeId,
              memberId: member.id,
              memo: memoNext,
              earningsSummaryNote: earningsDraft,
              lynchDriversNarrative: composedNarrative,
              lynchStoryText: storyText,
              themeSlugForRevalidate: themeSlugForRevalidate ?? undefined,
            }),
          },
          { timeoutMs: 25_000 },
        );
        const json = (await res.json()) as { error?: string };
        if (!res.ok) {
          setSaveErr(json.error ?? `保存に失敗しました（HTTP ${res.status}）`);
          return;
        }
        applyThemeMemberStoryOptimistic(
          themeId,
          member.id,
          buildStoryHubPersistFields(memoNext, earningsDraft, composedNarrative, storyText),
        );
        void onAfterSave?.();
        onClose();
      } catch (e) {
        setSaveErr(e instanceof Error ? e.message : "保存に失敗しました");
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!stock) return;
    setSaving(true);
    setSaveErr(null);
    try {
      const memoNext = memoDraft.trim().length > 0 ? memoDraft.trim() : null;
      const memoPrev = stock.memo != null && stock.memo.trim().length > 0 ? stock.memo.trim() : null;
      const earnPrev = (stock.earningsSummaryNote ?? "").trim();
      const earnNext = earningsDraft.trim();
      const composedNarrative = encodeStoryPanelLynchPersist(
        {
          drivers: selectedDrivers,
          growthQuality: growthQualityAnswer,
          universalPatches,
        },
        driversNarrative,
      );
      const narrPrevFull = (stock.lynchDriversNarrative ?? "").trim();
      const narrNextFull = composedNarrative.trim();
      const storyPrev = (stock.lynchStoryText ?? "").trim();
      const storyNext = storyText.trim();

      const hasDbChanges =
        memoNext !== memoPrev || earnNext !== earnPrev || narrNextFull !== narrPrevFull || storyNext !== storyPrev;

      if (hasDbChanges) {
        const res = await fetchWithTimeout(
          "/api/holdings/story-hub",
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId,
              holdingId: stock.id,
              memo: memoNext,
              earningsSummaryNote: earningsDraft,
              lynchDriversNarrative: composedNarrative,
              lynchStoryText: storyText,
            }),
          },
          { timeoutMs: 25_000 },
        );
        const json = (await res.json()) as { error?: string };
        if (!res.ok) {
          setSaveErr(json.error ?? `ストーリーの保存に失敗しました（HTTP ${res.status}）`);
          return;
        }
        patchStockStoryHubFields(
          stock.id,
          buildStoryHubPersistFields(memoNext, earningsDraft, composedNarrative, storyText),
        );
      }

      queueStoryForNotionSync({
        source: "inventory_story_modal",
        holdingId: stock.id,
        ticker: stock.ticker,
        companyName: stock.name?.trim().length ? stock.name : null,
        lynchCategory: computedLynch,
        selectedLensCategory: effectiveCategory,
        selectedDrivers: [...selectedDrivers],
        driversNarrative,
        storyText,
        memoPlain: memoNext,
        earningsSummaryNoteMarkdown: earningsDraft.trim().length > 0 ? earningsDraft : null,
        queuedAtIso: new Date().toISOString(),
        diagnosticMode: computedLynch == null,
        growthQualityAnswer,
        universalPatches: [...universalPatches],
      });

      void onAfterSave?.();
      onClose();
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  if (variant === "holding" && !stock) return null;
  if (variant === "themeMember" && !member) return null;

  const panelTicker = stock?.ticker ?? member!.ticker;
  const panelName = stock != null ? stock.name : member!.companyName;
  const panelNextEarningsDate = stock?.nextEarningsDate ?? member?.nextEarningsDate ?? null;
  const panelDaysToEarnings = stock?.daysToEarnings ?? member?.daysToEarnings ?? null;

  const sectionFrame = "rounded-lg border border-border bg-card/30";

  return (
    <aside
      className={cn(
        "relative flex min-h-0 shrink-0 flex-col self-stretch overflow-hidden border-l border-border bg-card/40 backdrop-blur-sm",
        "transition-[width] duration-300 ease-out",
        isResizing && "transition-none",
      )}
      style={{ width: `min(100%, ${width}px)` }}
      aria-labelledby="story-side-panel-title"
    >
      {/* Resize handle */}
      <div
        onMouseDown={startResizing}
        className={cn(
          "absolute inset-y-0 left-0 z-10 w-1.5 cursor-col-resize transition-colors hover:bg-muted/80 active:bg-muted",
          isResizing && "bg-muted",
        )}
      />
      <div className="flex shrink-0 flex-col gap-3 border-b border-border px-4 py-4 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">鑑定録 · Story Hub</p>
            <h2 id="story-side-panel-title" className="text-sm font-semibold text-foreground">
              ストーリー
            </h2>
            <p className="font-mono text-sm font-bold text-foreground">{panelTicker}</p>
            {panelName ? (
              <p className="text-[11px] leading-relaxed text-muted-foreground line-clamp-2">{panelName}</p>
            ) : null}
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="shrink-0 rounded-lg border border-border bg-card/50 p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
            aria-label="閉じる"
          >
            <X size={20} />
          </button>
        </div>

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-2 rounded-md border-2 px-3 py-2 text-sm font-bold shadow-sm",
                  expectationCategoryBadgeClass(effectiveCategory),
                )}
                title={template.labelJa}
              >
                <span className="text-lg leading-none" aria-hidden>
                  {template.icon}
                </span>
                <span className="flex flex-col leading-tight">
                  <span>{template.labelJa}</span>
                  <span className="text-[9px] font-mono font-normal opacity-80">{effectiveCategory}</span>
                </span>
                <span className="text-[10px] font-bold opacity-90">
                  ({expectationCategoryBadgeShortJa(effectiveCategory)})
                </span>
              </span>
            </div>
            {computedLynch == null ? (
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-stone-700 dark:text-stone-300" htmlFor="story-modal-lens-select">
                  分析レンズ（自動分類なしのとき）
                </label>
                <select
                  id="story-modal-lens-select"
                  disabled={saving}
                  value={manualLens}
                  onChange={(e) => {
                    setManualLens(e.target.value as LynchCategory);
                    setSelectedDrivers([]);
                  }}
                  className="max-w-xs rounded-md border border-stone-400/80 bg-white px-2 py-1.5 text-[11px] text-stone-900 dark:border-stone-600 dark:bg-stone-950 dark:text-stone-100"
                >
                  {LYNCH_CATEGORY_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {LYNCH_CATEGORY_LABEL_JA[k]}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] leading-relaxed text-amber-900/90 dark:text-amber-200/85">
                  指標から分類が付かない銘柄は、ここでテンプレを選んでリンチ分析を記入できます。チェック・診断選択は保存時に DB に同梱されます。
                </p>
              </div>
            ) : (
              <p className="text-[10px] leading-relaxed text-stone-600 dark:text-stone-400">
                レンズは自動分類に一致しています。
              </p>
            )}
          </div>

          {panelNextEarningsDate ? (
            <p className="text-[10px] text-stone-600 dark:text-stone-400">
              次回決算: {panelNextEarningsDate}
              {panelDaysToEarnings != null ? `（あと ${panelDaysToEarnings} 日）` : ""}
            </p>
          ) : (
            <p className="text-[10px] text-stone-600 dark:text-stone-400">次回決算日: 未取得</p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap gap-1 border-b border-border p-2" role="tablist" aria-label="ストーリーパネルの区分">
          <button
            type="button"
            role="tab"
            aria-selected={mainTab === "basic"}
            disabled={saving}
            onClick={() => setMainTab("basic")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors disabled:opacity-40",
              mainTab === "basic"
                ? "bg-muted text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            基本分析
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mainTab === "lynch"}
            disabled={saving}
            onClick={() => setMainTab("lynch")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors disabled:opacity-40",
              mainTab === "lynch"
                ? "bg-muted text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            リンチ分析
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4 sm:py-4">
          {saveErr ? <p className="mb-2 text-[11px] font-bold text-destructive">{saveErr}</p> : null}

          {mainTab === "basic" ? (
            <div className="flex flex-col gap-5">
              <section className={cn("p-3", sectionFrame)}>
                <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  銘柄メモ（{variant === "themeMember" ? "theme_ecosystem_members.memo" : "holdings.memo"}）
                </h3>
                <HoldingOrEcosystemMemoTextarea
                  id="story-modal-holding-memo"
                  value={memoDraft}
                  onChange={setMemoDraft}
                  disabled={saving}
                  rows={8}
                  className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-50"
                  placeholder="観測メモ・箇条書きなど"
                />
              </section>

              <section className={cn("p-3", sectionFrame)}>
                <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                  決算要約（
                  {variant === "themeMember" ? "theme_ecosystem_members.earnings_summary_note" : "earnings_summary_note"}）
                </h3>
                <div className="mb-2 inline-flex gap-1 rounded-md border border-stone-300/60 p-0.5 dark:border-stone-700" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={earningsSubTab === "edit"}
                    disabled={saving}
                    onClick={() => setEarningsSubTab("edit")}
                    className={cn(
                      "rounded px-2 py-1 text-[10px] font-bold uppercase disabled:opacity-40",
                      earningsSubTab === "edit" ? "bg-white text-stone-900 shadow-sm dark:bg-stone-800 dark:text-stone-100" : "",
                    )}
                  >
                    編集
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={earningsSubTab === "preview"}
                    disabled={saving}
                    onClick={() => setEarningsSubTab("preview")}
                    className={cn(
                      "rounded px-2 py-1 text-[10px] font-bold uppercase disabled:opacity-40",
                      earningsSubTab === "preview" ? "bg-white text-stone-900 shadow-sm dark:bg-stone-800 dark:text-stone-100" : "",
                    )}
                  >
                    プレビュー
                  </button>
                </div>
                {earningsSubTab === "edit" ? (
                  <EarningsSummaryNoteTextarea
                    id="story-modal-earnings-note"
                    value={earningsDraft}
                    onChange={setEarningsDraft}
                    disabled={saving}
                    rows={10}
                    className="w-full resize-y rounded-md border border-stone-300/80 bg-white/90 px-3 py-2 text-sm text-stone-900 placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-teal-700/30 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100"
                    placeholder="Markdown 可（見出し・リスト・表など）。空にして保存で削除。"
                  />
                ) : (
                  <div className="max-h-[min(40vh,18rem)] overflow-y-auto overscroll-contain rounded-md border border-stone-300/80 bg-white/95 px-3 py-2 dark:border-stone-700 dark:bg-stone-950">
                    <p className="mb-2 text-[10px] text-stone-600 dark:text-stone-400">未保存の編集も反映して表示します。</p>
                    <EarningsNoteMarkdownPreview markdown={earningsDraft} />
                  </div>
                )}
              </section>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {computedLynch == null ? (
                <>
                  <section
                    className={cn(
                      "rounded-md border border-violet-500/25 bg-violet-50/80 p-3 dark:bg-violet-950/25 dark:border-violet-600/30",
                      sectionFrame,
                    )}
                  >
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-violet-900 dark:text-violet-200">
                      診断モード（自動分類なし）
                    </p>
                    <fieldset className="space-y-2">
                      <legend className="mb-2 text-[11px] font-bold text-stone-800 dark:text-stone-200">
                        鑑定チェックリスト · 成長の質
                      </legend>
                      <label className="flex cursor-pointer items-start gap-2 text-[11px] text-stone-700 dark:text-stone-300">
                        <input
                          type="radio"
                          name="story-growth-quality"
                          className="mt-0.5"
                          checked={growthQualityAnswer === ""}
                          disabled={saving}
                          onChange={() => setGrowthQualityAnswer("")}
                        />
                        <span>まだ選ばない（リセット）</span>
                      </label>
                      {GROWTH_QUALITY_OPTIONS.map((opt) => (
                        <label
                          key={opt.id}
                          className="flex cursor-pointer items-start gap-2 text-[11px] text-stone-700 dark:text-stone-300"
                        >
                          <input
                            type="radio"
                            name="story-growth-quality"
                            className="mt-0.5"
                            checked={growthQualityAnswer === opt.id}
                            disabled={saving}
                            onChange={() => setGrowthQualityAnswer(opt.id)}
                          />
                          <span>
                            <span className="font-semibold text-stone-900 dark:text-stone-100">{opt.label}</span>
                            <span className="block text-[10px] text-stone-600 dark:text-stone-400">{opt.hint}</span>
                          </span>
                        </label>
                      ))}
                    </fieldset>
                    {suggestedFromDiagnostic != null ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-violet-400/25 pt-3 dark:border-violet-700/30">
                        <span className="text-[11px] text-stone-700 dark:text-stone-300">
                          おすすめレンズ:{" "}
                          <strong className="text-stone-900 dark:text-stone-100">
                            {LYNCH_CATEGORY_LABEL_JA[suggestedFromDiagnostic]}
                          </strong>
                          <span className="ml-1 font-mono text-[10px] opacity-80">({suggestedFromDiagnostic})</span>
                        </span>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => {
                            setManualLens(suggestedFromDiagnostic);
                            setSelectedDrivers([]);
                          }}
                          className="rounded-md border border-violet-600/50 bg-violet-600/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white hover:opacity-95 disabled:opacity-40 dark:bg-violet-700 dark:border-violet-500/50"
                        >
                          このレンズを適用
                        </button>
                      </div>
                    ) : (
                      <p className="mt-2 text-[10px] text-stone-600 dark:text-stone-400">
                        上から 1 つ選ぶと、おすすめのリンチ分類が表示されます。
                      </p>
                    )}
                  </section>

                  <section className={cn("p-3", sectionFrame)}>
                    <h3 className="mb-2 text-[11px] font-bold text-stone-800 dark:text-stone-200">
                      汎用 5 大要因（パトロール・監視の起点）
                    </h3>
                    <p className="mb-2 text-[10px] leading-relaxed text-stone-600 dark:text-stone-400">
                      分類に共通する利益向上のレバー。複数選択可（将来 monitoring_log と連携予定）。
                    </p>
                    <div className="flex flex-wrap gap-2" role="group" aria-label="汎用5大要因">
                      {UNIVERSAL_FIVE_PATCHES.map(({ id, label }) => {
                        const on = universalPatches.includes(id);
                        return (
                          <button
                            key={id}
                            type="button"
                            disabled={saving}
                            aria-pressed={on}
                            onClick={() => toggleUniversalPatch(id)}
                            className={cn(
                              "rounded-full border px-2.5 py-1 text-[10px] font-bold transition-colors disabled:opacity-40",
                              on
                                ? "border-teal-600 bg-teal-700/90 text-white dark:bg-teal-800 dark:border-teal-500"
                                : "border-stone-400/70 bg-white/80 text-stone-800 hover:bg-stone-100 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-200 dark:hover:bg-stone-800",
                            )}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                </>
              ) : null}

              <section className={cn("p-3", sectionFrame)}>
                <h3 className="mb-2 text-[11px] font-bold text-stone-800 dark:text-stone-200">入力の手がかり</h3>
                <ul className="list-disc space-y-1 pl-4 text-[11px] leading-relaxed text-stone-700 dark:text-stone-300">
                  {template.inputHints.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              </section>

              <section className={cn("p-3", sectionFrame)}>
                <h3 className="mb-2 text-[11px] font-bold text-stone-800 dark:text-stone-200">主な収益向上要因</h3>
                <div className="flex flex-col gap-2">
                  {template.drivers.map((d) => (
                    <label
                      key={d}
                      className="flex cursor-pointer items-center gap-2 text-[12px] text-stone-800 dark:text-stone-200"
                    >
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-stone-500 text-teal-800 focus:ring-teal-700/40"
                        checked={selectedDrivers.includes(d)}
                        disabled={saving}
                        onChange={() => toggleDriver(d)}
                      />
                      <span>{d}</span>
                    </label>
                  ))}
                </div>
                <label className="mt-3 block text-[10px] font-bold text-stone-700 dark:text-stone-300" htmlFor="story-drivers-narrative">
                  分析メモ（チェックに加えて記述）
                </label>
                <textarea
                  id="story-drivers-narrative"
                  value={driversNarrative}
                  onChange={(e) => setDriversNarrative(e.target.value)}
                  disabled={saving}
                  rows={4}
                  placeholder="ドライバーごとの根拠・補足・数字など"
                  className="mt-1 w-full resize-y rounded-md border border-stone-300/80 bg-white/90 px-3 py-2 text-[12px] leading-relaxed text-stone-900 placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-teal-700/30 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100"
                />
              </section>

              <section className={cn("p-3", sectionFrame)}>
                <h3 className="mb-2 text-[11px] font-bold text-stone-800 dark:text-stone-200">2 分間の物語</h3>
                <textarea
                  value={storyText}
                  onChange={(e) => setStoryText(e.target.value)}
                  disabled={saving}
                  rows={7}
                  placeholder={storyPlaceholder}
                  className="w-full resize-y rounded-md border border-stone-300/80 bg-white/90 px-3 py-2 text-[13px] leading-relaxed text-stone-900 placeholder:text-stone-500/90 focus:outline-none focus:ring-2 focus:ring-teal-700/30 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100"
                />
                {computedLynch == null ? (
                  <p className="mt-1 text-[9px] leading-snug text-stone-600 dark:text-stone-400">
                    プレースホルダは診断・汎用要因の選択に応じて切り替わります（90秒ルールの視点）。
                  </p>
                ) : null}
              </section>

              <section className={cn("rounded-md border border-amber-800/25 bg-amber-100/50 p-3 dark:bg-amber-950/30", sectionFrame)}>
                <h3 className="mb-1 text-[11px] font-bold text-amber-950 dark:text-amber-100">監視の急所</h3>
                <p className="text-[12px] leading-relaxed text-amber-950/95 dark:text-amber-50/90">{template.monitoringJa}</p>
              </section>
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-border bg-muted/10 px-4 py-3 sm:px-5">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
          >
            キャンセル
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="inline-flex items-center gap-1.5 rounded-md border border-cyan-500/40 bg-cyan-600/90 px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-white transition-opacity hover:opacity-95 disabled:opacity-40 dark:bg-cyan-700/90"
          >
            <BookOpen className="h-3.5 w-3.5" aria-hidden />
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
    </aside>
  );
}
