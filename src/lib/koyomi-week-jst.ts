/**
 * Koyomi: **Asia/Tokyo 暦日**の今週（月曜 0:00〜日曜 23:59:59 を 7 つの YYYY-MM-DD で表す）。
 * UTC 週（isoWeek 相当の UTC 版）とは境目がずれるため、Koyomi API / UI では本モジュールのみを使う。
 *
 * 加算は正午 JST アンカー（+09:00）で行い、サマータイム非適用地帯の暦日ずれを避ける。
 */

const TZ = "Asia/Tokyo";

const JST_WK = new Map<string, number>([
  ["Monday", 0],
  ["Tuesday", 1],
  ["Wednesday", 2],
  ["Thursday", 3],
  ["Friday", 4],
  ["Saturday", 5],
  ["Sunday", 6],
]);

const fmtYmdJst = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const fmtWeekdayJst = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "long" });

/** 現在日付（JST, YYYY-MM-DD）。`startYmd`…`endYmd` の人間向け「今日」ラベルと、今日列ハイライトに使用。 */
export function jstTodayYmd(): string {
  return fmtYmdJst.format(new Date());
}

function atNoonJst(ymd: string): Date {
  const s = ymd.length >= 10 ? ymd.slice(0, 10) : jstTodayYmd();
  return new Date(`${s}T12:00:00+09:00`);
}

/**
 * 暦日 `ymd` を JST として 1 日加算。`ymd` は 10 文字想定、不正時は JST 今日にフォールバック。
 */
export function ymdAddDaysJst(ymd: string, deltaDays: number): string {
  const base = ymd.length >= 10 ? ymd.slice(0, 10) : jstTodayYmd();
  const ms = atNoonJst(base).getTime() + Math.trunc(deltaDays) * 86_400_000;
  return fmtYmdJst.format(new Date(ms));
}

function weekdayJstMon0(ymd: string): number {
  const s = fmtWeekdayJst.format(atNoonJst(ymd)) as string;
  return JST_WK.get(s) ?? 0;
}

/**
 * JST 暦上で `ymd`（または省略時は JST 今日）を含む週の月曜…日曜。
 * 月曜=週始まり。`startYmd`≦`endYmd` は字列比較可能。
 */
export function isoWeekRangeJstContaining(ymd?: string): { start: string; end: string } {
  const y = (ymd != null && ymd.length >= 10 ? ymd.slice(0, 10) : null) ?? jstTodayYmd();
  const off = weekdayJstMon0(y);
  const start = ymdAddDaysJst(y, -off);
  const end = ymdAddDaysJst(start, 6);
  return { start, end };
}
