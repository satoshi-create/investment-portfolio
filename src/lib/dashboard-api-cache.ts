/** In-memory cache for GET /api/dashboard (per user). */

export type DashboardResponseJson = {
  userId: string;
  stocks: unknown[];
  allThemes: unknown[];
  signals: unknown[];
  structureByTheme: unknown[];
  structureBySector: unknown[];
  coreSatellite: unknown;
  totalMarketValue: number;
  summary: unknown;
  stale?: boolean;
};

type CacheEntry = { at: number; json: DashboardResponseJson };

const CACHE_TTL_MS = 30_000;

const cacheByUser = new Map<string, CacheEntry>();

export function getFreshDashboardCache(userId: string): DashboardResponseJson | null {
  const e = cacheByUser.get(userId) ?? null;
  if (!e) return null;
  if (Date.now() - e.at > CACHE_TTL_MS) return null;
  return e.json;
}

export function setDashboardCache(userId: string, json: DashboardResponseJson): void {
  cacheByUser.set(userId, { at: Date.now(), json });
}

/** Last cached payload regardless of TTL (used when live fetch times out). */
export function getRawDashboardCache(userId: string): CacheEntry | null {
  return cacheByUser.get(userId) ?? null;
}

export function invalidateDashboardCacheForUser(userId: string): void {
  cacheByUser.delete(userId);
}
