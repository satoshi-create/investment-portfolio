"use client";

import React, { useMemo, useState } from "react";

import type { EtfRow, EtfRegionGroup } from "@/src/components/dashboard/EtfTable";

type GeoCode = "NA" | "SA" | "EU" | "AF" | "AS" | "OC" | "GL" | "OTHER";

const CONTINENTS: { code: Exclude<GeoCode, "GL" | "OTHER">; label: string }[] = [
  { code: "NA", label: "North America" },
  { code: "SA", label: "South America" },
  { code: "EU", label: "Europe" },
  { code: "AF", label: "Africa" },
  { code: "AS", label: "Asia" },
  { code: "OC", label: "Oceania" },
];

type GeoDatum = {
  code: GeoCode;
  label: string;
  score: number | null; // avg cumulative alpha 90d
  etfs: { ticker: string; alpha90d: number | null; regionGroup: EtfRegionGroup }[];
};

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.trim().replace("#", "");
  if (h.length !== 6) return null;
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  if (![r, g, b].every((n) => Number.isFinite(n))) return null;
  return { r, g, b };
}

function mix(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const tt = clamp01(t);
  if (!A || !B) return a;
  const r = Math.round(A.r + (B.r - A.r) * tt);
  const g = Math.round(A.g + (B.g - A.g) * tt);
  const bl = Math.round(A.b + (B.b - A.b) * tt);
  return `rgb(${r} ${g} ${bl})`;
}

/**
 * Visual encoding:
 * - Use cumulativeAlpha90d average per geo code as the heat score.
 * - Normalize across available geos, then map to a warm->cool palette:
 *   cold (neg) => rose, hot (pos) => emerald, neutral => slate.
 */
function heatFill(score: number | null, min: number, max: number): string {
  if (score == null || !Number.isFinite(score)) return "rgb(71 85 105 / 0.25)"; // slate-600/25
  if (!(max > min)) return "rgb(34 211 238 / 0.22)"; // cyan-ish when flat
  const t = clamp01((score - min) / (max - min));
  // 0..0.5: rose -> slate, 0.5..1: slate -> emerald
  if (t < 0.5) return mix("#fb7185", "#64748b", t / 0.5); // rose-400 -> slate-500
  return mix("#64748b", "#34d399", (t - 0.5) / 0.5); // slate-500 -> emerald-400
}

function geoLabel(code: GeoCode): string {
  if (code === "NA") return "North America";
  if (code === "SA") return "South America";
  if (code === "EU") return "Europe";
  if (code === "AF") return "Africa";
  if (code === "AS") return "Asia";
  if (code === "OC") return "Oceania";
  if (code === "GL") return "Global";
  return "Other";
}

function geoToFilter(code: GeoCode): "ALL" | EtfRegionGroup {
  // Map geo clicks to the existing region filter (coarse).
  if (code === "NA" || code === "EU" || code === "OC") return "GLOBAL_DEVELOPED";
  if (code === "SA" || code === "AF") return "EMERGING_FRONTIER";
  if (code === "AS") return "ALL";
  if (code === "GL") return "THEMATIC_STRATA";
  return "ALL";
}

function asGeoCode(input: string | null | undefined): GeoCode {
  const s = (input ?? "").trim().toUpperCase();
  if (s === "US") return "NA";
  if (s === "MX") return "NA";
  if (s === "EU") return "EU";
  if (s === "IN") return "AS";
  if (s === "JP") return "AS";
  if (s === "GL") return "GL";
  if (s === "FR") return "AF";
  return "OTHER";
}

export function WorldMapHeat({
  etfs,
  selectedFilter,
  onSelectFilter,
}: {
  etfs: EtfRow[];
  selectedFilter: "ALL" | EtfRegionGroup;
  onSelectFilter: (next: "ALL" | EtfRegionGroup) => void;
}) {
  const [hover, setHover] = useState<GeoCode | null>(null);

  const geoData = useMemo((): { byCode: Map<GeoCode, GeoDatum>; min: number; max: number } => {
    const by = new Map<GeoCode, GeoDatum>();
    const push = (code: GeoCode, e: EtfRow) => {
      if (!by.has(code)) {
        by.set(code, { code, label: geoLabel(code), score: null, etfs: [] });
      }
      by.get(code)!.etfs.push({ ticker: e.ticker, alpha90d: e.cumulativeAlpha90d, regionGroup: e.regionGroup });
    };

    // Always render continents even when there are no matching ETFs (neutral heat).
    for (const c of CONTINENTS) {
      by.set(c.code, { code: c.code, label: c.label, score: null, etfs: [] });
    }
    by.set("OTHER", { code: "OTHER", label: "Other", score: null, etfs: [] });
    by.set("GL", { code: "GL", label: "Global", score: null, etfs: [] });

    for (const e of etfs) {
      const code = asGeoCode(e.geographyCode);
      push(code, e);
    }

    const scores: number[] = [];
    for (const d of by.values()) {
      const vals = d.etfs.map((x) => x.alpha90d).filter((x): x is number => x != null && Number.isFinite(x));
      if (vals.length === 0) {
        d.score = null;
        continue;
      }
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      d.score = avg;
      scores.push(avg);
    }

    const min = scores.length > 0 ? Math.min(...scores) : 0;
    const max = scores.length > 0 ? Math.max(...scores) : 0;
    return { byCode: by, min, max };
  }, [etfs]);

  const hovered = hover ? geoData.byCode.get(hover) ?? null : null;

  const selectedGeo = useMemo(() => {
    // When a filter is selected, highlight likely geos.
    if (selectedFilter === "GLOBAL_DEVELOPED") return new Set<GeoCode>(["NA", "EU", "OC"]);
    if (selectedFilter === "EMERGING_FRONTIER") return new Set<GeoCode>(["SA", "AF", "AS"]);
    if (selectedFilter === "THEMATIC_STRATA") return new Set<GeoCode>(["GL", "NA", "EU", "AS"]);
    return new Set<GeoCode>();
  }, [selectedFilter]);

  const strokeFor = (code: GeoCode) =>
    selectedGeo.has(code) ? "rgb(34 211 238 / 0.85)" : "rgb(148 163 184 / 0.35)"; // cyan / slate

  const handleActivate = (code: GeoCode) => {
    const next = geoToFilter(code);
    onSelectFilter(next);
  };

  const continentPaths = useMemo(() => {
    return {
      /**
       * Paths are intentionally coarse "continent hit areas".
       * This map image is Pacific-centered: Eurasia/Africa left, Americas right.
       */
      AS: "M70,85 C170,45 360,50 520,120 C590,150 610,210 585,255 C555,305 455,330 340,315 C240,302 145,258 95,205 C55,165 45,115 70,85 Z",
      EU: "M260,105 C310,78 375,78 425,103 C455,120 460,150 435,170 C405,192 340,195 295,173 C260,155 245,125 260,105 Z",
      AF: "M265,190 C305,175 360,182 392,215 C425,252 420,310 385,352 C350,395 300,412 268,392 C235,372 232,320 245,278 C255,242 238,205 265,190 Z",
      OC: "M390,360 C430,340 485,345 520,372 C555,398 548,438 510,455 C470,472 420,462 395,435 C372,410 362,378 390,360 Z",
      NA: "M610,90 C690,50 830,58 905,110 C960,150 965,215 925,255 C885,298 810,310 735,285 C660,262 600,215 592,165 C588,135 592,110 610,90 Z",
      SA: "M780,275 C820,260 865,278 890,315 C920,360 912,430 870,470 C835,505 792,505 768,475 C742,442 748,392 760,355 C770,325 748,288 780,275 Z",
    } as const;
  }, []);

  /**
   * Minimal "world map" (stylized) without external deps.
   * Coordinates are in a 1000x520 viewBox.
   * Regions are intentionally coarse blobs positioned approximately.
   */
  return (
    <div className="rounded-2xl border border-border bg-background/40 p-4 overflow-hidden">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">World Heat (90D Alpha)</div>
          <div className="text-[11px] text-muted-foreground mt-1">
            地域ごとの直近90日累積Alpha（平均）を、地図の“熱”として表示（クリックでフィルタ）
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSelectFilter("ALL")}
            className={`text-[10px] font-bold uppercase tracking-wide px-2.5 py-2 rounded-lg border transition-all ${
              selectedFilter === "ALL"
                ? "text-accent-cyan border-accent-cyan/40 bg-accent-cyan/10"
                : "text-muted-foreground border-border hover:bg-muted/40"
            }`}
            title="World"
          >
            World
          </button>
        </div>
      </div>

      <div className="mt-3 relative">
        <svg
          viewBox="0 0 1000 520"
          className="w-full h-auto"
          role="img"
          aria-label="ETF heat world map"
        >
          <defs>
            <radialGradient id="glow" cx="50%" cy="50%" r="65%">
              <stop offset="0%" stopColor="rgb(34 211 238 / 0.12)" />
              <stop offset="100%" stopColor="rgb(34 211 238 / 0)" />
            </radialGradient>
            <clipPath id="mapClip">
              <rect x="0" y="0" width="1000" height="520" rx="26" />
            </clipPath>
          </defs>

          <g clipPath="url(#mapClip)">
            {/* Base map image (public/world-map.png) */}
            <image
              href="/world-map.png"
              x="0"
              y="0"
              width="1000"
              height="520"
              preserveAspectRatio="xMidYMid slice"
            />
            {/* Subtle glow overlay to match the app theme */}
            <rect x="0" y="0" width="1000" height="520" rx="26" fill="url(#glow)" />

            {/* Graticule-ish lines */}
            <g opacity="0.22" stroke="rgb(148 163 184 / 0.35)" strokeWidth="1">
              <path d="M0 260H1000" />
              <path d="M200 0V520" />
              <path d="M500 0V520" />
              <path d="M800 0V520" />
            </g>

            {/* Background: continents silhouette (replaces the halo circle) */}
            <g
              opacity={selectedFilter === "THEMATIC_STRATA" ? 0.16 : 0.10}
              style={{ pointerEvents: "none" }}
            >
              {(["NA", "SA", "EU", "AF", "AS", "OC"] as const).map((c) => (
                <path
                  key={c}
                  d={continentPaths[c]}
                  fill={heatFill(geoData.byCode.get("GL")?.score ?? null, geoData.min, geoData.max)}
                />
              ))}
            </g>

            {/* Regions (coarse) */}
            <Region
              code="NA"
              label="North America"
              d={continentPaths.NA}
              fill={heatFill(geoData.byCode.get("NA")?.score ?? null, geoData.min, geoData.max)}
              stroke={strokeFor("NA")}
              onHover={setHover}
              onActivate={handleActivate}
            />
            <Region
              code="SA"
              label="South America"
              d={continentPaths.SA}
              fill={heatFill(geoData.byCode.get("SA")?.score ?? null, geoData.min, geoData.max)}
              stroke={strokeFor("SA")}
              onHover={setHover}
              onActivate={handleActivate}
            />
            <Region
              code="EU"
              label="Europe"
              d={continentPaths.EU}
              fill={heatFill(geoData.byCode.get("EU")?.score ?? null, geoData.min, geoData.max)}
              stroke={strokeFor("EU")}
              onHover={setHover}
              onActivate={handleActivate}
            />
            <Region
              code="AF"
              label="Africa"
              d={continentPaths.AF}
              fill={heatFill(geoData.byCode.get("AF")?.score ?? null, geoData.min, geoData.max)}
              stroke={strokeFor("AF")}
              onHover={setHover}
              onActivate={handleActivate}
            />
            <Region
              code="AS"
              label="Asia"
              d={continentPaths.AS}
              fill={heatFill(geoData.byCode.get("AS")?.score ?? null, geoData.min, geoData.max)}
              stroke={strokeFor("AS")}
              onHover={setHover}
              onActivate={handleActivate}
            />
            <Region
              code="OC"
              label="Oceania"
              d={continentPaths.OC}
              fill={heatFill(geoData.byCode.get("OC")?.score ?? null, geoData.min, geoData.max)}
              stroke={strokeFor("OC")}
              onHover={setHover}
              onActivate={handleActivate}
            />

            {/* Global thematic toggle (keeps click affordance after removing the halo circle) */}
            <g>
              <text
                x="500"
                y="60"
                textAnchor="middle"
                className="fill-slate-200/70 text-[10px] font-bold uppercase tracking-widest"
                onMouseEnter={() => setHover("GL")}
                onMouseLeave={() => setHover(null)}
                onClick={() => handleActivate("GL")}
                style={{ cursor: "pointer" }}
              >
                Global thematic layer
              </text>
            </g>

            {/* Labels */}
            <g className="fill-slate-200/70 text-[10px] font-bold">
              <text x="800" y="105">NA</text>
              <text x="840" y="500">SA</text>
              <text x="350" y="120">EU</text>
              <text x="320" y="405">AF</text>
              <text x="250" y="165">AS</text>
              <text x="470" y="455">OC</text>
            </g>
          </g>
        </svg>

        {/* Hover tooltip */}
        <div className="mt-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="text-[11px] text-muted-foreground">
              {hovered ? (
                <>
                  <span className="font-bold text-foreground/90">{hovered.label}</span>
                  <span className="ml-2 font-mono">
                    {hovered.score != null && Number.isFinite(hovered.score)
                      ? `${hovered.score > 0 ? "+" : ""}${hovered.score.toFixed(2)}%`
                      : "—"}
                  </span>
                </>
              ) : (
                <span>Hover a region to see details</span>
              )}
            </div>
            {hovered ? (
              <button
                type="button"
                onClick={() => handleActivate(hovered.code)}
                className="text-[10px] font-bold uppercase tracking-wide text-accent-cyan border border-accent-cyan/40 px-3 py-2 rounded-lg hover:bg-accent-cyan/10 transition-all"
                title="この地域でフィルタ"
              >
                Filter
              </button>
            ) : null}
          </div>
          {hovered ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {hovered.etfs.slice(0, 8).map((e) => (
                <span
                  key={e.ticker}
                  className="text-[10px] font-bold uppercase tracking-wide text-foreground/90 border border-border bg-background/60 px-2 py-1 rounded-lg"
                  title={`${e.ticker} 90D: ${e.alpha90d != null ? `${e.alpha90d > 0 ? "+" : ""}${e.alpha90d.toFixed(2)}%` : "—"}`}
                >
                  <span className="font-mono">{e.ticker}</span>
                  <span className="ml-2 text-muted-foreground font-mono">
                    {e.alpha90d != null && Number.isFinite(e.alpha90d) ? `${e.alpha90d > 0 ? "+" : ""}${e.alpha90d.toFixed(1)}%` : "—"}
                  </span>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Region({
  code,
  label,
  d,
  fill,
  stroke,
  onHover,
  onActivate,
}: {
  code: GeoCode;
  label: string;
  d: string;
  fill: string;
  stroke: string;
  onHover: (c: GeoCode | null) => void;
  onActivate: (c: GeoCode) => void;
}) {
  return (
    <path
      d={d}
      fill={fill}
      stroke={stroke}
      strokeWidth={2}
      onMouseEnter={() => onHover(code)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onActivate(code)}
      role="button"
      tabIndex={0}
      aria-label={`${label} region`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onActivate(code);
      }}
      style={{ cursor: "pointer" }}
    />
  );
}

