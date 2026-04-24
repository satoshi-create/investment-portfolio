"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CalendarDays, X } from "lucide-react";

import { KoyomiLane } from "@/src/components/dashboard/KoyomiLane";
import { cn } from "@/src/lib/cn";
import type { KoyomiLaneResponse } from "@/src/types/koyomi";
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

type DashboardStockLite = {
  ticker?: unknown;
  name?: unknown;
  nextEarningsDate?: unknown;
  exDividendDate?: unknown;
};

/** `/api/events` の結果にダッシュボード保有の決算・配当を合成 */
function mergeEventsWithHoldings(
  normalizedApi: MarketEventRecord[],
  stocksRaw: DashboardStockLite[],
  dateWindow: { start: string; end: string },
): MarketEventRecord[] {
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
        source: "holding",
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
        source: "holding",
      });
    }
  }

  const merged = new Map<string, MarketEventRecord>();
  for (const e of normalizedApi) merged.set(e.id, e);
  for (const e of holdingEvents) merged.set(e.id, e);
  return [...merged.values()];
}

const MODAL_SAFE_PADDING: React.CSSProperties = {
  paddingTop: "max(12px, env(safe-area-inset-top, 0px))",
  paddingRight: "max(12px, env(safe-area-inset-right, 0px))",
  paddingBottom: "max(12px, env(safe-area-inset-bottom, 0px))",
  paddingLeft: "max(12px, env(safe-area-inset-left, 0px))",
};

/** Yahoo 混雑時でも UI が無限ローディングにならないよう上限 */
/** サーバー側で Yahoo 多段取得のため長めに（軽量プローブ後も残タスクに依存） */
const KOYOMI_FETCH_TIMEOUT_MS = 120_000;

/** テーマ暦: 同一ユーザーで 24h 以内は localStorage のスナップショットをそのまま表示し Yahoo を叩かない */
const KOYOMI_LANE_LS_KEY = "investment-portfolio:koyomi-lane:v1";
const KOYOMI_SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000;

type KoyomiLaneLsPayload = {
  at: number;
  userId: string;
  data: KoyomiLaneResponse;
};

function readKoyomiLaneSnapshot(uid: string): KoyomiLaneResponse | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KOYOMI_LANE_LS_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as Partial<KoyomiLaneLsPayload>;
    if (typeof o.at !== "number" || typeof o.userId !== "string" || o.data == null) return null;
    if (o.userId !== uid) return null;
    if (Date.now() - o.at > KOYOMI_SNAPSHOT_TTL_MS) return null;
    return o.data as KoyomiLaneResponse;
  } catch {
    return null;
  }
}

function writeKoyomiLaneSnapshot(uid: string, data: KoyomiLaneResponse): void {
  try {
    const payload: KoyomiLaneLsPayload = { at: Date.now(), userId: uid, data };
    localStorage.setItem(KOYOMI_LANE_LS_KEY, JSON.stringify(payload));
  } catch {
    /* 容量・プライベートブラウザ等 */
  }
}
/** `/api/events` はテーマウォッチの Yahoo が重い。`allSettled` の遅い片方で UI が止まるため上限 */
const EVENTS_FETCH_TIMEOUT_MS = 60_000;
/** `/api/dashboard` にも Abort を付けないとハング時に `loading` が永遠に true のままになり得る */
const DASHBOARD_FETCH_TIMEOUT_MS = 60_000;

type KoyomiTab = "owned" | "themes";

export function EventCalendarModal({
  open,
  onOpenChange,
  userId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}) {
  const [events, setEvents] = useState<MarketEventRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchErr, setFetchErr] = useState<string | null>(null);
  const [tab, setTab] = useState<KoyomiTab>("owned");
  const [koyomiLane, setKoyomiLane] = useState<KoyomiLaneResponse | null>(null);
  const [koyomiLoading, setKoyomiLoading] = useState(false);
  const [koyomiErr, setKoyomiErr] = useState<string | null>(null);
  /** テーマ暦 fetch の世代。クリーンアップで進め、遅れて帰ったレスポンスは無視する */
  const koyomiGen = useRef(0);
  /** `/api/events` のバックグラウンド強化フェッチをモーダル閉鎖時に無効化する */
  const eventsFetchGen = useRef(0);

  const today = useMemo(() => utcTodayYmd(), []);
  const week = useMemo(() => isoWeekRangeUtcContaining(today), [today]);
  const dateWindow = useMemo(
    () => ({ start: ymdAddDaysUtc(today, -5), end: ymdAddDaysUtc(today, 70) }),
    [today],
  );

  const load = useCallback(async () => {
    const myGen = ++eventsFetchGen.current;
    setLoading(true);
    setFetchErr(null);
    let stocksRawForBg: DashboardStockLite[] = [];
    try {
      const uid = userId.trim().length > 0 ? userId.trim() : "";
      const eventsLightUrl = `/api/events?userId=${encodeURIComponent(uid)}&watchResearch=0`;
      const eventsFullUrl = `/api/events?userId=${encodeURIComponent(uid)}`;
      const dashUrl = `/api/dashboard?userId=${encodeURIComponent(uid)}`;

      const [evSettled, dashSettled] = await Promise.allSettled([
        (async () => {
          const ac = new AbortController();
          const tid = window.setTimeout(() => ac.abort(), EVENTS_FETCH_TIMEOUT_MS);
          try {
            return await fetch(eventsLightUrl, { cache: "no-store", signal: ac.signal });
          } finally {
            window.clearTimeout(tid);
          }
        })(),
        (async () => {
          const ac = new AbortController();
          const tid = window.setTimeout(() => ac.abort(), DASHBOARD_FETCH_TIMEOUT_MS);
          try {
            return await fetch(dashUrl, { cache: "no-store", signal: ac.signal });
          } finally {
            window.clearTimeout(tid);
          }
        })(),
      ]);

      const errs: string[] = [];
      let normalizedApi: MarketEventRecord[] = [];

      if (evSettled.status === "fulfilled") {
        const resEvents = evSettled.value;
        try {
          const eventsJson = (await resEvents.json()) as { events?: MarketEventRecord[]; error?: string };
          if (!resEvents.ok) {
            errs.push(eventsJson.error ?? `イベント一覧 HTTP ${resEvents.status}`);
          } else {
            const apiEvents = Array.isArray(eventsJson.events) ? eventsJson.events : [];
            normalizedApi = apiEvents.map((e) => ({
              ...e,
              source: e.source ?? ("macro" as const),
            }));
          }
        } catch {
          errs.push("イベント API の応答を解析できませんでした");
        }
      } else {
        const reason = evSettled.reason;
        const aborted = reason instanceof DOMException && reason.name === "AbortError";
        errs.push(
          aborted
            ? "イベント・ウォッチ取得がタイムアウトしました（マクロ・ウォッチはこの回省略されます）。"
            : reason instanceof Error
              ? reason.message
              : "イベント一覧の取得に失敗しました",
        );
      }

      let stocksRaw: DashboardStockLite[] = [];
      if (dashSettled.status === "fulfilled") {
        const resDash = dashSettled.value;
        try {
          const dashJson = (await resDash.json()) as { stocks?: unknown[]; error?: string };
          if (!resDash.ok) {
            errs.push(dashJson.error ?? `ダッシュボード HTTP ${resDash.status}`);
          } else if (Array.isArray(dashJson.stocks)) {
            stocksRaw = dashJson.stocks as DashboardStockLite[];
          }
        } catch {
          errs.push("ダッシュボードの応答を解析できませんでした");
        }
      } else {
        const reason = dashSettled.reason;
        const aborted = reason instanceof DOMException && reason.name === "AbortError";
        errs.push(
          aborted
            ? "ダッシュボード取得がタイムアウトしました（保有の予定がこの回省略される場合があります）。"
            : reason instanceof Error
              ? reason.message
              : "ダッシュボードの取得に失敗しました",
        );
      }

      stocksRawForBg = stocksRaw;

      if (eventsFetchGen.current !== myGen) return;

      setEvents(mergeEventsWithHoldings(normalizedApi, stocksRaw, dateWindow));
      setFetchErr(errs.length > 0 ? errs.join(" ") : null);
    } catch (e) {
      setFetchErr(e instanceof Error ? e.message : "読み込みに失敗しました");
      setEvents([]);
    } finally {
      setLoading(false);
    }

    if (eventsFetchGen.current !== myGen) return;

    void (async () => {
      try {
        const ac = new AbortController();
        const tid = window.setTimeout(() => ac.abort(), EVENTS_FETCH_TIMEOUT_MS);
        let res: Response;
        try {
          const uid = userId.trim().length > 0 ? userId.trim() : "";
          res = await fetch(`/api/events?userId=${encodeURIComponent(uid)}`, {
            cache: "no-store",
            signal: ac.signal,
          });
        } finally {
          window.clearTimeout(tid);
        }
        if (eventsFetchGen.current !== myGen) return;
        const eventsJson = (await res.json()) as { events?: MarketEventRecord[]; error?: string };
        if (!res.ok) return;
        const apiEvents = Array.isArray(eventsJson.events) ? eventsJson.events : [];
        const normalizedFull = apiEvents.map((e) => ({
          ...e,
          source: e.source ?? ("macro" as const),
        }));
        if (eventsFetchGen.current !== myGen) return;
        setEvents(mergeEventsWithHoldings(normalizedFull, stocksRawForBg, dateWindow));
      } catch {
        /* バックグラウンド強化は失敗しても軽量版のまま */
      }
    })();
  }, [dateWindow.end, dateWindow.start, userId]);

  useEffect(() => {
    if (!open) {
      eventsFetchGen.current += 1;
      koyomiGen.current += 1;
      setKoyomiLane(null);
      setKoyomiErr(null);
      setKoyomiLoading(false);
      return;
    }
    void load();
  }, [open, load]);

  /**
   * テーマ暦は Yahoo が重いため **テーマ暦タブ時のみ**取得。
   * Abort + タイムアウトで無限ローディングを防ぎ、タブを外す／閉じると中断・再入場で再取得できる。
   */
  useEffect(() => {
    if (!open || tab !== "themes") return;

    const myGen = ++koyomiGen.current;
    const uid = userId.trim().length > 0 ? userId.trim() : "";

    const snap = readKoyomiLaneSnapshot(uid);
    if (snap != null) {
      setKoyomiLane(snap);
      setKoyomiErr(null);
      setKoyomiLoading(false);
      return;
    }

    const ac = new AbortController();

    const stale = () => myGen !== koyomiGen.current;

    setKoyomiLoading(true);
    setKoyomiErr(null);

    const baseKoyomi = `/api/koyomi-lane?userId=${encodeURIComponent(uid)}`;

    void (async () => {
      const parseLane = (raw: KoyomiLaneResponse & { error?: string }): KoyomiLaneResponse | null => {
        if ("error" in raw && typeof raw.error === "string" && raw.error.length > 0) return null;
        return {
          startYmd: raw.startYmd,
          endYmd: raw.endYmd,
          todayYmd: raw.todayYmd,
          themeLanes: Array.isArray(raw.themeLanes) ? raw.themeLanes : [],
          outcomeTableMissing: Boolean(raw.outcomeTableMissing),
        };
      };

      let gotQuick = false;
      try {
        const resMin = await fetch(`${baseKoyomi}&yahoo=minimal`, {
          cache: "no-store",
          signal: ac.signal,
        });
        if (!stale() && resMin.ok) {
          const json = (await resMin.json()) as KoyomiLaneResponse & { error?: string };
          const lane = parseLane(json);
          if (lane != null) {
            setKoyomiLane(lane);
            setKoyomiErr(null);
            gotQuick = true;
          }
        }
      } catch {
        /* minimal は省略可 */
      }

      if (!stale()) setKoyomiLoading(false);

      const abortMeta = { timedOut: false };
      const timeoutId = window.setTimeout(() => {
        abortMeta.timedOut = true;
        ac.abort();
      }, KOYOMI_FETCH_TIMEOUT_MS);

      try {
        const resFull = await fetch(`${baseKoyomi}&yahoo=full`, {
          cache: "no-store",
          signal: ac.signal,
        });
        if (ac.signal.aborted || stale()) return;

        const json = (await resFull.json()) as KoyomiLaneResponse & { error?: string };
        if (ac.signal.aborted || stale()) return;

        if (!resFull.ok) {
          if (!stale()) {
            if (!gotQuick) {
              setKoyomiErr(json.error ?? `HTTP ${resFull.status}`);
              setKoyomiLane(null);
            }
          }
          return;
        }
        if ("error" in json && typeof json.error === "string") {
          if (!stale()) {
            if (!gotQuick) {
              setKoyomiErr(json.error);
              setKoyomiLane(null);
            }
          }
          return;
        }
        const lane = parseLane(json);
        if (lane != null && !stale()) {
          setKoyomiLane(lane);
          writeKoyomiLaneSnapshot(uid, lane);
          setKoyomiErr(null);
        }
      } catch (e) {
        if (ac.signal.aborted) {
          if (abortMeta.timedOut && !stale() && !gotQuick) {
            setKoyomiErr("テーマ暦の取得がタイムアウトしました。しばらくしてから再度お試しください。");
            setKoyomiLane(null);
          }
          return;
        }
        if (!stale() && !gotQuick) {
          setKoyomiErr(e instanceof Error ? e.message : "読み込みに失敗しました");
          setKoyomiLane(null);
        }
      } finally {
        window.clearTimeout(timeoutId);
      }
    })();

    return () => {
      koyomiGen.current += 1;
      ac.abort();
      setKoyomiLoading(false);
    };
  }, [open, tab, userId]);

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

  const tabFiltered = useMemo(() => {
    if (tab === "themes") {
      return [] as MarketEventRecord[];
    }
    return events.filter(
      (e) =>
        e.source === "macro" ||
        e.source === "holding" ||
        e.source === "watchlist" ||
        e.source === undefined,
    );
  }, [events, tab]);

  const { thisWeek, other } = useMemo(() => {
    const tw: MarketEventRecord[] = [];
    const ot: MarketEventRecord[] = [];
    for (const e of tabFiltered) {
      const d = e.event_date.slice(0, 10);
      if (d >= week.start && d <= week.end) tw.push(e);
      else ot.push(e);
    }
    const sortEv = (a: MarketEventRecord, b: MarketEventRecord) =>
      a.event_date.localeCompare(b.event_date) || b.importance - a.importance;
    tw.sort(sortEv);
    ot.sort(sortEv);
    return { thisWeek: tw, other: ot };
  }, [tabFiltered, week.start, week.end]);

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
        className="relative z-10 flex w-[80vw] max-w-[80vw] min-w-0 min-h-0 max-h-[min(94dvh,56rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:max-h-[min(92dvh,80rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="min-w-0 space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Patrol · 先読み</p>
            <h2 id="koyomi-title" className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
              市場の暦 (Koyomi 2.0) - 潮目の先読み
            </h2>
            <p className="text-xs leading-relaxed text-muted-foreground sm:text-[13px]">
              10分パトロールの最初に、今週のイベントでボラとフローを想像する。テーマ暦は構造投資テーマの決算列と負の重力を俯瞰します。
            </p>
            <div
              className="flex flex-wrap gap-1.5 pt-1"
              role="tablist"
              aria-label="イベントの表示切替"
            >
              <button
                type="button"
                role="tab"
                aria-selected={tab === "owned"}
                onClick={() => setTab("owned")}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors",
                  tab === "owned"
                    ? "border-cyan-500/45 bg-cyan-500/15 text-cyan-100"
                    : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50",
                )}
              >
                Owned
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "themes"}
                onClick={() => setTab("themes")}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors",
                  tab === "themes"
                    ? "border-rose-500/40 bg-rose-500/8 text-rose-100"
                    : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50",
                )}
              >
                テーマ暦
              </button>
            </div>
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

        <div
          className={cn(
            "min-h-0 flex-1 px-4 py-4 text-sm sm:px-6 sm:py-5 sm:text-base",
            tab === "themes"
              ? "flex min-w-0 flex-col overflow-hidden"
              : "overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]",
          )}
        >
          {tab === "themes" ? (
            <KoyomiLane
              className="min-h-0 min-w-0 flex-1 flex flex-col"
              data={koyomiLane}
              loading={koyomiLoading}
              error={koyomiErr}
              labelColClass="w-[7.5rem] sm:w-40 lg:w-48"
              density="comfortable"
            />
          ) : loading ? (
            <p className="text-muted-foreground">読み込み中…</p>
          ) : (
            <div className="space-y-4">
              {fetchErr ? (
                <p
                  role="alert"
                  className="text-sm text-destructive border border-destructive/35 rounded-lg px-3 py-2 bg-destructive/5 leading-relaxed"
                >
                  {fetchErr}
                </p>
              ) : null}
              {tabFiltered.length === 0 ? (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {events.length === 0
                    ? "イベントがまだありません。管理者は migrations/023_market_events.sql を適用してください。"
                    : "このタブに表示するイベントはありません（マクロ・保有・テーマウォッチの予定がウィンドウ外の可能性があります）。"}
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
                    <h3
                      id="koyomi-ahead-heading"
                      className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2"
                    >
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
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function EventRow({ e }: { e: MarketEventRecord }) {
  const src = e.source ?? "macro";
  const hi = e.importance >= 3;
  const d = e.event_date.slice(0, 10);

  const shellClass =
    src === "holding"
      ? cn(
          "rounded-lg border px-3 py-2.5 transition-colors",
          hi
            ? "border-cyan-400/55 bg-cyan-500/12 shadow-[0_0_0_1px_rgba(34,211,238,0.12)]"
            : "border-cyan-500/35 bg-cyan-500/8",
        )
      : src === "watchlist"
        ? cn(
            "rounded-lg border px-3 py-2.5 transition-colors border-border/80 bg-muted/25 text-foreground/90",
            hi ? "border-violet-500/25 bg-violet-500/5" : "",
          )
        : cn(
            "rounded-lg border px-3 py-2.5 transition-colors",
            hi ? "border-rose-500/40 bg-rose-500/5" : "border-border bg-card/50",
          );

  return (
    <li className={shellClass}>
      <div className="flex flex-wrap items-center gap-2 gap-y-1">
        <time
          dateTime={d}
          className={cn(
            "font-mono text-[11px] tabular-nums shrink-0",
            hi && src !== "watchlist" ? "text-rose-200 font-bold" : "text-muted-foreground",
          )}
        >
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
        {src === "holding" ? (
          <span className="text-[9px] font-bold uppercase tracking-wide text-cyan-300/90">Owned</span>
        ) : src === "watchlist" ? (
          <span className="text-[9px] font-bold uppercase tracking-wide text-violet-300/80">Watch</span>
        ) : null}
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
      <p className={cn("mt-1 text-sm leading-snug", hi && src !== "watchlist" ? "font-bold text-foreground" : "text-foreground/90")}>
        {e.title}
      </p>
      {e.description ? (
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{e.description}</p>
      ) : null}
    </li>
  );
}
