"use client";

import {
  institutionalOwnershipBand,
  type InstitutionalOwnershipBand,
} from "@/src/lib/institutional-ownership";
import { cn } from "@/src/lib/cn";

function bandVisual(band: InstitutionalOwnershipBand): { glyph: string; labelJa: string } {
  switch (band) {
    case "hidden":
      return { glyph: "🥷", labelJa: "隠密" };
    case "early":
      return { glyph: "💎", labelJa: "未発見" };
    case "crowded":
      return { glyph: "⚠️", labelJa: "過密" };
    case "mid":
      return { glyph: "·", labelJa: "中庸帯" };
    default: {
      const _e: never = band;
      return _e;
    }
  }
}

function ownershipTitle(ownership: number | null): string {
  if (ownership == null) {
    return "機関投資家の保有率: データなし";
  }
  const pct = Math.abs(ownership) * 100;
  const s = pct.toFixed(1).replace(/\.0$/, "");
  return `機関投資家の保有率: ${s}%`;
}

/**
 * リンチ流「真空センサー」— 機関保有率に応じた最小バッジ（鑑定ラベル風）。
 */
export function InstitutionalOwnershipSensor({
  ownership,
  className,
}: {
  ownership: number | null;
  className?: string;
}) {
  const band = institutionalOwnershipBand(ownership);
  const { glyph, labelJa } = bandVisual(band);
  const title = ownershipTitle(ownership);
  const longTitle =
    band === "hidden"
      ? `${title} — プロのレーダーに映りにくい、非対称地帯（隠密）`
      : band === "early"
        ? `${title} — プロの割合が低い、テンバーガー幼年期（未発見）`
        : band === "crowded"
          ? `${title} — 飽和しやすく、一斉売却リスク（過密）`
          : `${title} — 機関30–60%帯（中庸）`;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded border font-serif tabular-nums",
        "border-amber-900/35 bg-stone-950/40 text-[9px] leading-none tracking-tight",
        "text-amber-100/90 min-h-[1.1rem] min-w-[1.1rem] px-0.5",
        band === "mid" && "text-muted-foreground border-border/60",
        className,
      )}
      title={longTitle}
      aria-label={labelJa}
    >
      <span aria-hidden="true" className={band === "mid" ? "scale-150 font-bold" : ""}>
        {glyph}
      </span>
    </span>
  );
}
