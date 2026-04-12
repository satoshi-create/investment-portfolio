import type { ExpectationCategory } from "@/src/types/investment";
import { EXPECTATION_CATEGORY_KEYS } from "@/src/types/investment";

const VALID = new Set<string>(EXPECTATION_CATEGORY_KEYS);

/** Parse DB / form value into a known category, or null if unset / unknown. */
export function parseExpectationCategory(raw: unknown): ExpectationCategory | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (s.length === 0) return null;
  return VALID.has(s) ? (s as ExpectationCategory) : null;
}

/** Compact label for table badges */
export function expectationCategoryBadgeShortJa(cat: ExpectationCategory): string {
  switch (cat) {
    case "Growth":
      return "成長";
    case "Recovery":
      return "回復";
    case "Quality":
      return "優良";
    case "Value":
      return "バリュー";
    case "Heritage":
      return "老舗";
  }
}

export function expectationCategoryBadgeClass(cat: ExpectationCategory): string {
  switch (cat) {
    case "Growth":
      return "text-emerald-300 border-emerald-500/45 bg-emerald-500/15";
    case "Recovery":
      return "text-orange-300 border-orange-500/45 bg-orange-500/15";
    case "Quality":
      return "text-sky-300 border-sky-500/45 bg-sky-500/15";
    case "Value":
      return "text-amber-300 border-amber-500/50 bg-amber-500/15";
    case "Heritage":
      return "text-slate-300 border-slate-500/45 bg-slate-600/25";
  }
}
