import type { ThemeEcosystemWatchItem } from "@/src/types/investment";

export function appendTitleBlock(base: string | undefined, block: string | undefined): string | undefined {
  if (block == null || block.length === 0) return base;
  if (base == null || base.length === 0) return block;
  return `${base}\n\n${block}`;
}

/** 日次 Alpha 系列のホバー用テキスト（観測日付き・末尾 maxRows 件） */
export function formatDailyAlphaStoryTitle(
  dates: readonly string[],
  dailyAlphas: readonly number[],
  opts?: { maxRows?: number; header?: string },
): string | undefined {
  if (dailyAlphas.length === 0) return undefined;
  const maxRows = Math.min(opts?.maxRows ?? 14, dailyAlphas.length);
  const start = Math.max(0, dailyAlphas.length - maxRows);
  const dated = dates.length === dailyAlphas.length && dates.length > 0;
  const lines: string[] = [];
  for (let i = start; i < dailyAlphas.length; i += 1) {
    const pct = dailyAlphas[i]!;
    if (!Number.isFinite(pct)) continue;
    const label = dated ? `${dates[i]!}  ` : `#${i + 1}  `;
    lines.push(`${label}${pct > 0 ? "+" : ""}${pct.toFixed(2)}%`);
  }
  if (lines.length === 0) return undefined;
  const header = opts?.header ?? "日次 Alpha（直近）";
  const range = dated ? `${dates[start]!} … ${dates[dailyAlphas.length - 1]!}` : `末尾 ${lines.length} 点（観測日は未取得）`;
  return `${header}\n${range}\n${lines.join("\n")}`;
}

/** 累積 Alpha 系列のホバー用テキスト */
export function formatCumulativeAlphaStoryTitle(
  dates: readonly string[],
  cumulative: readonly number[],
  opts?: { maxRows?: number },
): string | undefined {
  if (cumulative.length === 0) return undefined;
  const maxRows = Math.min(opts?.maxRows ?? 14, cumulative.length);
  const start = Math.max(0, cumulative.length - maxRows);
  const dated = dates.length === cumulative.length && dates.length > 0;
  const lines: string[] = [];
  for (let i = start; i < cumulative.length; i += 1) {
    const pct = cumulative[i]!;
    if (!Number.isFinite(pct)) continue;
    const label = dated ? `${dates[i]!}  ` : `#${i + 1}  `;
    lines.push(`${label}累積 ${pct > 0 ? "+" : ""}${pct.toFixed(2)}%`);
  }
  if (lines.length === 0) return undefined;
  const title = dated
    ? `累積 Alpha（${dates[start]!}〜${dates[dates.length - 1]!}）`
    : `累積 Alpha（末尾 ${lines.length} 点・観測日は未取得）`;
  return `${title}\n${lines.join("\n")}`;
}

export function holdingDailyAlphaStoryTitle(
  dates: readonly string[] | undefined,
  dailyAlphas: readonly number[],
): string | undefined {
  return formatDailyAlphaStoryTitle(dates ?? [], dailyAlphas, {
    maxRows: 14,
    header: "確定日次 Alpha（観測日・直近）",
  });
}

export function ecosystemCumulativeSparklineTooltip(e: ThemeEcosystemWatchItem): string | undefined {
  return formatCumulativeAlphaStoryTitle(
    e.alphaCumulativeObservationDates ?? [],
    e.alphaHistory,
    { maxRows: 14 },
  );
}

/** テーマ表の「累積 Alpha」セル（数値のみの行）向け */
export function ecosystemMappedAlphaCellTooltip(e: ThemeEcosystemWatchItem): string | undefined {
  const cum = formatCumulativeAlphaStoryTitle(
    e.alphaCumulativeObservationDates ?? [],
    e.alphaHistory,
    { maxRows: 12 },
  );
  const daily = formatDailyAlphaStoryTitle(
    e.alphaDailyObservationDates ?? [],
    e.alphaDailyHistory,
    { maxRows: 10, header: "日次 Alpha（観測日・直近）" },
  );
  return appendTitleBlock(
    appendTitleBlock("累積 Alpha（%）= 観測起点からの累積。日次は別系列。", cum),
    daily,
  );
}

/** ウォッチリスト行（累積数値＋日次ミニチャート）向け */
export function ecosystemWatchlistAlphaCellTooltip(e: ThemeEcosystemWatchItem): string | undefined {
  const base =
    "上段: 累積 Alpha（%）。下のミニチャート: 直近日次 Alpha（本日はライブ連動で暫定になり得ます）。";
  const cum = formatCumulativeAlphaStoryTitle(
    e.alphaCumulativeObservationDates ?? [],
    e.alphaHistory,
    { maxRows: 10 },
  );
  const daily = formatDailyAlphaStoryTitle(
    e.alphaDailyObservationDates ?? [],
    e.alphaDailyHistory,
    { maxRows: 10, header: "日次 Alpha（観測日・直近）" },
  );
  return appendTitleBlock(appendTitleBlock(base, cum), daily);
}
