import { NextResponse } from "next/server";

import { defaultProfileUserId } from "@/src/lib/authorize-signals";
import { fetchUnresolvedSignalsForUser, getDashboardData } from "@/src/lib/dashboard-data";
import { getDb, isDbConfigured } from "@/src/lib/db";

export const dynamic = "force-dynamic";

type DashboardResponseJson = {
  userId: string;
  stocks: unknown[];
  allThemes: unknown[];
  signals: unknown[];
  structureByTheme: unknown[];
  structureBySector: unknown[];
  coreSatellite: unknown;
  totalMarketValue: number;
  summary: unknown;
  /** When returning cached snapshot under pressure */
  stale?: boolean;
};

type CacheEntry = { at: number; json: DashboardResponseJson };

const CACHE_TTL_MS = 30_000;
const SOFT_BUDGET_MS = 10_000;

const cacheByUser = new Map<string, CacheEntry>();
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

function cached(userId: string): CacheEntry | null {
  const e = cacheByUser.get(userId) ?? null;
  if (!e) return null;
  if (Date.now() - e.at > CACHE_TTL_MS) return null;
  return e;
}

export async function GET(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: "Database not configured", hint: "Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN" },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") ?? defaultProfileUserId();

  try {
    const hit = cached(userId);
    if (hit) {
      return NextResponse.json(hit.json, { headers: { "x-cache": "HIT" } });
    }

    const db = getDb();

    const inflight = inflightByUser.get(userId);
    if (inflight) {
      const json = await withTimeout(inflight, SOFT_BUDGET_MS);
      return NextResponse.json(json, { headers: { "x-cache": "JOIN" } });
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
        signals: signals as unknown[],
        structureByTheme: dash.structureByTheme as unknown[],
        structureBySector: dash.structureBySector as unknown[],
        coreSatellite: dash.coreSatellite as unknown,
        totalMarketValue: dash.totalMarketValue,
        summary: dash.summary as unknown,
      };
    })();

    inflightByUser.set(userId, work);

    let json: DashboardResponseJson;
    try {
      json = await withTimeout(work, SOFT_BUDGET_MS);
    } catch (e) {
      // Under heavy Yahoo/network slowness, return last known snapshot if any.
      const last = cacheByUser.get(userId) ?? null;
      if (last) {
        json = { ...last.json, stale: true };
        return NextResponse.json(json, { headers: { "x-cache": "STALE" } });
      }
      throw e;
    } finally {
      inflightByUser.delete(userId);
    }

    cacheByUser.set(userId, { at: Date.now(), json });
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
