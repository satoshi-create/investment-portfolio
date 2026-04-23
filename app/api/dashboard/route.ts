import { NextResponse } from "next/server";

import { defaultProfileUserId } from "@/src/lib/authorize-signals";
import {
  getFreshDashboardCache,
  getRawDashboardCache,
  setDashboardCache,
  type DashboardResponseJson,
} from "@/src/lib/dashboard-api-cache";
import { fetchUnresolvedSignalsForUser, getDashboardData } from "@/src/lib/dashboard-data";
import { getDb, isDbConfigured } from "@/src/lib/db";

export const dynamic = "force-dynamic";

/** Yahoo/DB が重いと 10s で誤タイムアウトしやすいため既定を緩める。`.env`: `DASHBOARD_SOFT_BUDGET_MS` */
function resolveDashboardSoftBudgetMs(): number {
  const raw = process.env.DASHBOARD_SOFT_BUDGET_MS?.trim();
  if (!raw) return 45_000;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 45_000;
  return Math.min(180_000, Math.max(8_000, Math.floor(n)));
}

const inflightByUser = new Map<string, Promise<DashboardResponseJson>>();

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  if (!Number.isFinite(ms) || ms <= 0) return p;
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(id);
        resolve(v);
      },
      (e) => {
        clearTimeout(id);
        reject(e);
      },
    );
  });
}

export async function GET(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: "Database not configured", hint: "Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN" },
      { status: 503 },
    );
  }

  const softBudgetMs = resolveDashboardSoftBudgetMs();

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") ?? defaultProfileUserId();

  try {
    const hit = getFreshDashboardCache(userId);
    if (hit) {
      return NextResponse.json(hit, { headers: { "x-cache": "HIT" } });
    }

    const db = getDb();

    const inflight = inflightByUser.get(userId);
    if (inflight) {
      try {
        const json = await withTimeout(inflight, softBudgetMs);
        return NextResponse.json(json, { headers: { "x-cache": "JOIN" } });
      } catch (e) {
        const last = getRawDashboardCache(userId);
        if (last) {
          return NextResponse.json({ ...last.json, stale: true }, { headers: { "x-cache": "STALE" } });
        }
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("timeout after")) {
          return NextResponse.json(
            {
              error: "Dashboard build timed out",
              hint: "Retry shortly, or raise DASHBOARD_SOFT_BUDGET_MS (default 45000).",
              timeoutMs: softBudgetMs,
            },
            { status: 503, headers: { "retry-after": "5" } },
          );
        }
        throw e;
      }
    }

    const work = (async (): Promise<DashboardResponseJson> => {
      const [dash, signals] = await Promise.all([
        getDashboardData(db, userId),
        fetchUnresolvedSignalsForUser(db, userId),
      ]);
      return {
        userId,
        stocks: dash.stocks as unknown[],
        allThemes: dash.allThemes as unknown[],
        themeStructuralSparklines: dash.themeStructuralSparklines as unknown[],
        signals: signals as unknown[],
        structureByTheme: dash.structureByTheme as unknown[],
        structureBySector: dash.structureBySector as unknown[],
        coreSatellite: dash.coreSatellite as unknown,
        totalMarketValue: dash.totalMarketValue,
        summary: dash.summary as unknown,
        ecosystemWatchlistSearch: dash.ecosystemWatchlistSearch as unknown[],
      };
    })();

    inflightByUser.set(userId, work);

    let json: DashboardResponseJson;
    try {
      json = await withTimeout(work, softBudgetMs);
    } catch (e) {
      // Under heavy Yahoo/network slowness, return last known snapshot if any.
      const last = getRawDashboardCache(userId);
      if (last) {
        json = { ...last.json, stale: true };
        return NextResponse.json(json, { headers: { "x-cache": "STALE" } });
      }
      const msg = e instanceof Error ? e.message : String(e);
      const isTimeout = msg.includes("timeout after");
      if (isTimeout) {
        return NextResponse.json(
          {
            error: "Dashboard build timed out",
            hint: "Retry shortly, or raise DASHBOARD_SOFT_BUDGET_MS (default 45000).",
            timeoutMs: softBudgetMs,
          },
          { status: 503, headers: { "retry-after": "5" } },
        );
      }
      throw e;
    } finally {
      inflightByUser.delete(userId);
    }

    setDashboardCache(userId, json);
    return NextResponse.json(json, { headers: { "x-cache": "MISS" } });
  } catch (e) {
    const err = e instanceof Error ? e : new Error("Unknown error");
    console.error("[api/dashboard] failed", err);
    const payload: Record<string, unknown> = { error: err.message };
    if (process.env.NODE_ENV !== "production") {
      payload.stack = err.stack ?? null;
    }
    return NextResponse.json(payload, { status: 500 });
  }
}
