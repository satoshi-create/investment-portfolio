import { NextResponse } from "next/server";

import {
  applyThemeEpicenterGravity,
  classifyTickerInstrument,
  computeEarningsQuality,
  type EarningsEpicenterInput,
} from "@/src/lib/alpha-logic";
import { defaultProfileUserId } from "@/src/lib/authorize-signals";
import { getDb, isDbConfigured } from "@/src/lib/db";
import {
  fetchKoyomiCalendarProbeMap,
  fetchKoyomiResearchAndRule40Map,
  type KoyomiTickerMuscle,
  type KoyomiTickerQuarterlyR40,
} from "@/src/lib/koyomi-yahoo-rule40";
import {
  fetchChartCumulativeReturnPercentSinceEventYmd,
  type EquityResearchSnapshot,
} from "@/src/lib/price-service";
import type { KoyomiLaneItem, KoyomiLaneResponse, KoyomiThemeLane } from "@/src/types/koyomi";

export const dynamic = "force-dynamic";

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

/** 筋肉改善なのに、決算日以降の累積リターンがこの値以下なら Mispriced */
const MISPRICED_CUM_RETURN_SINCE_EARNINGS_PCT = -3;
/** Mispriced 用チャート並列の上限（Yahoo chart が積み上がって 60s+ になりやすいため抑止） */
const MAX_CUM_CHART_TASKS = 16;
/**
 * null 決算日のウォッチが膨大な場合のセーフティ（保有・DB ウィンドウ内は対象外）。
 * 米国/JP はラウンドロビンで公平に埋める。保有（owned / holdings）はこの上限に含めない。
 */
const MAX_NON_OWNED_CALENDAR_PROBES = 400;

function isSqliteNoSuchColumn(err: unknown, columnHint: string): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const low = msg.toLowerCase();
  return low.includes("no such column") && low.includes(columnHint.toLowerCase());
}

function isUsEquityTicker(ticker: string): boolean {
  return classifyTickerInstrument(ticker) === "US_EQUITY";
}

/** UTC 月曜始まりの週（該当暦日を含む） */
function isoWeekRangeUtcContaining(ymd: string): { start: string; end: string } {
  const base = ymd.length >= 10 ? ymd.slice(0, 10) : utcTodayYmd();
  const d = new Date(`${base}T12:00:00.000Z`);
  const dow = d.getUTCDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + mondayOffset);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const start = `${y}-${mo}-${day}`;
  const d2 = new Date(`${start}T12:00:00.000Z`);
  d2.setUTCDate(d2.getUTCDate() + 6);
  const y2 = d2.getUTCFullYear();
  const mo2 = String(d2.getUTCMonth() + 1).padStart(2, "0");
  const day2 = String(d2.getUTCDate()).padStart(2, "0");
  const end = `${y2}-${mo2}-${day2}`;
  return { start, end };
}

type TickerIn = { ticker: string; providerSymbol: string | null };

function mergeRoundRobinCap(us: TickerIn[], jp: TickerIn[], max: number): TickerIn[] {
  const out: TickerIn[] = [];
  let i = 0;
  let j = 0;
  while (out.length < max && (i < us.length || j < jp.length)) {
    if (i < us.length) {
      out.push(us[i]!);
      i += 1;
      if (out.length >= max) break;
    }
    if (j < jp.length) {
      out.push(jp[j]!);
      j += 1;
    }
  }
  return out;
}

/** 保有は全件プローブ。それ以外は米国/JP を交互にしつつ上限 */
function buildFairCalendarProbeCandidates(
  nullProbeByUpper: Map<
    string,
    { ticker: string; providerSymbol: string | null; owned: boolean }
  >,
  inWindowHeavyKeys: Set<string>,
): TickerIn[] {
  const pool = [...nullProbeByUpper.values()].filter((x) => !inWindowHeavyKeys.has(x.ticker.toUpperCase()));
  const owned = pool.filter((x) => x.owned);
  const nonOwned = pool.filter((x) => !x.owned);

  const ownedUs = owned.filter((x) => isUsEquityTicker(x.ticker));
  const ownedJp = owned.filter((x) => !isUsEquityTicker(x.ticker));
  ownedUs.sort((a, b) => a.ticker.localeCompare(b.ticker, "en"));
  ownedJp.sort((a, b) => a.ticker.localeCompare(b.ticker, "en"));

  const ownedOut: TickerIn[] = [];
  let iu = 0;
  let ij = 0;
  while (iu < ownedUs.length || ij < ownedJp.length) {
    if (iu < ownedUs.length) {
      ownedOut.push({ ticker: ownedUs[iu]!.ticker, providerSymbol: ownedUs[iu]!.providerSymbol });
      iu += 1;
    }
    if (ij < ownedJp.length) {
      ownedOut.push({ ticker: ownedJp[ij]!.ticker, providerSymbol: ownedJp[ij]!.providerSymbol });
      ij += 1;
    }
  }

  const nonOwnedUs = nonOwned.filter((x) => isUsEquityTicker(x.ticker));
  const nonOwnedJp = nonOwned.filter((x) => !isUsEquityTicker(x.ticker));
  nonOwnedUs.sort((a, b) => a.ticker.localeCompare(b.ticker, "en"));
  nonOwnedJp.sort((a, b) => a.ticker.localeCompare(b.ticker, "en"));

  const nonOwnedOut = mergeRoundRobinCap(
    nonOwnedUs.map((x) => ({ ticker: x.ticker, providerSymbol: x.providerSymbol })),
    nonOwnedJp.map((x) => ({ ticker: x.ticker, providerSymbol: x.providerSymbol })),
    MAX_NON_OWNED_CALENDAR_PROBES,
  );

  return [...ownedOut, ...nonOwnedOut];
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const c = Math.max(1, Math.floor(concurrency));
  const out: R[] = new Array(items.length);
  let i = 0;
  async function worker(): Promise<void> {
    for (;;) {
      const j = i++;
      if (j >= items.length) return;
      out[j] = await fn(items[j]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(c, items.length) }, () => worker()));
  return out;
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

  /** `charts=0` で決算日以降の累積リターン取得を省略（Mispriced は無効化、応答が短くなる） */
  const includeCumCharts = searchParams.get("charts") !== "0";

  /** `yahoo=minimal` で Yahoo を呼ばず DB の `next_earnings_date` のみ（クライアントが 24h キャッシュヒット時に使用） */
  const useYahooFull = searchParams.get("yahoo") !== "minimal";

  const today = utcTodayYmd();
  /** タクティカル・ウィンドウ: 今週（UTC）を中央に据えた 21 日（前後各 7 日 + 当該週 7 日） */
  const week = isoWeekRangeUtcContaining(today);
  const startYmd = ymdAddDaysUtc(week.start, -7);
  const endYmd = ymdAddDaysUtc(week.end, 7);

  const laneCacheKey = `${userId}\t${startYmd}\t${endYmd}\t${includeCumCharts ? "1" : "0"}\t${useYahooFull ? "full" : "min"}`;
  const cachedLane = laneCacheGet(laneCacheKey);
  if (cachedLane != null) {
    return NextResponse.json(cachedLane);
  }

  let outcomeTableMissing = false;
  const outcomeByKey = new Map<string, OutcomeRow>();

  const db = getDb();

  try {
    const holdingTickerSet = new Set<string>();
    try {
      const hr = await db.execute({
        sql: `SELECT DISTINCT UPPER(TRIM(ticker)) AS u FROM holdings WHERE user_id = ? AND quantity > 0`,
        args: [userId],
      });
      for (const row of hr.rows as Record<string, unknown>[]) {
        const u = String(row["u"] ?? "").trim();
        if (u.length > 0) holdingTickerSet.add(u);
      }
    } catch {
      /* holdings 未作成時は空集合 */
    }

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

    /**
     * 重い Yahoo は次の銘柄のみ（`yahoo=minimal` ではスキップ）:
     * - DB の次回決算が掲載ウィンドウ内
     * - DB が null だが calendar プローブでウィンドウ内（保有はプローブ対象から欠かさない／その他は米国・JP 公平にサンプル）
     */
    const inWindowDbHeavy = new Map<string, TickerIn>();
    const nullDbForProbe = new Map<string, { ticker: string; providerSymbol: string | null; owned: boolean }>();
    for (const row of rows) {
      const isUnlisted = Number(row["is_unlisted"]) === 1;
      const ticker = String(row["ticker"] ?? "").trim();
      const proxy = row["proxy_ticker"] != null ? String(row["proxy_ticker"]).trim() : "";
      const eff = !isUnlisted ? ticker : proxy;
      if (eff.length === 0) continue;
      const dbYmd = ymdOrNull(row["next_earnings_date"]);
      const u = eff.toUpperCase();
      const entry: TickerIn = { ticker: eff, providerSymbol: null };
      const statusRaw = row["member_status"];
      const statusNorm = typeof statusRaw === "string" ? statusRaw.trim().toLowerCase() : "";
      const isOwnedRow = statusNorm === "owned" || holdingTickerSet.has(u);
      if (dbYmd != null && dbYmd >= startYmd && dbYmd <= endYmd) {
        if (!inWindowDbHeavy.has(u)) inWindowDbHeavy.set(u, entry);
      } else if (dbYmd == null) {
        const prev = nullDbForProbe.get(u);
        nullDbForProbe.set(u, {
          ticker: eff,
          providerSymbol: null,
          owned: Boolean(prev?.owned) || isOwnedRow,
        });
      }
    }

    let probeCandidates: TickerIn[] = [];
    if (useYahooFull) {
      probeCandidates = buildFairCalendarProbeCandidates(nullDbForProbe, new Set(inWindowDbHeavy.keys()));
    }

    let probeByUpper = new Map<string, string | null>();
    if (useYahooFull && probeCandidates.length > 0) {
      probeByUpper = await fetchKoyomiCalendarProbeMap(probeCandidates, { concurrency: 18, delayMs: 0 });
    }

    const heavySeen = new Set<string>(inWindowDbHeavy.keys());
    const researchInputs: TickerIn[] = [...inWindowDbHeavy.values()];
    if (useYahooFull) {
      for (const it of probeCandidates) {
        const u = it.ticker.toUpperCase();
        if (heavySeen.has(u)) continue;
        const ny = probeByUpper.get(u) ?? null;
        if (ny != null && ny >= startYmd && ny <= endYmd) {
          heavySeen.add(u);
          researchInputs.push(it);
        }
      }
    }

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

    const cumByKey = new Map<string, number | null>();
    if (includeCumCharts) {
      const cumSeen = new Set<string>();
      const cumTasks: { key: string; ticker: string; ymd: string }[] = [];
      for (const d of drafts) {
        if (d.ymd >= today) continue;
        const mu = muscleByTickerUpper.get(d.displayTicker.toUpperCase());
        if (!mu || mu.muscleDeltaStatus !== "positive") continue;
        const key = `${d.displayTicker.toUpperCase()}|${d.ymd}`;
        if (cumSeen.has(key)) continue;
        cumSeen.add(key);
        cumTasks.push({ key, ticker: d.displayTicker, ymd: d.ymd });
      }
      const cumRun = cumTasks.length > MAX_CUM_CHART_TASKS ? cumTasks.slice(0, MAX_CUM_CHART_TASKS) : cumTasks;
      const cumPairs = await mapWithConcurrency(cumRun, 16, async (t) => {
        const pct = await fetchChartCumulativeReturnPercentSinceEventYmd(t.ticker, null, t.ymd);
        return { key: t.key, pct };
      });
      for (const p of cumPairs) cumByKey.set(p.key, p.pct);
    }

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
      const retKey = `${tkU}|${d.ymd}`;
      const returnPctSinceEarnings = cumByKey.get(retKey) ?? null;
      const isMispriced =
        muscle.muscleDeltaStatus === "positive" &&
        returnPctSinceEarnings != null &&
        Number.isFinite(returnPctSinceEarnings) &&
        returnPctSinceEarnings <= MISPRICED_CUM_RETURN_SINCE_EARNINGS_PCT;
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
        regularMarketChangePercent: regularMarketChangeByUpper.get(tkU) ?? null,
        returnPctSinceEarnings,
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
