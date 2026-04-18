/**
 * US equity session calendar helpers (NYSE-style weekend handling only; holidays not modeled).
 */

/** `America/New_York` の暦日 YYYY-MM-DD。 */
export function nyWallCalendarYmd(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

function nyWeekdayShort(now: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
  }).format(now);
}

/**
 * NY 現地で「直近完了した通常取引セッション」の暦日（土日なら金曜に戻す）。
 * Alpha の観測日がこれより古いとき stale の目安。
 */
export function lastCompletedNyseSessionCalendarYmd(now = new Date()): string {
  let t = new Date(now.getTime());
  for (let i = 0; i < 10; i++) {
    const wd = nyWeekdayShort(t);
    if (wd !== "Sat" && wd !== "Sun") {
      return nyWallCalendarYmd(t);
    }
    t = new Date(t.getTime() - 86400000);
  }
  return nyWallCalendarYmd(now);
}

/** 単一観測日を「NY · Mon 4/17 Close」形式で表示（銘柄の session date は Yahoo ベース）。 */
export function formatAlphaObservationNyCloseLabel(ymd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  const [yy, mm, dd] = ymd.split("-").map((x) => Number(x));
  const utcNoon = new Date(Date.UTC(yy, mm - 1, dd, 12, 0, 0));
  const wd = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "America/New_York" }).format(utcNoon);
  const md = new Intl.DateTimeFormat("en-US", {
    month: "numeric",
    day: "numeric",
    timeZone: "America/New_York",
  }).format(utcNoon);
  return `NY ${wd} ${md} Close`;
}

/** Portfolio avg Alpha 用: 銘柄間で観測日がずれるときはレンジ表示。 */
export function formatPortfolioAvgAlphaAsOfDisplay(
  stalestLatestObservationYmd: string | null,
  freshestLatestObservationYmd: string | null,
): string | null {
  if (stalestLatestObservationYmd == null && freshestLatestObservationYmd == null) return null;
  const a = stalestLatestObservationYmd ?? freshestLatestObservationYmd;
  const b = freshestLatestObservationYmd ?? stalestLatestObservationYmd;
  if (a == null || b == null) return null;
  if (a === b) return `${formatAlphaObservationNyCloseLabel(a)} · vs VOO daily α`;
  return `${formatAlphaObservationNyCloseLabel(a)} … ${formatAlphaObservationNyCloseLabel(b)} · blended latest-α dates`;
}
