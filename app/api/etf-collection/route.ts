import { NextResponse } from "next/server";

import { defaultProfileUserId } from "@/src/lib/authorize-signals";
import { getDb, isDbConfigured } from "@/src/lib/db";
import { getEtfCollectionSnapshot } from "@/src/lib/etf-collection-data";

export const dynamic = "force-dynamic";

type EtfCollectionResponseJson = {
  userId: string;
  asOf: string;
  fxUsdJpy: number | null;
  etfs: unknown[];
  regionalMomentum: unknown[];
  stale?: boolean;
};

type CacheEntry = { at: number; json: EtfCollectionResponseJson };

const CACHE_TTL_MS = 30_000;
const SOFT_BUDGET_MS = 10_000;

const cacheByUser = new Map<string, CacheEntry>();
const inflightByUser = new Map<string, Promise<EtfCollectionResponseJson>>();

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
    if (hit) return NextResponse.json(hit.json, { headers: { "x-cache": "HIT" } });

    const inflight = inflightByUser.get(userId);
    if (inflight) {
      const json = await withTimeout(inflight, SOFT_BUDGET_MS);
      return NextResponse.json(json, { headers: { "x-cache": "JOIN" } });
    }

    const work = (async (): Promise<EtfCollectionResponseJson> => {
      const snap = await getEtfCollectionSnapshot(getDb(), userId);
      return {
        userId,
        asOf: snap.asOf,
        fxUsdJpy: snap.fxUsdJpy,
        etfs: snap.etfs as unknown[],
        regionalMomentum: snap.regionalMomentum as unknown[],
      };
    })();

    inflightByUser.set(userId, work);

    let json: EtfCollectionResponseJson;
    try {
      json = await withTimeout(work, SOFT_BUDGET_MS);
    } catch (e) {
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
    console.error("[api/etf-collection] failed", err);
    const payload: Record<string, unknown> = { error: err.message };
    if (process.env.NODE_ENV !== "production") payload.stack = err.stack ?? null;
    return NextResponse.json(payload, { status: 500 });
  }
}

