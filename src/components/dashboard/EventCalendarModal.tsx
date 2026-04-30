"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CalendarDays, X } from "lucide-react";

import { KoyomiLane } from "@/src/components/dashboard/KoyomiLane";
import { cn } from "@/src/lib/cn";
import { isoWeekRangeJstContaining, jstTodayYmd, ymdAddDaysJst } from "@/src/lib/koyomi-week-jst";
import type { KoyomiLaneResponse } from "@/src/types/koyomi";
import type { MarketEventRecord } from "@/src/types/market-events";

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
  return `${start.replace(/-/g, "/")} 〜 ${end.replace(/-/g, "/")}（JST 週 · 月—日）`;
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

/**
 * テーマ暦スナップショット: v4 = 掲載週を JST 月—日（7 暦日）に統一。`readKoyomiLaneSnapshot` は
 * 窓外・TTL 切れのとき捨てる。1 日 1 回フル Yahoo 判定は {@link hasKoyomiFullYahooTodayJst} 側（別キー）。
 */
const KOYOMI_LANE_LS_KEY = "investment-portfolio:koyomi-lane:v4";
const KOYOMI_SNAPSHOT_TTL_MS = 6 * 60 * 60 * 1000;

const koyomiFullYahooJstKey = (uid: string) => `investment-portfolio:koyomi-yahoo-full-day-jst:${uid}`;

/**
 * 同一 JST 暦日の「先頭の yahoo=full 自動取得」用ガード。手動 `force=1` は
 * 別経路（常に full）— 本フラグ成功後にセットし、2 回目以降の自動は `yahoo=minimal`＋鯖 L1/LS。
 */
function hasKoyomiFullYahooTodayJst(uid: string, jstYmd: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(koyomiFullYahooJstKey(uid)) === jstYmd;
  } catch {
    return false;
  }
}

function markKoyomiFullYahooDayJst(uid: string, jstYmd: string): void {
  try {
    localStorage.setItem(koyomiFullYahooJstKey(uid), jstYmd);
  } catch {
    /* */
  }
}

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

function parseKoyomiLaneJson(raw: KoyomiLaneResponse & { error?: string }): KoyomiLaneResponse | null {
  if ("error" in raw && typeof raw.error === "string" && raw.error.length > 0) return null;
  return {
    startYmd: raw.startYmd,
    endYmd: raw.endYmd,
    todayYmd: raw.todayYmd,
    themeLanes: Array.isArray(raw.themeLanes) ? raw.themeLanes : [],
    outcomeTableMissing: Boolean(raw.outcomeTableMissing),
  };
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
  const [koyomiForceRefreshing, setKoyomiForceRefreshing] = useState(false);
  /** テーマ暦 fetch の世代。クリーンアップで進め、遅れて帰ったレスポンスは無視する */
  const koyomiGen = useRef(0);
  /** 手動 force 再取得。モーダル閉鎖等で番号を進め、遅延レスポンスを捨てる */
  const koyomiForceRefreshGen = useRef(0);
  /** `/api/events` のバックグラウンド強化フェッチをモーダル閉鎖時に無効化する */
  const eventsFetchGen = useRef(0);

  const today = useMemo(() => jstTodayYmd(), [open]);
  const week = useMemo(() => isoWeekRangeJstContaining(today), [today]);
  const dateWindow = useMemo(
    () => ({ start: ymdAddDaysJst(today, -5), end: ymdAddDaysJst(today, 70) }),
    [today],
  );

  const forceRefreshKoyomi = useCallback(async () => {
    const uid = userId.trim();
    if (uid.length === 0) return;
    koyomiGen.current += 1;
    koyomiForceRefreshGen.current += 1;
    const my = koyomiForceRefreshGen.current;
    setKoyomiForceRefreshing(true);
    /**
     * メイン effect 由来の in-flight 取得が `koyomiGen++` により `stale()` になり
     * `setKoyomiLoading(false)` をスキップする。手動 path は `koyomiForceRefreshGen` だけ制御し、
     * ここで主ローディングを必ず下げる（KoyomiLane は `loading` 優先で常時スケルトンになるのを防ぐ）。
     */
    setKoyomiLoading(false);
    setKoyomiErr(null);
    const ac = new AbortController();
    const timeoutId = window.setTimeout(() => ac.abort(), KOYOMI_FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(
        `/api/koyomi-lane?userId=${encodeURIComponent(uid)}&yahoo=full&force=1&_=${Date.now()}`,
        { cache: "no-store", signal: ac.signal },
      );
      if (my !== koyomiForceRefreshGen.current) return;
      const json = (await res.json()) as KoyomiLaneResponse & { error?: string };
      if (my !== koyomiForceRefreshGen.current) return;
      if (!res.ok) {
        setKoyomiErr(json.error ?? `HTTP ${res.status}`);
        setKoyomiLane(null);
        return;
      }
      if ("error" in json && typeof json.error === "string" && json.error.length > 0) {
        setKoyomiErr(json.error);
        setKoyomiLane(null);
        return;
      }
      const lane = parseKoyomiLaneJson(json);
      if (lane != null) {
        setKoyomiLane(lane);
        writeKoyomiLaneSnapshot(uid, lane);
        markKoyomiFullYahooDayJst(uid, jstTodayYmd());
      } else {
        setKoyomiErr("データ取得に失敗しました。再試行してください。");
        setKoyomiLane(null);
      }
    } catch (e) {
      if (my !== koyomiForceRefreshGen.current) return;
      if (e instanceof Error && e.name === "AbortError") {
        setKoyomiErr("テーマ暦の取得がタイムアウトしました。しばらくしてから再度お試しください。");
      } else {
        setKoyomiErr(e instanceof Error ? e.message : "読み込みに失敗しました");
      }
    } finally {
      window.clearTimeout(timeoutId);
      if (my === koyomiForceRefreshGen.current) {
        setKoyomiForceRefreshing(false);
        setKoyomiLoading(false);
      }
    }
  }, [userId]);

  const load = useCallback(async () => {
    const fetchWithTimeout = async (url: string, timeoutMs: number) => {
      const ac = new AbortController();
      const tid = window.setTimeout(() => ac.abort(), timeoutMs);
      try {
        return await fetch(url, { cache: "no-store", signal: ac.signal });
      } finally {
        window.clearTimeout(tid);
      }
    };

    const myGen = ++eventsFetchGen.current;
    setLoading(true);
    setFetchErr(null);
    try {
      const uid = userId.trim().length > 0 ? userId.trim() : "";
      const eventsLightUrl = `/api/events?userId=${encodeURIComponent(uid)}&watchResearch=0`;
      const dashUrl = `/api/dashboard?userId=${encodeURIComponent(uid)}`;

      const [evLightSettled, dashSettled] = await Promise.allSettled([
        fetchWithTimeout(eventsLightUrl, EVENTS_FETCH_TIMEOUT_MS),
        fetchWithTimeout(dashUrl, DASHBOARD_FETCH_TIMEOUT_MS),
      ]);

      const errs: string[] = [];
      let normalizedApi: MarketEventRecord[] = [];

      if (evLightSettled.status === "fulfilled") {
        const resEvents = evLightSettled.value;
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
        const reason = evLightSettled.reason;
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

      if (eventsFetchGen.current !== myGen) return;

      setEvents(mergeEventsWithHoldings(normalizedApi, stocksRaw, dateWindow));
      setFetchErr(errs.length > 0 ? errs.join(" ") : null);
    } catch (e) {
      setFetchErr(e instanceof Error ? e.message : "読み込みに失敗しました");
      setEvents([]);
    } finally {
      setLoading(false);
    }

    const uid2 = userId.trim().length > 0 ? userId.trim() : "";
    if (uid2.length === 0) return;
    const genAfterLight = eventsFetchGen.current;
    const eventsFullUrl2 = `/api/events?userId=${encodeURIComponent(uid2)}`;
    const dashUrl2 = `/api/dashboard?userId=${encodeURIComponent(uid2)}`;
    const runFull = () => {
      void (async () => {
        try {
          const [resFull, resDash2] = await Promise.allSettled([
            fetchWithTimeout(eventsFullUrl2, EVENTS_FETCH_TIMEOUT_MS),
            fetchWithTimeout(dashUrl2, DASHBOARD_FETCH_TIMEOUT_MS),
          ]);
          if (eventsFetchGen.current !== genAfterLight) return;

          const errs2: string[] = [];
          let fullApi: MarketEventRecord[] = [];
          if (resFull.status === "fulfilled") {
            const res = resFull.value;
            try {
              const j = (await res.json()) as { events?: MarketEventRecord[]; error?: string };
              if (!res.ok) {
                errs2.push(j.error ?? `イベント（フル）HTTP ${res.status}`);
              } else {
                const apiEvents = Array.isArray(j.events) ? j.events : [];
                fullApi = apiEvents.map((e) => ({ ...e, source: e.source ?? ("macro" as const) }));
              }
            } catch {
              errs2.push("イベント（フル）の解析に失敗しました");
            }
          }
          let stocks2: DashboardStockLite[] = [];
          if (resDash2.status === "fulfilled") {
            const res = resDash2.value;
            try {
              const j = (await res.json()) as { stocks?: unknown[]; error?: string };
              if (res.ok && Array.isArray(j.stocks)) stocks2 = j.stocks as DashboardStockLite[];
            } catch {
              /* keep stocks2 empty */
            }
          }
          if (eventsFetchGen.current !== genAfterLight) return;
          if (resFull.status === "fulfilled" && resFull.value.ok) {
            setEvents(mergeEventsWithHoldings(fullApi, stocks2, dateWindow));
            if (errs2.length > 0) {
              setFetchErr((cur) => (cur != null && cur.length > 0 ? `${cur} / ${errs2.join(" ")}` : errs2.join(" ")));
            }
          } else if (errs2.length > 0) {
            setFetchErr((cur) => (cur != null && cur.length > 0 ? `${cur} / ${errs2.join(" ")}` : errs2.join(" ")));
          }
        } catch {
          /* フル補完は best-effort */
        }
      })();
    };
    if (typeof requestIdleCallback !== "undefined") {
      requestIdleCallback(() => runFull(), { timeout: 2500 });
    } else {
      window.setTimeout(runFull, 200);
    }
  }, [dateWindow.end, dateWindow.start, userId]);

  useEffect(() => {
    if (!open) {
      eventsFetchGen.current += 1;
      koyomiGen.current += 1;
      koyomiForceRefreshGen.current += 1;
      setKoyomiLane(null);
      setKoyomiErr(null);
      setKoyomiLoading(false);
      setKoyomiForceRefreshing(false);
      return;
    }
    void load();
  }, [open, load]);

  /**
   * テーマ暦: 二段階ロード（プログレッシブ・ロード）アーキテクチャ。
   * 1. 枠の即時表示: LocalStorage スナップがあれば即表示、なければ `yahoo=minimal`（DB のみ）で 2 秒以内に枠を出す。
   * 2. 非同期補完: 枠が出た後、バックグラウンドで `yahoo=full` を実行し重い数値（R40/筋肉）を埋める。
   * 同一 JST 日の `yahoo=full` 完了後は `markKoyomiFullYahooDayJst` により当日の再入場は `yahoo=minimal`＋鯖キャッシュ＋LS。
   * 手動は `forceRefreshKoyomi`（常に full、`force=1`）。
   */
  useEffect(() => {
    if (!open || tab !== "themes") return;

    const myGen = ++koyomiGen.current;
    const uid = userId.trim().length > 0 ? userId.trim() : "";
    if (uid.length === 0) {
      setKoyomiErr("userId がありません");
      setKoyomiLoading(false);
      return;
    }

    const stale = () => myGen !== koyomiGen.current;
    const baseKoyomi = `/api/koyomi-lane?userId=${encodeURIComponent(uid)}`;
    const jstY = jstTodayYmd();
    const yahooTierForAuto = () => (hasKoyomiFullYahooTodayJst(uid, jstY) ? "minimal" : "full");

    /**
     * 既存のデータと新しいデータをマージする。
     * 既に数値がある銘柄が null で上書きされないようにし、チラつきを抑える。
     */
    const mergeLaneData = (prev: KoyomiLaneResponse | null, next: KoyomiLaneResponse): KoyomiLaneResponse => {
      if (!prev) return next;
      // 掲載期間が変わっている場合はマージせず新しいものを使う
      if (prev.startYmd !== next.startYmd || prev.endYmd !== next.endYmd) return next;

      const nextLanes = next.themeLanes.map(nLane => {
        const pLane = prev.themeLanes.find(pl => pl.themeId === nLane.themeId);
        if (!pLane) return nLane;

        const nextItems = nLane.items.map(nItem => {
          const pItem = pLane.items.find(pi => pi.id === nItem.id);
          if (!pItem) return nItem;

          // 数値データが next で null かつ prev で存在する場合、prev を維持する
          const merged = { ...nItem };
          if (merged.ruleOf40Current === null && pItem.ruleOf40Current !== null) {
            merged.ruleOf40Current = pItem.ruleOf40Current;
            merged.ruleOf40Prior = pItem.ruleOf40Prior;
            merged.ruleOf40Delta = pItem.ruleOf40Delta;
            merged.ruleOf40DeltaStatus = pItem.ruleOf40DeltaStatus;
          }
          if (merged.muscleScoreCurrent === null && pItem.muscleScoreCurrent !== null) {
            merged.muscleScoreCurrent = pItem.muscleScoreCurrent;
            merged.muscleScorePrior = pItem.muscleScorePrior;
            merged.muscleDelta = pItem.muscleDelta;
            merged.muscleDeltaStatus = pItem.muscleDeltaStatus;
            merged.isMispriced = pItem.isMispriced;
          }
          if (merged.regularMarketChangePercent === null && pItem.regularMarketChangePercent !== null) {
            merged.regularMarketChangePercent = pItem.regularMarketChangePercent;
          }
          return merged;
        });
        return { ...nLane, items: nextItems };
      });

      return { ...next, themeLanes: nextLanes };
    };

    const fetchFull = async (signal: AbortSignal) => {
      try {
        const resFull = await fetch(`${baseKoyomi}&yahoo=full`, {
          cache: "no-store",
          signal,
        });
        if (stale() || signal.aborted) return;
        const json = (await resFull.json()) as KoyomiLaneResponse & { error?: string };
        if (stale()) return;
        if (!resFull.ok) return;
        if ("error" in json && typeof json.error === "string" && json.error.length > 0) return;
        const lane = parseKoyomiLaneJson(json);
        if (lane != null) {
          setKoyomiLane(prev => mergeLaneData(prev, lane));
          writeKoyomiLaneSnapshot(uid, lane);
          markKoyomiFullYahooDayJst(uid, jstY);
          setKoyomiErr(null);
        }
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
      }
    };

    const snap = readKoyomiLaneSnapshot(uid);
    if (snap != null) {
      setKoyomiLane(snap);
      setKoyomiErr(null);
      setKoyomiLoading(false);
      
      const yh = yahooTierForAuto();
      if (yh === "full") {
        const revalidateAc = new AbortController();
        void fetchFull(revalidateAc.signal);
        return () => {
          revalidateAc.abort();
          koyomiGen.current += 1;
          koyomiForceRefreshGen.current += 1;
        };
      }
      return;
    }

    const ac = new AbortController();
    setKoyomiLoading(true);
    setKoyomiErr(null);

    void (async () => {
      // 1. 枠の取得 (yahoo=minimal)
      try {
        const resMin = await fetch(`${baseKoyomi}&yahoo=minimal`, {
          cache: "no-store",
          signal: ac.signal,
        });
        if (stale() || ac.signal.aborted) return;
        const json = (await resMin.json()) as KoyomiLaneResponse & { error?: string };
        if (stale()) return;
        if (resMin.ok) {
          const lane = parseKoyomiLaneJson(json);
          if (lane != null) {
            setKoyomiLane(lane);
            setKoyomiErr(null);
            setKoyomiLoading(false); // 枠が出たのでスケルトン終了
          }
        }
      } catch {
        // minimal 失敗時は full に賭ける
      }

      // 2. 数値の補完 (yahoo=full)
      const yh = yahooTierForAuto();
      if (yh === "full") {
        await fetchFull(ac.signal);
      }
      
      if (!stale()) setKoyomiLoading(false);
    })();

    return () => {
      ac.abort();
      koyomiGen.current += 1;
      koyomiForceRefreshGen.current += 1;
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
        className="relative z-10 flex h-[min(92dvh,85rem)] w-[min(99vw,110rem)] max-w-[99vw] min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
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

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div
            className={cn(
              "min-h-0 flex-1 overscroll-contain [-webkit-overflow-scrolling:touch] px-4 py-4 text-sm sm:px-6 sm:py-5 sm:text-base",
              /* テーマ暦: KoyomiLane 内が縦スクロール担当。ここで overflow-y すると二重スクロールになる */
              tab === "themes" ? "flex flex-col overflow-hidden" : "overflow-y-auto",
            )}
          >
          {tab === "themes" ? (
            <KoyomiLane
              className="min-h-0 min-w-0 flex-1 flex flex-col"
              data={koyomiLane}
              loading={koyomiLoading}
              error={koyomiErr}
              forceRefreshing={koyomiForceRefreshing}
              onForceRefresh={forceRefreshKoyomi}
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
