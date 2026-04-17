export type CreditStreamSlice = {
  label: string;
  weightPct: number;
};

function parseNumberToken(raw: string): number | null {
  const s = raw.replace(/[%\s]/g, "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Parse human-friendly "credit stream" text into weighted slices.
 *
 * Accepts:
 * - "Amazon 40; Google 20; Apollo 10"
 * - "Amazon:40, Google:20"
 * - "Amazon(40) | Google(20)"
 * If no numeric weight is present, equal weights are assigned.
 */
export function parseCreditStream(raw: string | null | undefined): CreditStreamSlice[] {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (s.length === 0) return [];

  const parts = s
    .split(/[|;,]/g)
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
  if (parts.length === 0) return [];

  const parsed = parts.map((p) => {
    // label: take everything before first number-ish token, or before ':' / '('
    const label = p
      .replace(/\(.*?\)/g, "")
      .split(":")[0]!
      .trim();

    const paren = p.match(/\(([^)]+)\)/)?.[1] ?? null;
    const colon = p.includes(":") ? p.split(":")[1]!.trim() : null;
    const tailNum = p.match(/(\d+(?:\.\d+)?)\s*%?$/)?.[1] ?? null;
    const w =
      parseNumberToken(paren ?? "") ??
      parseNumberToken(colon ?? "") ??
      parseNumberToken(tailNum ?? "");
    return { label: label.length > 0 ? label : p, weight: w };
  });

  const withWeight = parsed.filter((x) => x.weight != null) as { label: string; weight: number }[];
  if (withWeight.length === 0) {
    const eq = Math.round((100 / parsed.length) * 100) / 100;
    return parsed.map((x) => ({ label: x.label, weightPct: eq }));
  }

  const sum = withWeight.reduce((a, b) => a + b.weight, 0);
  if (!(sum > 0)) return [];

  return parsed
    .map((x) => ({
      label: x.label,
      weightPct: x.weight != null ? Math.round(((x.weight / sum) * 100) * 10) / 10 : 0,
    }))
    .filter((x) => x.weightPct > 0)
    .sort((a, b) => b.weightPct - a.weightPct);
}

