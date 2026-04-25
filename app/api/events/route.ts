import { NextResponse } from "next/server";

import { defaultProfileUserId } from "@/src/lib/authorize-signals";
import { getDb, isDbConfigured } from "@/src/lib/db";
import { fetchEquityResearchSnapshots, type EquityResearchSnapshot } from "@/src/lib/price-service";
import type { MarketEventRecord } from "@/src/types/market-events";

export const dynamic = "force-dynamic";

function parseEventDateToIsoZ(raw: unknown): string {
  const s = raw != null ? String(raw).trim() : "";
  const ymd = s.length >= 10 ? s.slice(0, 10) : "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    return `${ymd}T00:00:00.000Z`;
  }
  return s.length > 0 ? s : "";
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

/**
 * `market_events`（マクロ等）＋ユーザーのテーマウォッチ `theme_ecosystem_members` の決算予定（ウィンドウ内）。
 * ウォッチは DB `next_earnings_date` に加え、テーマ表と同様に Yahoo リサーチで補完する。
 * 保有（holdings）の合成はクライアントが `/api/dashboard` と併用する。
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
  /**
   * `watchResearch=0` のときテーマウォッチは DB の `next_earnings_date` のみ（Yahoo 省略）。
   * カレンダー初回表示を速くし、フルはクライアントが後続フェッチする。
   */
  const watchResearch =
    searchParams.get("watchResearch") !== "0" && searchParams.get("watchResearch") !== "false";

  try {
    const db = getDb();
    const rs = await db.execute({
      sql: `SELECT id, event_date, title, category, importance, description
            FROM market_events
            WHERE date(event_date) >= date('now', '-5 days')
              AND date(event_date) <= date('now', '+70 days')
            ORDER BY event_date ASC, importance DESC, title ASC`,
    });
    const macroRows = rs.rows as Record<string, unknown>[];
    const macroEvents: MarketEventRecord[] = macroRows.map((row) => ({
      id: String(row["id"]),
      event_date: parseEventDateToIsoZ(row["event_date"]),
      title: String(row["title"] ?? ""),
      category: String(row["category"] ?? ""),
      importance: Number(row["importance"] ?? 0),
      description: row["description"] != null ? String(row["description"]) : null,
      source: "macro",
    }));

    let watchlistEvents: MarketEventRecord[] = [];
    try {
      const wr = await db.execute({
        sql: `SELECT m.id AS member_id, m.ticker, m.is_unlisted, m.proxy_ticker, m.company_name, m.next_earnings_date, m.ex_dividend_date, t.name AS theme_name
              FROM theme_ecosystem_members m
              INNER JOIN investment_themes t ON m.theme_id = t.id
              WHERE t.user_id = ?
              ORDER BY m.ticker ASC`,
        args: [userId],
      });
      const rows = wr.rows as Record<string, unknown>[];
      const researchInputs: { ticker: string; providerSymbol: string | null }[] = [];
      const seenUpper = new Set<string>();
      for (const row of rows) {
        const isUnlisted = Number(row["is_unlisted"]) === 1;
        const ticker = String(row["ticker"] ?? "").trim();
        const proxy = row["proxy_ticker"] != null ? String(row["proxy_ticker"]).trim() : "";
        const eff = !isUnlisted ? ticker : proxy;
        if (eff.length === 0) continue;
        const u = eff.toUpperCase();
        if (seenUpper.has(u)) continue;
        seenUpper.add(u);
        researchInputs.push({ ticker: eff, providerSymbol: null });
      }

      let researchMap = new Map<string, EquityResearchSnapshot>();
      if (watchResearch && researchInputs.length > 0) {
        try {
          researchMap = await fetchEquityResearchSnapshots(researchInputs, { concurrency: 6, batchDelayMs: 40 });
        } catch {
          researchMap = new Map();
        }
      }

      const winStart = ymdAddDaysUtc(utcTodayYmd(), -5);
      const winEnd = ymdAddDaysUtc(utcTodayYmd(), 70);

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

        const company = row["company_name"] != null ? String(row["company_name"]).trim() : "";
        const themeName = row["theme_name"] != null ? String(row["theme_name"]).trim() : "";
        const descParts = [themeName.length > 0 ? `テーマ: ${themeName}` : null, company.length > 0 ? company : null].filter(
          Boolean,
        ) as string[];
        if (effectiveYmd != null && effectiveYmd >= winStart && effectiveYmd <= winEnd) {
          watchlistEvents.push({
            id: `watchlist:${memberId}:earnings:${effectiveYmd}`,
            event_date: `${effectiveYmd}T00:00:00.000Z`,
            title: themeName.length > 0 ? `[${themeName}] ${ticker} 決算` : `${ticker} 決算`,
            category: "Earnings",
            importance: 2,
            description: descParts.length > 0 ? descParts.join(" · ") : null,
            source: "watchlist",
          });
        }

        const dbExYmd = ymdOrNull(row["ex_dividend_date"]);
        const resExYmd =
          snap?.exDividendDate != null && snap.exDividendDate.trim().length >= 10
            ? snap.exDividendDate.trim().slice(0, 10)
            : null;
        const effectiveExYmd =
          dbExYmd ?? (resExYmd != null && /^\d{4}-\d{2}-\d{2}$/.test(resExYmd) ? resExYmd : null);
        if (effectiveExYmd != null && effectiveExYmd >= winStart && effectiveExYmd <= winEnd) {
          watchlistEvents.push({
            id: `watchlist:${memberId}:exdiv:${effectiveExYmd}`,
            event_date: `${effectiveExYmd}T00:00:00.000Z`,
            title: themeName.length > 0 ? `[${themeName}] ${ticker} 権利落ち` : `${ticker} 権利落ち`,
            category: "ExDividend",
            importance: 1,
            description: descParts.length > 0 ? descParts.join(" · ") : null,
            source: "watchlist",
          });
        }
      }
    } catch (we) {
      const wmsg = we instanceof Error ? we.message : String(we);
      const low = wmsg.toLowerCase();
      if (
        !low.includes("no such table") &&
        !low.includes("theme_ecosystem_members") &&
        !low.includes("investment_themes") &&
        !low.includes("no such column")
      ) {
        throw we;
      }
    }

    const events = [...macroEvents, ...watchlistEvents].sort(
      (a, b) => a.event_date.localeCompare(b.event_date) || b.importance - a.importance,
    );

    return NextResponse.json({ events });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("no such table") || msg.toLowerCase().includes("market_events")) {
      return NextResponse.json({ events: [] as MarketEventRecord[] });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
