import type { LynchCategory } from "@/src/types/investment";
import { LYNCH_CATEGORY_KEYS } from "@/src/types/investment";

const VALID = new Set<string>(LYNCH_CATEGORY_KEYS);

/** Parse DB / form value into a known Lynch category, or null if unset / unknown. */
export function parseExpectationCategory(raw: unknown): LynchCategory | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (s.length === 0) return null;
  return VALID.has(s) ? (s as LynchCategory) : null;
}

/** Compact label for table badges */
export function expectationCategoryBadgeShortJa(cat: LynchCategory): string {
  switch (cat) {
    case "SlowGrower":
      return "低成長";
    case "Stalwart":
      return "優良";
    case "FastGrower":
      return "急成長";
    case "AssetPlay":
      return "資産";
    case "Cyclical":
      return "市況";
    case "Turnaround":
      return "回復";
  }
}

export function expectationCategoryBadgeClass(cat: LynchCategory): string {
  switch (cat) {
    case "SlowGrower":
      return "text-slate-300 border-slate-500/45 bg-slate-600/25";
    case "Stalwart":
      return "text-sky-300 border-sky-500/45 bg-sky-500/15";
    case "FastGrower":
      return "text-emerald-300 border-emerald-500/45 bg-emerald-500/15";
    case "AssetPlay":
      return "text-amber-300 border-amber-500/50 bg-amber-500/15";
    case "Cyclical":
      return "text-violet-300 border-violet-500/45 bg-violet-500/15";
    case "Turnaround":
      return "text-orange-300 border-orange-500/45 bg-orange-500/15";
  }
}

/** Sort order: ①低成長 → ⑥回復（未設定は末尾） */
export function lynchCategorySortRank(cat: LynchCategory | null): number {
  if (cat == null) return 999;
  const order: LynchCategory[] = [
    "SlowGrower",
    "Stalwart",
    "FastGrower",
    "AssetPlay",
    "Cyclical",
    "Turnaround",
  ];
  const i = order.indexOf(cat);
  return i >= 0 ? i : 998;
}
