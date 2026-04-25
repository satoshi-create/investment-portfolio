"use client";

import React, { useLayoutEffect, useMemo, useRef } from "react";
import { AlertTriangle, Loader2, Orbit, Radio, RefreshCw } from "lucide-react";

import { ymdAddDays, type EarningsQualityKind } from "@/src/lib/alpha-logic";
import { cn } from "@/src/lib/cn";
import type { KoyomiLaneItem, KoyomiLaneResponse, KoyomiThemeLane } from "@/src/types/koyomi";

function labelForQuality(k: EarningsQualityKind): string {
  switch (k) {
    case "UPCOMING":
      return "予定";
    case "INSUFFICIENT_DATA":
      return "要データ";
    case "STRONG_POSITIVE":
      return "強 +";
    case "CONFIRMED_OK":
      return "前向";
    case "SELL_THE_NEWS":
      return "材料売";
    case "CLASSIC_NEGATIVE":
      return "悪化";
    case "RELIEF_RALLY":
      return "戻";
    case "MIXED":
      return "交錯";
    default:
      return "—";
  }
}

function qualityChipClass(k: EarningsQualityKind, hasOutcome: boolean): string {
  if (!hasOutcome) return "border-border/70 bg-muted/30 text-muted-foreground";
  switch (k) {
    case "STRONG_POSITIVE":
    case "CONFIRMED_OK":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
    case "SELL_THE_NEWS":
    case "CLASSIC_NEGATIVE":
      return "border-rose-500/45 bg-rose-500/12 text-rose-100";
    case "RELIEF_RALLY":
      return "border-amber-500/40 bg-amber-500/10 text-amber-100";
    case "INSUFFICIENT_DATA":
    case "MIXED":
      return "border-border bg-muted/25 text-foreground/85";
    default:
      return "border-border/70 bg-muted/30 text-muted-foreground";
  }
}

function enumerateYmdIncl(startYmd: string, endYmd: string): string[] {
  const s = startYmd.slice(0, 10);
  const e = endYmd.slice(0, 10);
  if (s.length !== 10 || e.length !== 10) return [];
  const out: string[] = [];
  let cur = s;
  let guard = 0;
  while (cur <= e && guard++ < 400) {
    out.push(cur);
    if (cur === e) break;
    cur = ymdAddDays(cur, 1);
  }
  return out;
}

function itemsByYmdKey(lane: KoyomiThemeLane): Map<string, KoyomiLaneItem[]> {
  const m = new Map<string, KoyomiLaneItem[]>();
  for (const it of lane.items) {
    if (!m.has(it.ymd)) m.set(it.ymd, []);
    m.get(it.ymd)!.push(it);
  }
  for (const arr of m.values()) {
    arr.sort((a, b) => a.displayTicker.localeCompare(b.displayTicker, "en"));
  }
  return m;
}

function KoyomiLaneHeader({
  onForceRefresh,
  forceRefreshing,
  canRefresh,
}: {
  onForceRefresh?: () => void;
  forceRefreshing: boolean;
  canRefresh: boolean;
}) {
  if (!canRefresh) return null;
  return (
    <div className="flex shrink-0 items-center justify-end gap-2">
      <button
        type="button"
        onClick={() => onForceRefresh?.()}
        disabled={forceRefreshing}
        title="Yahoo から次回決算日・R40 等を強制再取得"
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/30 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-60"
        aria-label="テーマ暦を強制更新"
      >
        {forceRefreshing ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <RefreshCw className="h-4 w-4" aria-hidden />
        )}
      </button>
    </div>
  );
}

const STICKY_HEADER_CLASS =
  "sticky top-0 z-30 border-b border-border/50 bg-card/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/90";
const STICKY_CORNER_CLASS =
  "sticky left-0 z-40 border-r border-border/50 bg-card shadow-[2px_0_8px_-2px_rgba(0,0,0,0.2)]";
const STICKY_LABEL_COL_CLASS =
  "sticky left-0 z-20 border-r border-border/50 bg-card/95 shadow-[2px_0_8px_-2px_rgba(0,0,0,0.12)] backdrop-blur supports-[backdrop-filter]:bg-card/90";

type KoyomiLaneProps = {
  data: KoyomiLaneResponse | null;
  loading: boolean;
  error: string | null;
  /** 手動再取得中（Yahoo フル・force）。レーン上に重ねて表示 */
  forceRefreshing?: boolean;
  onForceRefresh?: () => void;
  className?: string;
  /** テーマ列の固定幅 */
  labelColClass?: string;
  /** デスクトップ向けに日次セルと文字を大きくする */
  density?: "default" | "comfortable";
};

/**
 * 構造投資テーマ = 1 行のスイムレーン。横軸は UTC 暦日（Koyomi API と同じ `startYmd`…`endYmd`）。
 */
export function KoyomiLane({
  data,
  loading,
  error,
  forceRefreshing = false,
  onForceRefresh,
  className,
  labelColClass = "w-[7.5rem] sm:w-40 lg:w-48",
  /** Tactical view: チップと日付列を大きくし、ラベルをホバーなしで読める */
  density = "comfortable",
}: KoyomiLaneProps) {
  const isComfort = density === "comfortable";
  const days = useMemo(
    () => (data != null ? enumerateYmdIncl(data.startYmd, data.endYmd) : []),
    [data],
  );
  /** タクティカル・ウィンドウ（〜3 週）は列数が少ないのでセルを広げて可読性を上げる */
  const tacticalZoom = days.length > 0 && days.length <= 24;

  /** 日付列はチップ最大幅以上にし、はみ出しはセル内スクロールで隣列と重ねない */
  const dayColClass = isComfort
    ? tacticalZoom
      ? "box-border min-w-[13rem] w-[13rem] shrink-0 p-2 sm:min-w-[13.5rem] sm:w-[13.5rem] sm:p-2.5 lg:min-w-[14rem] lg:w-[14rem]"
      : "box-border min-w-[12.5rem] w-[12.5rem] shrink-0 p-2 sm:min-w-[13rem] sm:w-[13rem] sm:p-2.5 lg:min-w-[13.5rem] lg:w-[13.5rem]"
    : tacticalZoom
      ? "box-border min-w-[7rem] w-[7rem] sm:min-w-[7.75rem] sm:w-[7.75rem] shrink-0 p-1.5"
      : "box-border min-w-[5.5rem] w-[5.5rem] sm:min-w-[6.25rem] sm:w-[6.25rem] shrink-0 p-1";
  const dayHeaderClass = isComfort
    ? tacticalZoom
      ? "box-border min-w-[13rem] w-[13rem] shrink-0 text-center whitespace-nowrap font-mono tabular-nums text-[11px] sm:min-w-[13.5rem] sm:w-[13.5rem] sm:text-xs py-2 sm:py-2.5 lg:min-w-[14rem] lg:w-[14rem] border-r border-border/30"
      : "box-border min-w-[12.5rem] w-[12.5rem] shrink-0 text-center whitespace-nowrap font-mono tabular-nums text-[11px] sm:min-w-[13rem] sm:w-[13rem] sm:text-xs py-2 sm:py-2.5 lg:min-w-[13.5rem] lg:w-[13.5rem] border-r border-border/30"
    : tacticalZoom
      ? "box-border min-w-[7rem] w-[7rem] sm:min-w-[7.75rem] sm:w-[7.75rem] shrink-0 text-center whitespace-nowrap font-mono tabular-nums text-[11px] sm:text-[12px] py-2 border-r border-border/30"
      : "box-border min-w-[5.5rem] w-[5.5rem] sm:min-w-[6.25rem] sm:w-[6.25rem] shrink-0 text-center whitespace-nowrap font-mono tabular-nums text-[10px] sm:text-[11px] py-1.5 border-r border-border/30";

  const laneScrollRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (data == null || days.length === 0) return;
    const idx = days.indexOf(data.todayYmd);
    if (idx < 0) return;
    const root = laneScrollRef.current;
    const el = root?.querySelector(`[data-koyomi-day-col="${idx}"]`);
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    }
  }, [data, days]);

  if (loading) {
    return (
      <div className={cn("min-h-0 min-w-0 space-y-3", className)}>
        <KoyomiLaneHeader
          onForceRefresh={onForceRefresh}
          forceRefreshing={forceRefreshing}
          canRefresh={typeof onForceRefresh === "function"}
        />
        <div
          className="animate-pulse space-y-2 rounded-lg border border-border/50 bg-card/20 p-4"
          role="status"
          aria-label="テーマ暦のスケルトン"
        >
          <div className="h-3 w-40 rounded bg-muted" />
          <div className="h-32 rounded bg-muted/60" />
        </div>
        <p className="text-sm text-muted-foreground">テーマ暦を読み込み中…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className={cn("min-h-0 min-w-0 space-y-3", className)}>
        <KoyomiLaneHeader
          onForceRefresh={onForceRefresh}
          forceRefreshing={forceRefreshing}
          canRefresh={typeof onForceRefresh === "function"}
        />
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          データ取得に失敗しました。上の「更新」で再試行してください。
        </p>
      </div>
    );
  }
  if (data == null) {
    return (
      <div className={cn("min-h-0 min-w-0 space-y-3", className)}>
        <KoyomiLaneHeader
          onForceRefresh={onForceRefresh}
          forceRefreshing={forceRefreshing}
          canRefresh={typeof onForceRefresh === "function"}
        />
        <p className="text-sm text-muted-foreground" role="alert">
          データ取得に失敗しました。再試行してください。
        </p>
        {typeof onForceRefresh === "function" ? (
          <p className="text-xs text-muted-foreground">右上の更新アイコンで最新のファンダメンタルズを同期できます。</p>
        ) : null}
      </div>
    );
  }

  if (data.themeLanes.length === 0) {
    return (
      <div className={cn("min-h-0 min-w-0 space-y-3", className)}>
        <KoyomiLaneHeader
          onForceRefresh={onForceRefresh}
          forceRefreshing={forceRefreshing}
          canRefresh={typeof onForceRefresh === "function"}
        />
        {forceRefreshing ? (
          <p className="text-xs text-cyan-200/90 flex items-center gap-1.5" role="status">
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
            最新のファンダメンタルズを同期中…
          </p>
        ) : null}
        <p className="text-sm text-muted-foreground leading-relaxed">
          表示できるテーマウォッチの決算予定がありません（テーマ Ecosystem の銘柄に次回決算日を設定するか、掲載ウィンドウ内に予定を置いてください）。
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden",
        className,
      )}
    >
      <KoyomiLaneHeader
        onForceRefresh={onForceRefresh}
        forceRefreshing={forceRefreshing}
        canRefresh={typeof onForceRefresh === "function"}
      />
      {forceRefreshing ? (
        <p className="shrink-0 text-xs text-cyan-200/90 flex items-center gap-1.5" role="status">
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
          最新のファンダメンタルズを同期中…
        </p>
      ) : null}
      {data.outcomeTableMissing ? (
        <p className="shrink-0 flex items-start gap-2 text-xs text-amber-200/90 leading-relaxed border border-amber-500/30 rounded-lg px-3 py-2 bg-amber-500/5">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden />
          <span>
            <span className="font-semibold">ticker_earnings_outcomes 未作成</span>
            。驚き・価格反応は migration 053 適用後、手元または ETL で登録可能です。予定行のみ表示しています。
          </span>
        </p>
      ) : null}

      <p className="shrink-0 text-[10px] font-mono text-muted-foreground leading-relaxed">
        タクティカル掲載: {data.startYmd} … {data.endYmd}（前後 2 週間 · 今日 {data.todayYmd} UTC） · 決算品質は EPS/売上サプライズ + 価格反応。R40
        は Yahoo 四半期の売上成長% + FCF マージン%。筋肉は売上成長% + 営業利益率%の四半期比。Mispriced は筋肉改善かつ当日騰落率 ≤ -3%（Yahoo
        セッション%）。横スクロールは「今日」列を中央に近づけます。
      </p>

      <div
        ref={laneScrollRef}
        className={cn(
          "min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain [-webkit-overflow-scrolling:touch] rounded-lg border border-border/60 bg-card/20",
          forceRefreshing && "pointer-events-none opacity-60",
        )}
        role="region"
        aria-label="テーマ別決算スイムレーン"
        aria-busy={forceRefreshing}
      >
        <div
          className={cn(
            "inline-block w-max max-w-none align-top",
            isComfort ? "min-w-full" : "min-w-[min(100%,max(32rem,90vw))]",
          )}
        >
          {/* 日付ヘッダ: 同一スクロール内で sticky し、縦スクロールで見失わない */}
          <div
            className={cn(
              "flex min-h-[1.5rem] shrink-0",
              isComfort && "min-h-8 lg:min-h-9",
              STICKY_HEADER_CLASS,
            )}
          >
            <div className={cn("shrink-0", labelColClass, STICKY_CORNER_CLASS, "z-50")} aria-hidden />
            {days.map((d, dayIdx) => {
              const isToday = d === data.todayYmd;
              return (
                <div
                  key={d}
                  data-koyomi-day-col={dayIdx}
                  className={cn(
                    "shrink-0 flex items-center justify-center",
                    dayHeaderClass,
                    isToday ? "bg-cyan-500/20 text-cyan-200 font-bold" : "text-muted-foreground/80 bg-card/80",
                  )}
                >
                  {d.slice(5).replace("-", "/")}
                </div>
              );
            })}
          </div>

          {data.themeLanes.map((lane) => (
            <ThemeSwimRow
              key={lane.themeId}
              lane={lane}
              days={days}
              todayYmd={data.todayYmd}
              labelColClass={labelColClass}
              dayColClass={dayColClass}
              isComfortable={isComfort}
            />
          ))}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 text-[9px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Orbit className="h-3 w-3 text-rose-400" aria-hidden />
          爆心地（悪化の先行事件）
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-sm bg-rose-500/35 border border-rose-500/40" aria-hidden />
          負の重力（先行事件からの減衰）
        </span>
        <span className="inline-flex items-center gap-1">
          <Radio className="h-3 w-3 text-cyan-400" aria-hidden />
          本日
        </span>
        <span className="inline-flex items-center gap-1" title="売上成長 + 営業利益率の四半期比改善">
          <span aria-hidden>💪</span>
          筋肉 Delta 改善
        </span>
        <span className="inline-flex items-center gap-1" title="筋肉改善なのに当日 -3% 以上の下げ">
          <span className="inline-block w-2 h-2 rounded-sm border-2 border-amber-400/80" aria-hidden />
          Mispriced（連れ安）
        </span>
      </div>
    </div>
  );
}

function ThemeSwimRow({
  lane,
  days,
  todayYmd,
  labelColClass,
  dayColClass,
  isComfortable,
}: {
  lane: KoyomiThemeLane;
  days: string[];
  todayYmd: string;
  labelColClass: string;
  dayColClass: string;
  isComfortable: boolean;
}) {
  const byDay = useMemo(() => itemsByYmdKey(lane), [lane]);
  return (
    <div
      className={cn(
        "flex border-b border-border/40 last:border-b-0 min-h-[2.4rem] shrink-0",
        isComfortable && "min-h-[4.5rem] sm:min-h-20",
      )}
    >
      <div
        className={cn(
          "shrink-0 px-1.5 py-1.5 text-[10px] sm:text-[11px] font-semibold text-foreground/90 leading-tight flex items-start",
          isComfortable && "lg:px-2.5 lg:py-2.5 lg:text-xs",
          labelColClass,
          STICKY_LABEL_COL_CLASS,
        )}
        title={lane.themeName}
      >
        <span className="line-clamp-3">{lane.themeName}</span>
      </div>
      {days.map((d, dayIdx) => {
        const items = byDay.get(d) ?? [];
        const isToday = d === todayYmd;
        return (
          <div
            key={d}
            data-koyomi-day-col={dayIdx}
            className={cn(
              "border-r border-border/20 align-top isolate min-h-0 overflow-x-auto overflow-y-visible",
              dayColClass,
              isToday && "bg-cyan-500/8",
            )}
          >
            {items.length === 0 ? null : (
              <ul className="flex w-full min-w-0 flex-col gap-1.5">
                {items.map((it) => (
                  <LaneChip key={it.id} it={it} comfortable={isComfortable} />
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

function formatRuleOf40Display(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const rounded = Math.round(v * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function muscleDeltaOverlayStyle(it: KoyomiLaneItem): React.CSSProperties | undefined {
  const d = it.muscleDelta;
  if (d == null || !Number.isFinite(d)) return undefined;
  const mag = Math.min(1, Math.abs(d) / 12);
  if (it.muscleDeltaStatus === "positive") {
    return { backgroundColor: `rgba(22, 163, 74, ${0.35 + mag * 0.45})` };
  }
  if (it.muscleDeltaStatus === "negative") {
    return { backgroundColor: `rgba(244, 63, 94, ${0.18 + mag * 0.32})` };
  }
  return undefined;
}

function LaneChip({ it, comfortable }: { it: KoyomiLaneItem; comfortable: boolean }) {
  const taint = it.gravityTaint;
  const epic = it.isEpicenter;
  const r40Line = `R40 ${formatRuleOf40Display(it.ruleOf40Current)}`;
  const muscleLine = `筋 ${formatRuleOf40Display(it.muscleScoreCurrent)}`;
  const deltaOverlay = muscleDeltaOverlayStyle(it);
  const showFlex = it.muscleDeltaStatus === "positive";
  const dayChg = it.regularMarketChangePercent;

  return (
    <li
      className={cn(
        "box-border w-full max-w-full min-w-0 rounded-md border leading-snug transition-colors relative overflow-hidden flex flex-row flex-wrap items-center content-start gap-x-1.5 gap-y-0.5",
        comfortable ? "px-2 py-1.5 sm:px-2.5 sm:py-2" : "px-1 py-1",
        comfortable ? "text-[10px] sm:text-[11px]" : "text-[8px] sm:text-[9px]",
        qualityChipClass(it.qualityKind, it.hasOutcome),
        epic && "ring-2 ring-rose-400/70 shadow-[0_0_10px_rgba(244,63,94,0.35)]",
        it.isMispriced && "ring-2 ring-amber-400/90 ring-offset-0 shadow-[0_0_0_2px_rgba(251,191,36,0.45)]",
      )}
      title={`${it.displayTicker} · ${r40Line} · ${muscleLine} · 当日 ${dayChg != null ? `${dayChg > 0 ? "+" : ""}${formatRuleOf40Display(dayChg)}%` : "—"} · ${it.qualityKind}${taint > 0.02 ? ` · 負の波及 ${(taint * 100).toFixed(0)}%` : ""}`}
    >
      {deltaOverlay ? (
        <div className="pointer-events-none absolute inset-0 z-[1]" style={deltaOverlay} aria-hidden />
      ) : null}
      {taint > 0.02 ? (
        <div
          className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-r from-rose-600/0 via-rose-500/0 to-rose-500/25"
          style={{ opacity: Math.min(0.85, 0.25 + taint * 0.9) }}
          aria-hidden
        />
      ) : null}
      <span
        className={cn(
          "relative z-[3] max-w-full min-w-0 shrink-1 font-mono font-bold tracking-tight break-all",
          comfortable ? "text-xs sm:text-sm" : "text-[8px] sm:text-[9px]",
        )}
      >
        {it.displayTicker}
      </span>
      {showFlex ? (
        <span className="relative z-[3] shrink-0 text-sm sm:text-base leading-none" aria-hidden title="筋肉改善">
          💪
        </span>
      ) : null}
      <span
        className={cn(
          "relative z-[3] min-w-0 font-mono font-semibold tabular-nums text-foreground/95 break-words [overflow-wrap:anywhere]",
          comfortable ? "text-[11px] sm:text-xs" : "text-[8px] sm:text-[9px]",
        )}
      >
        {r40Line}
      </span>
      <span
        className={cn(
          "relative z-[3] min-w-0 font-mono font-semibold tabular-nums text-emerald-100/95 break-words [overflow-wrap:anywhere]",
          comfortable ? "text-[10px] sm:text-[11px]" : "text-[7px] sm:text-[8px]",
        )}
      >
        {muscleLine}
      </span>
      {dayChg != null && Number.isFinite(dayChg) ? (
        <span
          className={cn(
            "relative z-[3] min-w-0 font-mono font-semibold tabular-nums break-words [overflow-wrap:anywhere]",
            comfortable ? "text-[10px] sm:text-[11px]" : "text-[7px] sm:text-[8px]",
            dayChg <= -3 ? "text-amber-200/95" : dayChg >= 0 ? "text-emerald-100/90" : "text-muted-foreground/90",
          )}
        >
          当日 {dayChg > 0 ? "+" : ""}
          {formatRuleOf40Display(dayChg)}%
        </span>
      ) : null}
      <span
        className={cn(
          "relative z-[3] min-w-0 font-bold tabular-nums rounded px-0.5 break-words [overflow-wrap:anywhere]",
          comfortable ? "text-[9px] sm:text-[10px]" : "text-[6px] sm:text-[7px]",
          it.hasOutcome ? "bg-black/25 text-foreground/95" : "opacity-75",
        )}
      >
        {labelForQuality(it.qualityKind)}
      </span>
      {it.ruleOf40Delta != null && it.ruleOf40DeltaStatus !== "unknown" ? (
        <span
          className={cn(
            "relative z-[3] min-w-0 font-mono font-bold tabular-nums break-words [overflow-wrap:anywhere]",
            comfortable ? "text-[9px] sm:text-[10px]" : "text-[6px]",
            it.ruleOf40DeltaStatus === "positive" && "text-emerald-200/90",
            it.ruleOf40DeltaStatus === "negative" && "text-rose-100",
            it.ruleOf40DeltaStatus === "flat" && "text-muted-foreground",
          )}
        >
          RΔ{it.ruleOf40Delta > 0 ? "+" : ""}
          {formatRuleOf40Display(it.ruleOf40Delta)}
        </span>
      ) : null}
      {it.muscleDelta != null && it.muscleDeltaStatus !== "unknown" ? (
        <span
          className={cn(
            "relative z-[3] min-w-0 font-mono font-bold tabular-nums break-words [overflow-wrap:anywhere]",
            comfortable ? "text-[9px] sm:text-[10px]" : "text-[6px]",
            it.muscleDeltaStatus === "positive" && "text-emerald-100",
            it.muscleDeltaStatus === "negative" && "text-rose-100",
            it.muscleDeltaStatus === "flat" && "text-muted-foreground",
          )}
        >
          MΔ{it.muscleDelta > 0 ? "+" : ""}
          {formatRuleOf40Display(it.muscleDelta)}
        </span>
      ) : null}
      {epic ? (
        <span className={cn("relative z-[3] shrink-0 text-rose-200 font-bold", comfortable ? "text-[9px]" : "text-[6px]")}>
          震源
        </span>
      ) : null}
    </li>
  );
}
