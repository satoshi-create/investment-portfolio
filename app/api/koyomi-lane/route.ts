import { NextResponse } from "next/server";

import {
  applyThemeEpicenterGravity,
  computeEarningsQuality,
  isMispricedPositiveMuscleWithSessionDrop,
  type EarningsEpicenterInput,
} from "@/src/lib/alpha-logic";
import { defaultProfileUserId } from "@/src/lib/authorize-signals";
import { getDb, isDbConfigured } from "@/src/lib/db";
import {
  fetchKoyomiResearchAndRule40Map,
  type KoyomiTickerMuscle,
  type KoyomiTickerQuarterlyR40,
} from "@/src/lib/koyomi-yahoo-rule40";
import { type EquityResearchSnapshot } from "@/src/lib/price-service";
import type { KoyomiLaneItem, KoyomiLaneResponse, KoyomiThemeLane } from "@/src/types/koyomi";

export const dynamic = "force-dynamic";

/**
 * スイムレーンに掲げる次回決算日の範囲（UTC）。Yahoo から解決した未来日が狭窓外に出やすいため、前方日を広げる。
 */
const LANE_EARNINGS_BACK_DAYS = 5;
/** 少なくとも「近い次回以降の決算」を多く乗せる（±15 の Yahoo 重み付け帯より広い） */
const LANE_EARNINGS_FORWARD_DAYS = 120;

/**
 * Yahoo+Rule40 多段取得の対象ティッカーは負荷が大きいため、決算日の「近傍」帯に限定（DB 日付が既に取れている枠外は r40 等は既定値のまま）。
 */
const YAHOO_HEAVY_BACK_DAYS = 14;
const YAHOO_HEAVY_FORWARD_DAYS = 14;

/** 同一ユーザー・同一掲載ウィンドウでの再計算を避け、連続リロード時の体感を改善 */
const LANE_HTTP_CACHE_TTL_MS = 75_000;
const LANE_HTTP_CACHE_MAX = 16;
type LaneCacheEntry = { expiresAt: number; body: KoyomiLaneResponse };
const laneHttpCache = new Map<string, LaneCacheEntry>();

function laneCacheGet(key: string): KoyomiLaneResponse | null {
  const e = laneHttpCache.get(key);
  if (e == null || e.expiresAt <= Date.now()) {
    if (e != null) laneHttpCache.delete(key);
    return null;
  }
  return e.body;
}

function laneCacheSet(key: string, body: KoyomiLaneResponse): void {
  if (laneHttpCache.size >= LANE_HTTP_CACHE_MAX) {
    const first = laneHttpCache.keys().next().value;
    if (first != null) laneHttpCache.delete(first);
  }
  laneHttpCache.set(key, { expiresAt: Date.now() + LANE_HTTP_CACHE_TTL_MS, body });
}

function utcTodayYmd(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function ymdAddDaysUtc(ymd: string, delta: number): string {
  const base = ymd.length >= 10 ? ymd.slice(0, 10) : utcTodayYmd();
  const dt = new Date(`${base}T12:00:00.000Z`);
  dt.setUTCDate(dt.getUTCDate() + Math.trunc(delta));
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const day = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function ymdOrNull(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

type OutcomeRow = {
  eps: number | null;
  rev: number | null;
  price: number | null;
};

type TickerIn = { ticker: string; providerSymbol: string | null };

function isSqliteNoSuchColumn(err: unknown, columnHint: string): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const low = msg.toLowerCase();
  return low.includes("no such column") && low.includes(columnHint.toLowerCase());
}

/**
 * テーマウォッチ（`theme_ecosystem_members`）をテーマ=スイムレーンに展開し、
 * `ticker_earnings_outcomes` がある場合は品質と爆心病重力を付与。
 */
export async function GET(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: "Database not configured", hint: "Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN" },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  const userIdRaw = searchParams.get("userId");
  const userId =
    typeof userIdRaw === "string" && userIdRaw.trim().length > 0 ? userIdRaw.trim() : defaultProfileUserId();

  /** `yahoo=minimal` で Yahoo を呼ばず DB の `next_earnings_date` のみ（クライアントが 24h キャッシュヒット時に使用） */
  const useYahooFull = searchParams.get("yahoo") !== "minimal";
  /** 手動再取得: 75s HTTP バッファと Yahoo 24h プロセス内キャッシュの読取を飛ばす */
  const forceYahoo = searchParams.get("force") === "1" || searchParams.get("force") === "true";

  const today = utcTodayYmd();
  const startYmd = ymdAddDaysUtc(today, -LANE_EARNINGS_BACK_DAYS);
  const endYmd = ymdAddDaysUtc(today, LANE_EARNINGS_FORWARD_DAYS);
  const heavyStartYmd = ymdAddDaysUtc(today, -YAHOO_HEAVY_BACK_DAYS);
  const heavyEndYmd = ymdAddDaysUtc(today, YAHOO_HEAVY_FORWARD_DAYS);

  const laneCacheKey = `${userId}\t${startYmd}\t${endYmd}\t${useYahooFull ? "full" : "min"}`;
  if (!forceYahoo) {
    const cachedLane = laneCacheGet(laneCacheKey);
    if (cachedLane != null) {
      return NextResponse.json(cachedLane);
    }
  }

  let outcomeTableMissing = false;
  const outcomeByKey = new Map<string, OutcomeRow>();

  const db = getDb();

  try {
    const holdingTickerSet = new Set<string>();
    const holdingProviderByUpper = new Map<string, string | null>();
    try {
      const hr = await db.execute({
        sql: `SELECT UPPER(TRIM(ticker)) AS u, provider_symbol FROM holdings WHERE user_id = ? AND quantity > 0`,
        args: [userId],
      });
      for (const row of hr.rows as Record<string, unknown>[]) {
        const u = String(row["u"] ?? "").trim();
        if (u.length === 0) continue;
        holdingTickerSet.add(u);
        const ps = row["provider_symbol"];
        const prov = ps != null && String(ps).trim().length > 0 ? String(ps).trim() : null;
        if (!holdingProviderByUpper.has(u)) holdingProviderByUpper.set(u, prov);
      }
    } catch {
      /* holdings 未作成時は空集合 */
    }

    /** エコシステム上の全テーマ（1 行も掲載されなくてもレーン枠を出す） */
    const allThemeNamesById = new Map<string, string>();
    let rows: Record<string, unknown>[];
    try {
      const wr = await db.execute({
        sql: `SELECT m.id AS member_id, m.ticker, m.is_unlisted, m.proxy_ticker, m.company_name, m.next_earnings_date,
                     m.status AS member_status,
                     t.id AS theme_id, t.name AS theme_name
              FROM theme_ecosystem_members m
              INNER JOIN investment_themes t ON m.theme_id = t.id
              WHERE t.user_id = ?
              ORDER BY t.name ASC, m.ticker ASC`,
        args: [userId],
      });
      rows = wr.rows as Record<string, unknown>[];
    } catch (e) {
      if (!isSqliteNoSuchColumn(e, "status")) throw e;
      const wr = await db.execute({
        sql: `SELECT m.id AS member_id, m.ticker, m.is_unlisted, m.proxy_ticker, m.company_name, m.next_earnings_date,
                     NULL AS member_status,
                     t.id AS theme_id, t.name AS theme_name
              FROM theme_ecosystem_members m
              INNER JOIN investment_themes t ON m.theme_id = t.id
              WHERE t.user_id = ?
              ORDER BY t.name ASC, m.ticker ASC`,
        args: [userId],
      });
      rows = wr.rows as Record<string, unknown>[];
    }

    for (const row of rows) {
      const tid = String(row["theme_id"] ?? "").trim();
      if (!tid) continue;
      const tn = String(row["theme_name"] ?? "").trim();
      if (!allThemeNamesById.has(tid)) allThemeNamesById.set(tid, tn);
    }

    /**
     * Yahoo フル取得（`yahoo=minimal` ではスキップ）の対象（テーマ Ecosystem 登録行は関心ありとみなし、`status` NULL は内部的に watch 扱いで下記に含む）:
     * - 狭帯 [heavyStart..heavyEnd] に DB 日付がある
     * - 掲載帯 [startYmd..endYmd] に DB 日付がある（遠めの日でもレーンに載るチップの R40/筋肉を出す）
     * - `next_earnings_date` が null（全テーマ銘柄: PLTR/TEAM/日本株など Yahoo で日付・指標を補う）
     */
    const inWindowDbHeavy = new Map<string, TickerIn>();
    for (const row of rows) {
      const isUnlisted = Number(row["is_unlisted"]) === 1;
      const ticker = String(row["ticker"] ?? "").trim();
      const proxy = row["proxy_ticker"] != null ? String(row["proxy_ticker"]).trim() : "";
      const eff = !isUnlisted ? ticker : proxy;
      if (eff.length === 0) continue;
      const dbYmd = ymdOrNull(row["next_earnings_date"]);
      const u = eff.toUpperCase();
      const prov = holdingProviderByUpper.get(u) ?? null;
      const entry: TickerIn = { ticker: eff, providerSymbol: prov };
      const inHeavyDate = dbYmd != null && dbYmd >= heavyStartYmd && dbYmd <= heavyEndYmd;
      const inLaneDbDate = dbYmd != null && dbYmd >= startYmd && dbYmd <= endYmd;
      if (inHeavyDate) {
        if (!inWindowDbHeavy.has(u)) inWindowDbHeavy.set(u, entry);
      } else if (inLaneDbDate) {
        if (!inWindowDbHeavy.has(u)) inWindowDbHeavy.set(u, entry);
      } else if (dbYmd == null) {
        if (!inWindowDbHeavy.has(u)) inWindowDbHeavy.set(u, entry);
      }
    }

    const researchInputs: TickerIn[] = [...inWindowDbHeavy.values()];

    const allEffTickers = researchInputs.map((x) => x.ticker);

    let researchMap = new Map<string, EquityResearchSnapshot>();
    let rule40ByTickerUpper = new Map<string, KoyomiTickerQuarterlyR40>();
    let muscleByTickerUpper = new Map<string, KoyomiTickerMuscle>();
    let regularMarketChangeByUpper = new Map<string, number | null>();
    if (useYahooFull) {
      try {
        if (researchInputs.length > 0) {
          const combined = await fetchKoyomiResearchAndRule40Map(researchInputs, {
            concurrency: 12,
            delayMs: 0,
            bypassYahooCache: forceYahoo,
          });
          for (const [k, v] of combined) {
            researchMap.set(k, v.research);
            rule40ByTickerUpper.set(k, v.rule40);
            muscleByTickerUpper.set(k, v.muscle);
            regularMarketChangeByUpper.set(k, v.regularMarketChangePercent);
          }
        }
      } catch {
        researchMap = new Map();
        rule40ByTickerUpper = new Map();
        muscleByTickerUpper = new Map();
        regularMarketChangeByUpper = new Map();
      }
    }

    try {
      if (allEffTickers.length > 0) {
        const placeholders = allEffTickers.map(() => "?").join(", ");
        const oRes = await db.execute({
          sql: `SELECT ticker, earnings_ymd, eps_surprise_pct, revenue_surprise_pct, price_impact_pct
                FROM ticker_earnings_outcomes
                WHERE ticker IN (${placeholders})
                  AND date(earnings_ymd) >= date(?) AND date(earnings_ymd) <= date(?)`,
          args: [...allEffTickers, startYmd, endYmd],
        });
        for (const r of oRes.rows as Record<string, unknown>[]) {
          const tk = String(r["ticker"] ?? "")
            .trim()
            .toUpperCase();
          const y = ymdOrNull(r["earnings_ymd"]);
          if (!tk || !y) continue;
          const eps = r["eps_surprise_pct"] != null && Number.isFinite(Number(r["eps_surprise_pct"])) ? Number(r["eps_surprise_pct"]) : null;
          const rev = r["revenue_surprise_pct"] != null && Number.isFinite(Number(r["revenue_surprise_pct"])) ? Number(r["revenue_surprise_pct"]) : null;
          const price = r["price_impact_pct"] != null && Number.isFinite(Number(r["price_impact_pct"])) ? Number(r["price_impact_pct"]) : null;
          outcomeByKey.set(`${tk}|${y}`, { eps, rev, price });
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.toLowerCase().includes("no such table") && msg.toLowerCase().includes("ticker_earnings_outcomes")) {
        outcomeTableMissing = true;
      } else {
        throw e;
      }
    }

    type Draft = {
      id: string;
      memberId: string;
      themeId: string;
      themeName: string;
      ticker: string;
      companyName: string | null;
      ymd: string;
      isUnlisted: boolean;
      displayTicker: string;
      /** `member_status = owned` または該当ティッカーを保有（holdings） */
      owned: boolean;
    };

    const drafts: Draft[] = [];
    for (const row of rows) {
      const memberId = String(row["member_id"] ?? "").trim();
      const ticker = String(row["ticker"] ?? "").trim();
      if (!memberId || !ticker) continue;
      const isUnlisted = Number(row["is_unlisted"]) === 1;
      const proxy = row["proxy_ticker"] != null ? String(row["proxy_ticker"]).trim() : "";
      const effTicker = !isUnlisted ? ticker : proxy;
      const dbYmd = ymdOrNull(row["next_earnings_date"]);
      const snap = effTicker.length > 0 ? researchMap.get(effTicker.toUpperCase()) : undefined;
      const resYmd = snap?.nextEarningsDate != null ? snap.nextEarningsDate.trim().slice(0, 10) : null;
      const effectiveYmd = dbYmd ?? (resYmd && /^\d{4}-\d{2}-\d{2}$/.test(resYmd) ? resYmd : null);
      if (effectiveYmd == null) continue;
      if (effectiveYmd < startYmd || effectiveYmd > endYmd) continue;

      const st = row["member_status"];
      /** `status` NULL は上の Yahoo 対象ロジックで観測（watch）相当として扱われている。 */
      const stNorm = typeof st === "string" ? st.trim().toLowerCase() : "";
      const effU = effTicker.length > 0 ? effTicker.toUpperCase() : ticker.toUpperCase();
      const ownedMember = stNorm === "owned" || holdingTickerSet.has(effU);

      const company = row["company_name"] != null ? String(row["company_name"]).trim() : "";
      const themeId = String(row["theme_id"] ?? "").trim();
      const themeName = row["theme_name"] != null ? String(row["theme_name"]).trim() : "";
      drafts.push({
        id: `koyomi:${memberId}:${effectiveYmd}`,
        memberId,
        themeId,
        themeName,
        ticker,
        companyName: company.length > 0 ? company : null,
        ymd: effectiveYmd,
        isUnlisted,
        displayTicker: effTicker.length > 0 ? effTicker : ticker,
        owned: ownedMember,
      });
    }

    // dayOrder: (themeId, ymd) ごとに保有優先 → displayTicker 昇順
    const orderKey = (theme: string, y: string) => `${theme}::${y}`;
    const byKeyLists = new Map<string, Draft[]>();
    for (const d of drafts) {
      const k = orderKey(d.themeId, d.ymd);
      if (!byKeyLists.has(k)) byKeyLists.set(k, []);
      byKeyLists.get(k)!.push(d);
    }
    for (const [, list] of byKeyLists) {
      list.sort((a, b) => {
        if (a.owned !== b.owned) return a.owned ? -1 : 1;
        return a.displayTicker.localeCompare(b.displayTicker, "en");
      });
    }
    const dayOrderById = new Map<string, number>();
    for (const [, list] of byKeyLists) {
      list.forEach((d, i) => dayOrderById.set(d.id, i));
    }

    const defaultMuscle: KoyomiTickerMuscle = {
      muscleCurrent: null,
      musclePrior: null,
      muscleDelta: null,
      muscleDeltaStatus: "unknown",
    };

    const themeMap = new Map<string, { themeName: string; items: KoyomiLaneItem[] }>();

    for (const d of drafts) {
      if (!themeMap.has(d.themeId)) {
        themeMap.set(d.themeId, { themeName: d.themeName, items: [] });
      }
    }

    for (const d of drafts) {
      const tkU = d.displayTicker.toUpperCase();
      const rowO = !outcomeTableMissing ? outcomeByKey.get(`${tkU}|${d.ymd}`) : undefined;
      const inPast = d.ymd < today;
      let hasOutcome: boolean;
      let eps: number | null = null;
      let rev: number | null = null;
      let price: number | null = null;
      if (rowO) {
        hasOutcome = true;
        eps = rowO.eps;
        rev = rowO.rev;
        price = rowO.price;
      } else if (inPast) {
        hasOutcome = true;
      } else {
        hasOutcome = false;
      }
      const q = computeEarningsQuality({
        hasOutcome,
        epsSurprisePct: eps,
        revenueSurprisePct: rev,
        priceImpactPct: price,
      });
      const tEntry = themeMap.get(d.themeId);
      if (!tEntry) continue;
      const r40 = rule40ByTickerUpper.get(tkU) ?? {
        ruleOf40Current: null,
        ruleOf40Prior: null,
        ruleOf40Delta: null,
        ruleOf40DeltaStatus: "unknown" as const,
      };
      const muscle = muscleByTickerUpper.get(tkU) ?? defaultMuscle;
      const dayChg = regularMarketChangeByUpper.get(tkU) ?? null;
      const isMispriced = isMispricedPositiveMuscleWithSessionDrop({
        muscleDeltaStatus: muscle.muscleDeltaStatus,
        regularMarketChangePercent: dayChg,
      });
      tEntry.items.push({
        id: d.id,
        memberId: d.memberId,
        themeId: d.themeId,
        themeName: d.themeName,
        ticker: d.ticker,
        companyName: d.companyName,
        ymd: d.ymd,
        dayOrder: dayOrderById.get(d.id) ?? 0,
        hasOutcome,
        qualityKind: q.kind,
        qualityScore: q.score,
        epsSurprisePct: eps,
        revenueSurprisePct: rev,
        priceImpactPct: price,
        isEpicenter: false,
        gravityTaint: 0,
        isUnlisted: d.isUnlisted,
        displayTicker: d.displayTicker,
        epsSide: q.epsSide,
        revSide: q.revSide,
        ruleOf40Current: r40.ruleOf40Current,
        ruleOf40Prior: r40.ruleOf40Prior,
        ruleOf40Delta: r40.ruleOf40Delta,
        ruleOf40DeltaStatus: r40.ruleOf40DeltaStatus,
        muscleScoreCurrent: muscle.muscleCurrent,
        muscleScorePrior: muscle.musclePrior,
        muscleDelta: muscle.muscleDelta,
        muscleDeltaStatus: muscle.muscleDeltaStatus,
        regularMarketChangePercent: dayChg,
        isMispriced,
      });
    }

    const themeLanes: KoyomiThemeLane[] = [];
    for (const [themeId, { themeName, items }] of themeMap) {
      if (items.length === 0) {
        themeLanes.push({ themeId, themeName, items: [] });
        continue;
      }
      const byYmd = new Map<string, KoyomiLaneItem[]>();
      for (const it of items) {
        if (!byYmd.has(it.ymd)) byYmd.set(it.ymd, []);
        byYmd.get(it.ymd)!.push(it);
      }
      for (const [, arr] of byYmd) {
        arr.sort((a, b) => a.displayTicker.localeCompare(b.displayTicker, "en"));
      }
      const sortedItems = [...items].sort(
        (a, b) => a.ymd.localeCompare(b.ymd) || a.displayTicker.localeCompare(b.displayTicker, "en"),
      );

      const epicInputs: EarningsEpicenterInput[] = sortedItems.map((it) => ({
        id: it.id,
        ymd: it.ymd,
        dayOrder: it.dayOrder,
        hasOutcome: it.hasOutcome,
        quality: computeEarningsQuality({
          hasOutcome: it.hasOutcome,
          epsSurprisePct: it.epsSurprisePct,
          revenueSurprisePct: it.revenueSurprisePct,
          priceImpactPct: it.priceImpactPct,
        }),
        priceImpactPct: it.priceImpactPct,
      }));
      const epicMap = applyThemeEpicenterGravity(epicInputs);

      const finalItems = sortedItems.map((it) => {
        const e = epicMap.get(it.id);
        return { ...it, isEpicenter: e?.isEpicenter ?? false, gravityTaint: e?.gravityTaint ?? 0 };
      });
      themeLanes.push({ themeId, themeName, items: finalItems });
    }

    const seenThemeIds = new Set(themeLanes.map((t) => t.themeId));
    for (const [themeId, themeName] of allThemeNamesById) {
      if (!seenThemeIds.has(themeId)) {
        themeLanes.push({ themeId, themeName, items: [] });
        seenThemeIds.add(themeId);
      }
    }
    themeLanes.sort((a, b) => a.themeName.localeCompare(b.themeName, "ja"));

    const resBody: KoyomiLaneResponse = {
      startYmd,
      endYmd,
      todayYmd: today,
      themeLanes,
      outcomeTableMissing,
    };
    laneCacheSet(laneCacheKey, resBody);
    return NextResponse.json(resBody);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const low = msg.toLowerCase();
    if (low.includes("no such table") && (low.includes("theme_ecosystem_members") || low.includes("investment_themes"))) {
      return NextResponse.json({
        startYmd,
        endYmd,
        todayYmd: today,
        themeLanes: [] as KoyomiThemeLane[],
        outcomeTableMissing: false,
      } satisfies KoyomiLaneResponse);
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
