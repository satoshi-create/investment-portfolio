function utcTodayStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function parseExpectedIpoDate(raw: string | null | undefined): { label: string; date: Date | null } {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (s.length === 0) return { label: "—", date: null };

  // YYYY-Qn (n=1..4)
  const q = s.match(/^(\d{4})\s*-\s*Q([1-4])$/i);
  if (q) {
    const year = Number(q[1]);
    const quarter = Number(q[2]);
    const month = quarter * 3; // 3,6,9,12 (1-indexed)
    const dt = new Date(Date.UTC(year, month - 1, 1));
    return { label: `${year}-Q${quarter}`, date: Number.isNaN(dt.getTime()) ? null : dt };
  }

  // YYYY.MM or YYYY-MM
  const ym = s.match(/^(\d{4})[.\-\/](\d{1,2})$/);
  if (ym) {
    const year = Number(ym[1]);
    const month = Number(ym[2]);
    const dt = new Date(Date.UTC(year, Math.max(1, Math.min(12, month)) - 1, 1));
    return { label: s, date: Number.isNaN(dt.getTime()) ? null : dt };
  }

  // YYYY.MM.DD or YYYY-MM-DD
  const ymd = s.match(/^(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})$/);
  if (ymd) {
    const year = Number(ymd[1]);
    const month = Number(ymd[2]);
    const day = Number(ymd[3]);
    const dt = new Date(Date.UTC(year, Math.max(1, Math.min(12, month)) - 1, Math.max(1, Math.min(31, day))));
    return { label: s, date: Number.isNaN(dt.getTime()) ? null : dt };
  }

  // Fallback: label only.
  return { label: s, date: null };
}

export function daysUntil(date: Date | null): number | null {
  if (date == null || Number.isNaN(date.getTime())) return null;
  const today = utcTodayStart().getTime();
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())).getTime();
  const diff = Math.round((target - today) / (24 * 60 * 60 * 1000));
  return Number.isFinite(diff) ? diff : null;
}

