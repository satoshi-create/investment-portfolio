/**
 * Backfill `theme_ecosystem_members.is_compounding_ignited` using `alpha_history` only (close / DB フォールバック pulse)。
 * Live は API 側で再計算される。本バックフィルは物理カラムを埋めるためのベースライン。
 */
import type { Client } from "@libsql/client";

import {
  calculateCumulativeAlpha,
  defaultBenchmarkTickerForTicker,
  toYmd,
  type DatedAlphaRow,
} from "@/src/lib/alpha-logic";
import { classifyTickerInstrument } from "@/src/lib/alpha-logic";
import {
  benchmarkPctForInstrumentKind,
  computeCompoundingIgnitionFromAlphaSeries,
} from "@/src/lib/compounding-ignition";
import { resolveLiveAlphaBenchmarkContext } from "@/src/lib/dashboard-data";

export async function runEcosystemCompoundingIgnitionBackfill(
  db: Client,
  userId: string,
  options?: { memberLimit?: number },
): Promise<{ processed: number; ignitedCount: number }> {
  const liveAlphaCtx = await resolveLiveAlphaBenchmarkContext();
  const args: string[] = [userId];
  let sql = `SELECT m.id, m.ticker, m.is_unlisted, m.proxy_ticker, m.observation_started_at,
                     t.created_at AS theme_created_at
              FROM theme_ecosystem_members m
              INNER JOIN investment_themes t ON m.theme_id = t.id
              WHERE t.user_id = ?
              ORDER BY m.id ASC`;
  if (options?.memberLimit != null && Number.isFinite(options.memberLimit)) {
    sql += ` LIMIT ?`;
    args.push(String(Math.max(1, Math.floor(Number(options.memberLimit)))));
  }
  const rs = await db.execute({ sql, args });
  const rows = rs.rows as Record<string, unknown>[];

  let processed = 0;
  let ignitedCount = 0;

  for (const row of rows) {
    const id = String(row.id ?? "");
    const ticker = String(row.ticker ?? "").trim();
    const isUnlisted = Number(row.is_unlisted) === 1;
    const proxy = row.proxy_ticker != null ? String(row.proxy_ticker).trim() : "";
    const effectiveTicker = isUnlisted && proxy.length > 0 ? proxy : ticker;
    if (effectiveTicker.length === 0 || id.length === 0) continue;

    const observationStartedAt =
      row.observation_started_at != null && String(row.observation_started_at).trim().length >= 10
        ? String(row.observation_started_at).trim().slice(0, 10)
        : null;
    const themeCreatedAt =
      row.theme_created_at != null && String(row.theme_created_at).trim().length > 0
        ? String(row.theme_created_at).trim()
        : null;

    const benchTicker = defaultBenchmarkTickerForTicker(effectiveTicker);
    const histRs = await db.execute({
      sql: `SELECT alpha_value, close_price, recorded_at FROM alpha_history
            WHERE user_id = ? AND ticker = ? AND benchmark_ticker = ?
            ORDER BY recorded_at ASC`,
      args: [userId, effectiveTicker, benchTicker],
    });

    const byDay = new Map<string, number>();
    const closeByDay = new Map<string, number>();
    for (const r of histRs.rows) {
      const ra = r["recorded_at"];
      if (ra == null) continue;
      const ymd = String(ra).trim().slice(0, 10);
      if (ymd.length !== 10) continue;
      const av = Number(r["alpha_value"]);
      if (Number.isFinite(av)) byDay.set(ymd, av);
      const cp = r["close_price"];
      const cn = cp != null ? Number(cp) : NaN;
      if (Number.isFinite(cn) && cn > 0) closeByDay.set(ymd, cn);
    }

    let datedRows: DatedAlphaRow[] = [...byDay.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([recordedAt, alphaValue]) => ({ recordedAt, alphaValue }));

    const startDate =
      observationStartedAt != null && observationStartedAt.length === 10
        ? observationStartedAt
        : themeCreatedAt != null && themeCreatedAt.trim().length > 0
          ? themeCreatedAt.trim().slice(0, 10)
          : datedRows[0] != null
            ? toYmd(datedRows[0]!.recordedAt)
            : "1970-01-01";

    const cumPoints = calculateCumulativeAlpha(datedRows, startDate);
    const cumulativeAlphaOldestToNewest = cumPoints.map((p) => p.cumulative);
    const dailyAlphaOldestToNewest = datedRows.map((d) => d.alphaValue);
    const latestDailyAlphaObservationYmd =
      datedRows.length > 0 ? toYmd(datedRows[datedRows.length - 1]!.recordedAt) : null;

    const sortedDates = [...closeByDay.keys()].sort((a, b) => a.localeCompare(b));
    const lastCloseYmd = sortedDates.length > 0 ? sortedDates[sortedDates.length - 1]! : null;
    const prevCloseYmd = sortedDates.length > 1 ? sortedDates[sortedDates.length - 2]! : null;
    const fallbackLivePrice = lastCloseYmd != null ? closeByDay.get(lastCloseYmd) ?? null : null;
    const fallbackPreviousClose = prevCloseYmd != null ? closeByDay.get(prevCloseYmd) ?? null : null;

    const kind = classifyTickerInstrument(effectiveTicker);
    const benchPct = benchmarkPctForInstrumentKind(
      kind,
      liveAlphaCtx.usBenchmarkChangePct,
      liveAlphaCtx.jpBenchmarkChangePct,
    );

    const ign = computeCompoundingIgnitionFromAlphaSeries({
      dailyAlphaOldestToNewest,
      cumulativeAlphaOldestToNewest,
      latestDailyAlphaObservationYmd,
      hybrid: null,
      fallbackLivePrice,
      fallbackPreviousClose,
      benchmarkDayChangePercent: benchPct,
    });

    await db.execute({
      sql: `UPDATE theme_ecosystem_members SET is_compounding_ignited = ? WHERE id = ?`,
      args: [ign.isCompoundingIgnited ? 1 : 0, id],
    });
    processed += 1;
    if (ign.isCompoundingIgnited) ignitedCount += 1;
  }

  return { processed, ignitedCount };
}
