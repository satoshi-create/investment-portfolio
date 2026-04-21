import type { Client } from "@libsql/client";

import { fetchYahooInstrumentMetadata } from "@/src/lib/price-service";

/** メタ同期の再取得間隔（日） */
const METADATA_STALE_DAYS = 30;

function parseIsoDatePrefix(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  return s.length >= 10 ? s.slice(0, 10) : null;
}

function syncedAtStale(syncedAtRaw: unknown): boolean {
  const s = syncedAtRaw != null ? String(syncedAtRaw).trim() : "";
  if (s.length < 10) return true;
  const t = Date.parse(s.length >= 19 ? s : `${s.slice(0, 10)}T00:00:00.000Z`);
  if (!Number.isFinite(t)) return true;
  return Date.now() - t > METADATA_STALE_DAYS * 86400000;
}

/**
 * Yahoo で欠損補完が必要か。listing_date / market_cap が無い、または同期が古い。
 */
export function needsInstrumentMetadataSync(
  listingDate: unknown,
  marketCap: unknown,
  instrumentMetaSyncedAt: unknown,
): boolean {
  const ld = parseIsoDatePrefix(listingDate);
  if (ld == null) return true;
  const mc = marketCap != null ? Number(marketCap) : NaN;
  if (!Number.isFinite(mc) || mc <= 0) return true;
  return syncedAtStale(instrumentMetaSyncedAt);
}

function isoSyncNow(): string {
  return new Date().toISOString();
}

/** `listing_price` が未設定または無効なら Yahoo チャートで補完の対象にする */
function listingPriceNeedsBackfill(raw: unknown): boolean {
  if (raw == null) return true;
  const n = Number(raw);
  return !Number.isFinite(n) || n <= 0;
}

/**
 * 保有またはテーマエコシステムのいずれかで `listing_price` 欠損があるときのみチャート取得する。
 */
async function userTickerNeedsListingPriceBackfill(db: Client, userId: string, tickerUpper: string): Promise<boolean> {
  const r = await db.execute({
    sql: `SELECT
            (SELECT COUNT(*) FROM holdings
             WHERE user_id = ? AND UPPER(TRIM(ticker)) = ?
               AND (listing_price IS NULL OR listing_price <= 0))
          + (SELECT COUNT(*) FROM theme_ecosystem_members m
             INNER JOIN investment_themes th ON m.theme_id = th.id
             WHERE th.user_id = ? AND UPPER(TRIM(m.ticker)) = ?
               AND (m.listing_price IS NULL OR m.listing_price <= 0))
          AS need_lp`,
    args: [userId, tickerUpper, userId, tickerUpper],
  });
  const row = r.rows[0] as Record<string, unknown> | undefined;
  const v = row?.need_lp ?? row?.["need_lp"];
  const n = typeof v === "bigint" ? Number(v) : Number(v);
  return Number.isFinite(n) && n > 0;
}

/**
 * テーマのエコシステム行について、欠損・古いメタだけ Yahoo で補い DB を更新し、メモリ上の row も更新する。
 */
export async function prefetchThemeEcosystemInstrumentMetadata(
  db: Client,
  userId: string,
  themeId: string,
  rows: Record<string, unknown>[],
  options?: { fast?: boolean },
): Promise<void> {
  if (options?.fast === true || rows.length === 0) return;

  const tickersNeeding = new Set<string>();
  const fetchListingPriceByTicker = new Map<string, boolean>();
  for (const row of rows) {
    if (Number(row["is_unlisted"]) === 1) continue;
    const tk = String(row["ticker"] ?? "").trim().toUpperCase();
    if (!tk) continue;
    const needsMeta = needsInstrumentMetadataSync(
      row["listing_date"] ?? row["founded_date"],
      row["market_cap"],
      row["instrument_meta_synced_at"],
    );
    const needsLp = listingPriceNeedsBackfill(row["listing_price"]);
    if (!needsMeta && !needsLp) continue;
    tickersNeeding.add(tk);
    if (needsLp) fetchListingPriceByTicker.set(tk, true);
  }
  if (tickersNeeding.size === 0) return;

  const syncedAt = isoSyncNow();

  for (const ticker of tickersNeeding) {
    const fetchLp = fetchListingPriceByTicker.get(ticker) === true;
    const meta = await fetchYahooInstrumentMetadata(ticker, null, { fetchListingPrice: fetchLp });
    await db.execute({
      sql: `UPDATE theme_ecosystem_members
            SET listing_date = COALESCE(?, listing_date),
                market_cap = COALESCE(?, market_cap),
                listing_price = COALESCE(?, listing_price),
                instrument_meta_synced_at = ?
            WHERE theme_id = ? AND UPPER(TRIM(ticker)) = ?`,
      args: [meta.listingDate, meta.marketCap, meta.listingPrice, syncedAt, themeId, ticker],
    });
    for (const row of rows) {
      if (Number(row["is_unlisted"]) === 1) continue;
      const rt = String(row["ticker"] ?? "").trim().toUpperCase();
      if (rt !== ticker) continue;
      if (meta.listingDate != null) row["listing_date"] = meta.listingDate;
      if (meta.marketCap != null) row["market_cap"] = meta.marketCap;
      if (meta.listingPrice != null) row["listing_price"] = meta.listingPrice;
      row["instrument_meta_synced_at"] = syncedAt;
    }
  }
}

/**
 * 保有行について欠損・古いメタを Yahoo で補完（Lazy）。
 */
export async function prefetchHoldingsInstrumentMetadata(
  db: Client,
  userId: string,
  rows: Record<string, unknown>[],
  options?: { fast?: boolean },
): Promise<void> {
  if (options?.fast === true || rows.length === 0) return;

  const tickersNeeding = new Set<string>();
  const fetchListingPriceByTicker = new Map<string, boolean>();
  for (const row of rows) {
    const tk = String(row["ticker"] ?? "").trim().toUpperCase();
    if (!tk) continue;
    const needsMeta = needsInstrumentMetadataSync(
      row["listing_date"] ?? row["founded_date"],
      row["market_cap"],
      row["instrument_meta_synced_at"],
    );
    const needsLp = listingPriceNeedsBackfill(row["listing_price"]);
    if (!needsMeta && !needsLp) continue;
    tickersNeeding.add(tk);
    if (needsLp) fetchListingPriceByTicker.set(tk, true);
  }
  if (tickersNeeding.size === 0) return;

  const syncedAt = isoSyncNow();

  for (const ticker of tickersNeeding) {
    const provider =
      rowProviderForTicker(rows, ticker);
    const fetchLp = fetchListingPriceByTicker.get(ticker) === true;
    const meta = await fetchYahooInstrumentMetadata(ticker, provider, { fetchListingPrice: fetchLp });
    await db.execute({
      sql: `UPDATE holdings
            SET listing_date = COALESCE(?, listing_date),
                market_cap = COALESCE(?, market_cap),
                listing_price = COALESCE(?, listing_price),
                instrument_meta_synced_at = ?
            WHERE user_id = ? AND UPPER(TRIM(ticker)) = ?`,
      args: [meta.listingDate, meta.marketCap, meta.listingPrice, syncedAt, userId, ticker],
    });
    for (const row of rows) {
      const rt = String(row["ticker"] ?? "").trim().toUpperCase();
      if (rt !== ticker) continue;
      if (meta.listingDate != null) row["listing_date"] = meta.listingDate;
      if (meta.marketCap != null) row["market_cap"] = meta.marketCap;
      if (meta.listingPrice != null) row["listing_price"] = meta.listingPrice;
      row["instrument_meta_synced_at"] = syncedAt;
    }
  }
}

function rowProviderForTicker(rows: Record<string, unknown>[], tickerUpper: string): string | null {
  for (const row of rows) {
    const rt = String(row["ticker"] ?? "").trim().toUpperCase();
    if (rt !== tickerUpper) continue;
    const p = row["provider_symbol"];
    return p != null && String(p).trim().length > 0 ? String(p).trim() : null;
  }
  return null;
}

export type SyncStockMetadataResult = {
  ok: boolean;
  listingDate: string | null;
  marketCap: number | null;
  listingPrice: number | null;
  error?: string;
};

/**
 * ティッカー単位で Yahoo からメタを取得し、該当ユーザーの `holdings` と `theme_ecosystem_members` を更新。
 */
export async function syncStockMetadata(
  db: Client,
  userId: string,
  ticker: string,
  providerSymbol?: string | null,
): Promise<SyncStockMetadataResult> {
  const t = ticker.trim().toUpperCase();
  if (t.length === 0)
    return { ok: false, listingDate: null, marketCap: null, listingPrice: null, error: "ticker required" };

  const fetchLp = await userTickerNeedsListingPriceBackfill(db, userId, t);
  const meta = await fetchYahooInstrumentMetadata(ticker, providerSymbol ?? null, { fetchListingPrice: fetchLp });
  const syncedAt = isoSyncNow();

  try {
    await db.execute({
      sql: `UPDATE holdings
            SET listing_date = COALESCE(?, listing_date),
                market_cap = COALESCE(?, market_cap),
                listing_price = COALESCE(?, listing_price),
                instrument_meta_synced_at = ?
            WHERE user_id = ? AND UPPER(TRIM(ticker)) = ?`,
      args: [meta.listingDate, meta.marketCap, meta.listingPrice, syncedAt, userId, t],
    });
    await db.execute({
      sql: `UPDATE theme_ecosystem_members
            SET listing_date = COALESCE(?, listing_date),
                market_cap = COALESCE(?, market_cap),
                listing_price = COALESCE(?, listing_price),
                instrument_meta_synced_at = ?
            WHERE id IN (
              SELECT m.id FROM theme_ecosystem_members m
              INNER JOIN investment_themes th ON m.theme_id = th.id
              WHERE th.user_id = ? AND UPPER(TRIM(m.ticker)) = ?
            )`,
      args: [meta.listingDate, meta.marketCap, meta.listingPrice, syncedAt, userId, t],
    });
    return { ok: true, listingDate: meta.listingDate, marketCap: meta.marketCap, listingPrice: meta.listingPrice };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      listingDate: meta.listingDate,
      marketCap: meta.marketCap,
      listingPrice: meta.listingPrice,
      error: msg,
    };
  }
}
