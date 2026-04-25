import type { Client } from "@libsql/client";

import {
  fetchEquityResearchSnapshots,
  fetchYahooInstrumentMetadata,
  type EquityResearchSnapshot,
} from "@/src/lib/price-service";

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
 * テーマ側は上場 `ticker` 一致、または未上場で `proxy_ticker` が一致する行を対象にする。
 */
const THEME_MEMBER_YAHOO_TICKER_MATCH_SQL = `(
  UPPER(TRIM(m.ticker)) = ?
  OR (COALESCE(m.is_unlisted, 0) = 1 AND LENGTH(TRIM(COALESCE(m.proxy_ticker, ''))) > 0 AND UPPER(TRIM(m.proxy_ticker)) = ?)
)`;

async function userTickerNeedsListingPriceBackfill(db: Client, userId: string, tickerUpper: string): Promise<boolean> {
  const r = await db.execute({
    sql: `SELECT
            (SELECT COUNT(*) FROM holdings
             WHERE user_id = ? AND UPPER(TRIM(ticker)) = ?
               AND (listing_price IS NULL OR listing_price <= 0))
          + (SELECT COUNT(*) FROM theme_ecosystem_members m
             INNER JOIN investment_themes th ON m.theme_id = th.id
             WHERE th.user_id = ? AND ${THEME_MEMBER_YAHOO_TICKER_MATCH_SQL.replace(/\n\s*/g, " ")}
               AND (m.listing_price IS NULL OR m.listing_price <= 0))
          AS need_lp`,
    args: [userId, tickerUpper, userId, tickerUpper, tickerUpper],
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
  /** Yahoo quoteSummary 由来の配当・決算カレンダー列の同期（055 マイグレーション後） */
  yahooResearchOk?: boolean;
  yahooResearchSyncedAt?: string | null;
  yahooResearchError?: string;
  error?: string;
};

/**
 * Yahoo `quoteSummary` のリサーチ指標を holdings / theme_ecosystem_members に書き込む。
 * 既存の非 null 値は COALESCE で保持（手入力の next_earnings_date 等は上書きしない）。
 */
export async function syncYahooEquityResearchForTicker(
  db: Client,
  userId: string,
  ticker: string,
  providerSymbol?: string | null,
): Promise<{
  ok: boolean;
  syncedAt: string | null;
  snapshot?: EquityResearchSnapshot | null;
  error?: string;
}> {
  const t = ticker.trim().toUpperCase();
  if (t.length === 0) return { ok: false, syncedAt: null, error: "ticker required" };
  const syncedAt = isoSyncNow();
  let snap: EquityResearchSnapshot | null;
  try {
    const m = await fetchEquityResearchSnapshots([{ ticker: t, providerSymbol: providerSymbol ?? null }], {
      concurrency: 1,
      batchDelayMs: 0,
    });
    snap = m.get(t) ?? null;
  } catch (e) {
    return { ok: false, syncedAt: null, error: e instanceof Error ? e.message : String(e) };
  }
  if (snap == null) return { ok: false, syncedAt: null, error: "Yahoo quoteSummary returned no snapshot." };

  const ne = snap.nextEarningsDate;
  const ex = snap.exDividendDate;
  const rec = snap.recordDate;
  const adr = snap.annualDividendRate;
  const dy = snap.dividendYieldPercent;

  try {
    await db.execute({
      sql: `UPDATE holdings
            SET next_earnings_date = COALESCE(next_earnings_date, ?),
                ex_dividend_date = COALESCE(ex_dividend_date, ?),
                record_date = COALESCE(record_date, ?),
                annual_dividend_rate = COALESCE(annual_dividend_rate, ?),
                dividend_yield_percent = COALESCE(dividend_yield_percent, ?),
                yahoo_research_synced_at = ?
            WHERE user_id = ? AND UPPER(TRIM(ticker)) = ?`,
      args: [ne, ex, rec, adr, dy, syncedAt, userId, t],
    });
    await db.execute({
      sql: `UPDATE theme_ecosystem_members
            SET next_earnings_date = COALESCE(next_earnings_date, ?),
                ex_dividend_date = COALESCE(ex_dividend_date, ?),
                record_date = COALESCE(record_date, ?),
                annual_dividend_rate = COALESCE(annual_dividend_rate, ?),
                dividend_yield_percent = COALESCE(dividend_yield_percent, ?),
                yahoo_research_synced_at = ?
            WHERE id IN (
              SELECT m.id FROM theme_ecosystem_members m
              INNER JOIN investment_themes th ON m.theme_id = th.id
              WHERE th.user_id = ? AND ${THEME_MEMBER_YAHOO_TICKER_MATCH_SQL.replace(/\n\s*/g, " ")}
            )`,
      args: [ne, ex, rec, adr, dy, syncedAt, userId, t, t],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const low = msg.toLowerCase();
    if (low.includes("no such column") && low.includes("ex_dividend_date")) {
      return {
        ok: false,
        syncedAt: null,
        error: "DB に Yahoo リサーチ列がありません。migrations/055_yahoo_equity_research_columns.sql を適用してください。",
      };
    }
    throw e;
  }
  return { ok: true, syncedAt, snapshot: snap };
}

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
              WHERE th.user_id = ? AND ${THEME_MEMBER_YAHOO_TICKER_MATCH_SQL.replace(/\n\s*/g, " ")}
            )`,
      args: [meta.listingDate, meta.marketCap, meta.listingPrice, syncedAt, userId, t, t],
    });
    const research = await syncYahooEquityResearchForTicker(db, userId, ticker, providerSymbol ?? null);
    return {
      ok: true,
      listingDate: meta.listingDate,
      marketCap: meta.marketCap,
      listingPrice: meta.listingPrice,
      yahooResearchOk: research.ok,
      yahooResearchSyncedAt: research.syncedAt,
      yahooResearchError: research.ok ? undefined : research.error,
    };
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
