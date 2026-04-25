"use client";

import { cn } from "@/src/lib/cn";
import { regionDisplayFromYahooCountry } from "@/src/lib/region-display";

type Props = {
  yahooCountry: string | null | undefined;
  className?: string;
};

/**
 * 観測甲板・Inventory 共通: 国旗 + 地域コード（JudgmentBadge と同系のピル）
 */
export function RegionMarketBadge({ yahooCountry, className }: Props) {
  const r = regionDisplayFromYahooCountry(yahooCountry);
  if (!r.regionCode) return null;
  const titleParts = [r.shortLabel || r.regionCode, yahooCountry?.trim()].filter(Boolean);
  const title = titleParts.length > 0 ? titleParts.join(" · ") : undefined;
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center justify-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide shrink-0",
        r.badgeWrap,
        className,
      )}
      aria-label={title ? `地域: ${title}` : `地域: ${r.regionCode}`}
    >
      {r.flag ? (
        <span className="text-[10px] leading-none" aria-hidden>
          {r.flag}
        </span>
      ) : null}
      {r.regionCode}
    </span>
  );
}
