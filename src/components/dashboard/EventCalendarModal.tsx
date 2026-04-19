"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CalendarDays, X } from "lucide-react";

import { cn } from "@/src/lib/cn";
import type { MarketEventRecord } from "@/src/types/market-events";

function utcTodayYmd(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function ymdAddDaysUtc(ymd: string, deltaDays: number): string {
  const base = ymd.length >= 10 ? ymd.slice(0, 10) : utcTodayYmd();
  const d = new Date(`${base}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Math.trunc(deltaDays));
  return formatUtcYmd(d);
}

/** Monday .. Sunday (UTC) containing `ymd`. */
function isoWeekRangeUtcContaining(ymd: string): { start: string; end: string } {
  const base = ymd.length >= 10 ? ymd.slice(0, 10) : utcTodayYmd();
  const d = new Date(`${base}T12:00:00Z`);
  const dow = d.getUTCDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + mondayOffset);
  const start = formatUtcYmd(d);
  d.setUTCDate(d.getUTCDate() + 6);
  const end = formatUtcYmd(d);
  return { start, end };
}

function formatUtcYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function categoryBadgeClass(category: string): string {
  const c = category.trim();
  if (c === "Macro") return "border-sky-500/35 bg-sky-500/10 text-sky-300";
  if (c === "Earnings") return "border-violet-500/35 bg-violet-500/10 text-violet-200";
  if (c === "Dividend") return "border-fuchsia-500/35 bg-fuchsia-500/10 text-fuchsia-200";
  if (c === "CentralBank") return "border-emerald-500/35 bg-emerald-500/10 text-emerald-200";
  if (c === "Geopolitics") return "border-amber-500/40 bg-amber-500/10 text-amber-200";
  return "border-border bg-muted/40 text-muted-foreground";
}

function formatWeekLabel(start: string, end: string): string {
  return `${start.replace(/-/g, "/")} 〜 ${end.replace(/-/g, "/")}（UTC 週）`;
}

const MODAL_SAFE_PADDING: React.CSSProperties = {
  paddingTop: "max(12px, env(safe-area-inset-top, 0px))",
  paddingRight: "max(12px, env(safe-area-inset-right, 0px))",
  paddingBottom: "max(12px, env(safe-area-inset-bottom, 0px))",
  paddingLeft: "max(12px, env(safe-area-inset-left, 0px))",
};

export function EventCalendarModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [events, setEvents] = useState<MarketEventRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchErr, setFetchErr] = useState<string | null>(null);

  const today = useMemo(() => utcTodayYmd(), []);
  const week = useMemo(() => isoWeekRangeUtcContaining(today), [today]);
  const dateWindow = useMemo(
    () => ({ start: ymdAddDaysUtc(today, -5), end: ymdAddDaysUtc(today, 70) }),
    [today],
  );

  type DashboardStockLite = {
    ticker?: unknown;
    name?: unknown;
    nextEarningsDate?: unknown;
    exDividendDate?: unknown;
  };

  const load = useCallback(async () => {
    setLoading(true);
    setFetchErr(null);
    try {
      const [resEvents, resDash] = await Promise.all([
        fetch("/api/events", { cache: "no-store" }),
        fetch("/api/dashboard", { cache: "no-store" }),
      ]);

      const eventsJson = (await resEvents.json()) as { events?: MarketEventRecord[]; error?: string };
      const dashJson = (await resDash.json()) as { stocks?: unknown[]; error?: string };

      if (!resEvents.ok) {
        setFetchErr(eventsJson.error ?? `HTTP ${resEvents.status}`);
        setEvents([]);
        return;
      }

      const marketEvents = Array.isArray(eventsJson.events) ? eventsJson.events : [];

      const stocksRaw = Array.isArray(dashJson.stocks) ? (dashJson.stocks as DashboardStockLite[]) : [];
      const holdingEvents: MarketEventRecord[] = [];
      for (const s of stocksRaw) {
        const ticker = s.ticker != null ? String(s.ticker).trim() : "";
        if (!ticker) continue;
        const name = s.name != null ? String(s.name).trim() : "";

        const eYmd = s.nextEarningsDate != null ? String(s.nextEarningsDate).trim().slice(0, 10) : "";
        if (eYmd.length === 10 && eYmd >= dateWindow.start && eYmd <= dateWindow.end) {
          holdingEvents.push({
            id: `holding:${ticker}:earnings:${eYmd}`,
            event_date: `${eYmd}T00:00:00.000Z`,
            title: `${ticker} 決算`,
            category: "Earnings",
            importance: 3,
            description: name.length > 0 ? name : null,
          });
        }

        const xYmd = s.exDividendDate != null ? String(s.exDividendDate).trim().slice(0, 10) : "";
        if (xYmd.length === 10 && xYmd >= dateWindow.start && xYmd <= dateWindow.end) {
          holdingEvents.push({
            id: `holding:${ticker}:exdiv:${xYmd}`,
            event_date: `${xYmd}T00:00:00.000Z`,
            title: `${ticker} 配当（権利落ち）`,
            category: "Dividend",
            importance: 2,
            description: name.length > 0 ? name : null,
          });
        }
      }

      const merged = new Map<string, MarketEventRecord>();
      for (const e of marketEvents) merged.set(e.id, e);
      for (const e of holdingEvents) merged.set(e.id, e);

      setEvents([...merged.values()]);
    } catch (e) {
      setFetchErr(e instanceof Error ? e.message : "読み込みに失敗しました");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [dateWindow.end, dateWindow.start]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const { thisWeek, other } = useMemo(() => {
    const tw: MarketEventRecord[] = [];
    const ot: MarketEventRecord[] = [];
    for (const e of events) {
      const d = e.event_date.slice(0, 10);
      if (d >= week.start && d <= week.end) tw.push(e);
      else ot.push(e);
    }
    const sortEv = (a: MarketEventRecord, b: MarketEventRecord) =>
      a.event_date.localeCompare(b.event_date) || b.importance - a.importance;
    tw.sort(sortEv);
    ot.sort(sortEv);
    return { thisWeek: tw, other: ot };
  }, [events, week.start, week.end]);

  if (!open) return null;

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={MODAL_SAFE_PADDING}
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-background/80 backdrop-blur-[2px]"
        aria-label="カレンダーを閉じる"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="koyomi-title"
        className="relative z-10 flex max-h-[min(90dvh,56rem)] w-[min(100%,90vw)] max-w-4xl min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="min-w-0 space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Patrol · 先読み</p>
            <h2 id="koyomi-title" className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
              市場の暦 (Koyomi) - 潮目の先読み
            </h2>
            <p className="text-xs leading-relaxed text-muted-foreground sm:text-[13px]">
              10分パトロールの最初に、今週のイベントでボラとフローを想像する。
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground touch-manipulation"
            aria-label="閉じる"
          >
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 text-sm sm:px-6 sm:py-5 sm:text-base [-webkit-overflow-scrolling:touch]">
          {loading ? (
            <p className="text-muted-foreground">読み込み中…</p>
          ) : fetchErr ? (
            <p className="text-sm text-destructive">{fetchErr}</p>
          ) : events.length === 0 ? (
            <p className="text-sm text-muted-foreground leading-relaxed">
              イベントがまだありません。管理者は{" "}
              <span className="font-mono text-xs">migrations/023_market_events.sql</span> を適用してください。
            </p>
          ) : (
            <div className="space-y-6">
              <section aria-labelledby="koyomi-week-heading">
                <div className="flex items-center gap-2 mb-2">
                  <CalendarDays className="h-4 w-4 text-accent-cyan shrink-0" aria-hidden />
                  <h3 id="koyomi-week-heading" className="text-xs font-bold uppercase tracking-wider text-foreground">
                    今週
                  </h3>
                </div>
                <p className="text-[10px] font-mono text-muted-foreground mb-3">{formatWeekLabel(week.start, week.end)}</p>
                {thisWeek.length === 0 ? (
                  <p className="text-xs text-muted-foreground border border-dashed border-border rounded-lg px-3 py-2">
                    今週の掲載イベントはありません（掲載範囲外の日付の可能性があります）。
                  </p>
                ) : (
                  <ul className="space-y-2 border-l-2 border-accent-cyan/40 pl-3 ml-1">
                    {thisWeek.map((e) => (
                      <EventRow key={e.id} e={e} />
                    ))}
                  </ul>
                )}
              </section>

              <section aria-labelledby="koyomi-ahead-heading">
                <h3 id="koyomi-ahead-heading" className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  前後の潮目（同じ掲載ウィンドウ内）
                </h3>
                {other.length === 0 ? (
                  <p className="text-xs text-muted-foreground">今週以外の予定はありません。</p>
                ) : (
                  <ul className="space-y-2">
                    {other.map((e) => (
                      <EventRow key={e.id} e={e} />
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function EventRow({ e }: { e: MarketEventRecord }) {
  const hi = e.importance >= 3;
  const d = e.event_date.slice(0, 10);
  return (
    <li
      className={cn(
        "rounded-lg border px-3 py-2.5 transition-colors",
        hi ? "border-rose-500/40 bg-rose-500/5" : "border-border bg-card/50",
      )}
    >
      <div className="flex flex-wrap items-center gap-2 gap-y-1">
        <time dateTime={d} className={cn("font-mono text-[11px] tabular-nums shrink-0", hi ? "text-rose-200 font-bold" : "text-muted-foreground")}>
          {d}
        </time>
        <span
          className={cn(
            "inline-flex items-center rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
            categoryBadgeClass(e.category),
          )}
        >
          {e.category}
        </span>
        {hi ? (
          <span className="inline-flex items-center gap-0.5 text-rose-400" title="高重要度">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="text-[9px] font-bold uppercase">High</span>
          </span>
        ) : e.importance === 2 ? (
          <span className="text-[9px] font-semibold text-muted-foreground uppercase">Med</span>
        ) : (
          <span className="text-[9px] text-muted-foreground/80 uppercase">Low</span>
        )}
      </div>
      <p className={cn("mt-1 text-sm leading-snug", hi ? "font-bold text-foreground" : "text-foreground/90")}>{e.title}</p>
      {e.description ? (
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{e.description}</p>
      ) : null}
    </li>
  );
}
