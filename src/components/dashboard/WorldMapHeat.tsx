"use client";

import React, { useMemo, useState } from "react";

import type { EtfRow, EtfRegionGroup } from "@/src/components/dashboard/EtfTable";

type GeoCode = "US" | "EU" | "CN" | "JP" | "IN" | "SEA" | "AF" | "MX" | "FR" | "GL" | "OTHER";

type GeoDatum = {
  code: GeoCode;
  label: string;
  score90d: number | null;
  etfs: EtfRow[];
};

type Pin = {
  code: GeoCode;
  lon: number; // -180..180
  lat: number; // -90..90
};

// Equirectangular (-180..180, 90..-90). Pins use representative lon/lat.
const PINS: Pin[] = [
  { code: "US", lon: -98, lat: 39 },
  { code: "MX", lon: -102, lat: 23 },
  { code: "EU", lon: 10, lat: 50 },
  { code: "AF", lon: 20, lat: 5 },
  { code: "CN", lon: 105, lat: 35 },
  { code: "JP", lon: 138, lat: 36 },
  { code: "IN", lon: 78, lat: 22 },
  { code: "SEA", lon: 106, lat: 10 },
  { code: "FR", lon: 30, lat: 0 },
  { code: "GL", lon: 0, lat: 80 },
];

const MAP_VIEWBOX_W = 2520.631;
const MAP_VIEWBOX_H = 1260.315;

function lonLatToXY(lon: number, lat: number): { x: number; y: number } {
  const x = ((lon + 180) / 360) * MAP_VIEWBOX_W;
  const y = ((90 - lat) / 180) * MAP_VIEWBOX_H;
  return { x, y };
}

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

function scoreToColor(score: number | null, min: number, max: number): string {
  if (score == null || !Number.isFinite(score)) return "rgb(148 163 184 / 0.25)";
  if (!(max > min)) return "rgb(34 211 238 / 0.22)";
  const t = clamp01((score - min) / (max - min));
  if (t < 0.5) return mix("#fb7185", "#64748b", t / 0.5);
  return mix("#64748b", "#34d399", (t - 0.5) / 0.5);
}

function geoLabel(code: GeoCode): string {
  if (code === "US") return "United States";
  if (code === "MX") return "Mexico";
  if (code === "EU") return "Europe";
  if (code === "CN") return "China";
  if (code === "JP") return "Japan";
  if (code === "IN") return "India";
  if (code === "SEA") return "Southeast Asia";
  if (code === "AF") return "Africa";
  if (code === "FR") return "Frontier";
  if (code === "GL") return "Global";
  return "Other";
}

function geoToFilter(code: GeoCode): "ALL" | EtfRegionGroup {
  if (code === "US" || code === "EU" || code === "JP") return "GLOBAL_DEVELOPED";
  if (code === "CN" || code === "IN" || code === "SEA" || code === "AF" || code === "MX" || code === "FR")
    return "EMERGING_FRONTIER";
  if (code === "GL") return "THEMATIC_STRATA";
  return "ALL";
}

function asGeoCode(input: string | null | undefined): GeoCode {
  const s = (input ?? "").trim().toUpperCase();
  if (s === "US") return "US";
  if (s === "MX") return "MX";
  if (s === "EU") return "EU";
  if (s === "CN") return "CN";
  if (s === "JP") return "JP";
  if (s === "IN") return "IN";
  if (s === "SEA") return "SEA";
  if (s === "AF") return "AF";
  if (s === "FR") return "FR";
  if (s === "GL") return "GL";
  return "OTHER";
}

function pinRadius(score90d: number | null, min: number, max: number): number {
  if (score90d == null || !Number.isFinite(score90d)) return 11;
  // Normalize by the observed min/max so negative (weak/red) becomes smaller
  // and positive (strong/green) becomes larger.
  if (!(max > min)) return 15;
  const t = clamp01((score90d - min) / (max - min)); // 0..1
  const rMin = 7.5;
  const rMax = 30;
  return rMin + t * (rMax - rMin);
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
  const [selectedPin, setSelectedPin] = useState<GeoCode | null>(null);

  const pinData = useMemo((): { byCode: Map<GeoCode, GeoDatum>; min: number; max: number } => {
    const by = new Map<GeoCode, GeoDatum>();
    for (const p of PINS) by.set(p.code, { code: p.code, label: geoLabel(p.code), score90d: null, etfs: [] });
    by.set("OTHER", { code: "OTHER", label: "Other", score90d: null, etfs: [] });

    for (const e of etfs) {
      const code = asGeoCode(e.geographyCode);
      if (!by.has(code)) by.set(code, { code, label: geoLabel(code), score90d: null, etfs: [] });
      by.get(code)!.etfs.push(e);
    }

    const scores: number[] = [];
    for (const d of by.values()) {
      const vals = d.etfs
        .map((x) => x.cumulativeAlpha90d)
        .filter((x): x is number => x != null && Number.isFinite(x));
      d.score90d = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      if (d.score90d != null) scores.push(d.score90d);
    }

    const min = scores.length > 0 ? Math.min(...scores) : 0;
    const max = scores.length > 0 ? Math.max(...scores) : 0;
    return { byCode: by, min, max };
  }, [etfs]);

  const hovered = hover ? pinData.byCode.get(hover) ?? null : null;
  const selected = selectedPin ? pinData.byCode.get(selectedPin) ?? null : null;

  const selectedPins = useMemo(() => {
    if (selectedFilter === "GLOBAL_DEVELOPED") return new Set<GeoCode>(["US", "EU", "JP"]);
    if (selectedFilter === "EMERGING_FRONTIER") return new Set<GeoCode>(["CN", "IN", "SEA", "AF", "MX", "FR"]);
    if (selectedFilter === "THEMATIC_STRATA") return new Set<GeoCode>(["GL"]);
    return new Set<GeoCode>();
  }, [selectedFilter]);

  const strokeFor = (code: GeoCode) =>
    selectedPins.has(code) ? "rgb(34 211 238 / 0.90)" : "rgb(148 163 184 / 0.45)";

  const handleActivate = (code: GeoCode) => {
    setSelectedPin(code);
    onSelectFilter(geoToFilter(code));
  };

  const focused = selected ?? hovered;

  const summaryForFocused = useMemo(() => {
    if (!focused) return null;
    const list = focused.etfs ?? [];
    const avg = (vals: (number | null)[]) => {
      const v = vals.filter((x): x is number => x != null && Number.isFinite(x));
      if (v.length === 0) return null;
      return v.reduce((a, b) => a + b, 0) / v.length;
    };
    const avg90 = avg(list.map((e) => e.cumulativeAlpha90d));
    const avg1d = avg(list.map((e) => e.latestDailyAlpha));
    const avgZ = avg(list.map((e) => e.dailyAlphaZ));
    const trackAvg = avg(list.map((e) => e.trackingAlphaScore));
    const phaseCount = list.filter((e) => e.phaseShift).length;
    const usdCount = list.filter((e) => e.currency === "USD").length;
    const jpyCount = list.filter((e) => e.currency === "JPY").length;
    const topBy90 =
      [...list].filter((e) => e.cumulativeAlpha90d != null).sort((a, b) => (b.cumulativeAlpha90d ?? -Infinity) - (a.cumulativeAlpha90d ?? -Infinity))[0] ??
      null;
    const worstBy90 =
      [...list].filter((e) => e.cumulativeAlpha90d != null).sort((a, b) => (a.cumulativeAlpha90d ?? Infinity) - (b.cumulativeAlpha90d ?? Infinity))[0] ??
      null;
    /**
     * Trend score: a single number to read at a glance.
     * - avg90d is the backbone (structure trend)
     * - avg1d is momentum accent
     * - avgZ is regime intensity (clamped)
     * Output ~ [-100, 100] range.
     */
    const zClamped = avgZ != null ? Math.max(-3, Math.min(3, avgZ)) : 0;
    const trendScore =
      (avg90 ?? 0) * 1.2 +
      (avg1d ?? 0) * 2.0 +
      zClamped * 3.0 -
      (phaseCount > 0 ? 1.5 : 0);

    return { avg90, avg1d, avgZ, trackAvg, phaseCount, usdCount, jpyCount, topBy90, worstBy90, total: list.length, trendScore };
  }, [focused]);

  function fmtPct(v: number | null, digits = 2) {
    if (v == null || !Number.isFinite(v)) return "—";
    return `${v > 0 ? "+" : ""}${v.toFixed(digits)}%`;
  }

  function fmtZ(v: number | null) {
    if (v == null || !Number.isFinite(v)) return "—";
    return `${v > 0 ? "+" : ""}${v.toFixed(2)}σ`;
  }

  function fmtScore(v: number | null): string {
    if (v == null || !Number.isFinite(v)) return "—";
    return `${v > 0 ? "+" : ""}${v.toFixed(1)}`;
  }

  function scoreClass(v: number | null): string {
    if (v == null || !Number.isFinite(v)) return "text-muted-foreground border-border bg-background/60";
    if (v > 0) return "text-emerald-200 border-emerald-500/35 bg-emerald-500/10";
    if (v < 0) return "text-rose-200 border-rose-500/35 bg-rose-500/10";
    return "text-muted-foreground border-border bg-background/60";
  }

  return (
    <div className="rounded-2xl border border-border bg-background/40 p-4 overflow-hidden">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">World Pins (ETF Strata)</div>
          <div className="text-[11px] text-muted-foreground mt-1">
            ピンをホバーして、その国/地域のETFの“熱”を確認（クリックでフィルタ）
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
          {selectedPin ? (
            <button
              type="button"
              onClick={() => setSelectedPin(null)}
              className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-2 rounded-lg border border-border text-muted-foreground hover:bg-muted/40 transition-all"
              title="ピン選択を解除"
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-3 relative">
        <svg viewBox={`0 0 ${MAP_VIEWBOX_W} ${MAP_VIEWBOX_H}`} className="w-full h-auto" role="img" aria-label="ETF pin world map">
          <defs>
            <radialGradient id="glow" cx="50%" cy="50%" r="65%">
              <stop offset="0%" stopColor="rgb(34 211 238 / 0.10)" />
              <stop offset="100%" stopColor="rgb(34 211 238 / 0)" />
            </radialGradient>
            <clipPath id="mapClip">
              <rect x="0" y="0" width={MAP_VIEWBOX_W} height={MAP_VIEWBOX_H} rx="36" />
            </clipPath>
            <filter id="pinShadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="rgb(0 0 0 / 0.45)" />
            </filter>
          </defs>

          <g clipPath="url(#mapClip)">
            <image
              href="/World_location_map_(equirectangular_180).svg"
              x="0"
              y="0"
              width={MAP_VIEWBOX_W}
              height={MAP_VIEWBOX_H}
              preserveAspectRatio="xMidYMid slice"
            />
            <rect x="0" y="0" width={MAP_VIEWBOX_W} height={MAP_VIEWBOX_H} rx="36" fill="url(#glow)" />

            {PINS.map((p) => {
              const pt = lonLatToXY(p.lon, p.lat);
              const d = pinData.byCode.get(p.code) ?? null;
              const score90d = d?.score90d ?? null;
              const avg1d = (() => {
                const vals = (d?.etfs ?? []).map((x) => x.latestDailyAlpha).filter((x): x is number => x != null && Number.isFinite(x));
                if (vals.length === 0) return null;
                return vals.reduce((a, b) => a + b, 0) / vals.length;
              })();
              const r = pinRadius(score90d, pinData.min, pinData.max);
              const fill = scoreToColor(score90d, pinData.min, pinData.max);
              const stroke = strokeFor(p.code);
              const active = selectedPins.has(p.code);
              const phaseCount = (d?.etfs ?? []).filter((x) => x.phaseShift).length;
              const isSelected = selectedPin === p.code;
              const ring =
                avg1d == null
                  ? "rgb(148 163 184 / 0.45)"
                  : avg1d > 0
                    ? "rgb(52 211 153 / 0.85)"
                    : "rgb(251 113 133 / 0.85)";

              return (
                <g
                  key={p.code}
                  onMouseEnter={() => setHover(p.code)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => handleActivate(p.code)}
                  style={{ cursor: "pointer" }}
                  filter="url(#pinShadow)"
                  role="button"
                  tabIndex={0}
                  aria-label={`${geoLabel(p.code)} pin`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") handleActivate(p.code);
                  }}
                >
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={r * 1.8}
                    fill={active ? "rgb(34 211 238 / 0.14)" : "rgb(148 163 184 / 0.10)"}
                  />
                  {/* ring encodes 1D direction */}
                  <circle cx={pt.x} cy={pt.y} r={r + 2.5} fill="transparent" stroke={ring} strokeWidth={3} />
                  {/* fill encodes 90D level; size encodes magnitude */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={r}
                    fill={fill}
                    fillOpacity={0.9}
                    stroke={isSelected ? "rgb(34 211 238 / 0.95)" : stroke}
                    strokeWidth={3}
                  />
                  {avg1d != null ? (
                    <text x={pt.x} y={pt.y - r - 10} textAnchor="middle" className="fill-slate-200/90 text-[12px] font-black">
                      {avg1d > 0 ? "▲" : "▼"}
                    </text>
                  ) : null}
                  {phaseCount > 0 ? (
                    <circle cx={pt.x + r * 0.9} cy={pt.y - r * 0.9} r={5.5} fill="rgb(245 158 11 / 0.95)" />
                  ) : null}
                  <text
                    x={pt.x}
                    y={pt.y + r + 22}
                    textAnchor="middle"
                    className="fill-slate-200/80 text-[10px] font-bold uppercase tracking-widest"
                  >
                    {p.code}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        <div className="mt-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="text-[11px] text-muted-foreground">
              {focused ? (
                <>
                  <span className="font-bold text-foreground/90">{focused.label}</span>
                  <span className="ml-2 font-mono">90D {summaryForFocused?.avg90 != null ? fmtPct(summaryForFocused.avg90) : "—"}</span>
                  <span className="ml-2 font-mono text-muted-foreground">
                    1D {summaryForFocused?.avg1d != null ? fmtPct(summaryForFocused.avg1d) : "—"} / Z{" "}
                    {summaryForFocused?.avgZ != null ? fmtZ(summaryForFocused.avgZ) : "—"}
                  </span>
                </>
              ) : (
                <span>Click a pin to pin details (or hover for preview)</span>
              )}
            </div>
            {focused ? (
              <button
                type="button"
                onClick={() => handleActivate(focused.code)}
                className="text-[10px] font-bold uppercase tracking-wide text-accent-cyan border border-accent-cyan/40 px-3 py-2 rounded-lg hover:bg-accent-cyan/10 transition-all"
                title="この地域でフィルタ"
              >
                Filter
              </button>
            ) : null}
          </div>

          {focused ? (
            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
              {focused.etfs.length === 0 ? (
                <div className="text-xs text-muted-foreground">No ETFs mapped to this pin</div>
              ) : (
                [...focused.etfs]
                  .sort((a, b) => Math.abs(b.dailyAlphaZ ?? 0) - Math.abs(a.dailyAlphaZ ?? 0))
                  .slice(0, 9)
                  .map((e) => (
                    <div
                      key={e.ticker}
                      className="rounded-xl border border-border bg-background/60 px-3 py-2"
                      title={e.underlyingStructure}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-bold text-foreground/90">
                          <span className="font-mono">{e.ticker}</span>
                          {e.phaseShift ? (
                            <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-amber-300">Phase</span>
                          ) : null}
                        </div>
                        <div className="text-[10px] font-mono text-muted-foreground">
                          {e.cumulativeAlpha90d != null
                            ? `${e.cumulativeAlpha90d > 0 ? "+" : ""}${e.cumulativeAlpha90d.toFixed(2)}%`
                            : "—"}
                        </div>
                      </div>
                      <div className="mt-1 text-[10px] text-muted-foreground line-clamp-2">{e.name}</div>
                      <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
                        <span className="font-mono text-foreground/90">
                          1D{" "}
                          {e.latestDailyAlpha != null
                            ? `${e.latestDailyAlpha > 0 ? "+" : ""}${e.latestDailyAlpha.toFixed(2)}%`
                            : "—"}
                        </span>
                        <span className="font-mono text-foreground/90">
                          Z {e.dailyAlphaZ != null ? `${e.dailyAlphaZ > 0 ? "+" : ""}${e.dailyAlphaZ.toFixed(2)}σ` : "—"}
                        </span>
                        <span className="font-mono text-muted-foreground">
                          Track {Number.isFinite(e.trackingAlphaScore) ? e.trackingAlphaScore.toFixed(1) : "—"}
                        </span>
                      </div>
                    </div>
                  ))
              )}
            </div>
          ) : null}

          {focused && summaryForFocused ? (
            <div className="mt-3 rounded-2xl border border-border bg-background/40 p-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Country Snapshot</div>
                <div className="text-[10px] text-muted-foreground font-mono">
                  ETFs {summaryForFocused.total} / Phase {summaryForFocused.phaseCount} / USD {summaryForFocused.usdCount} / JPY {summaryForFocused.jpyCount}
                </div>
              </div>
              <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
                <div className="rounded-xl border border-border bg-background/60 p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Trend</div>
                  <div className="mt-1 font-mono text-foreground/90">
                    90D {fmtPct(summaryForFocused.avg90)} / 1D {fmtPct(summaryForFocused.avg1d)} / Z {fmtZ(summaryForFocused.avgZ)}
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    Track Avg {summaryForFocused.trackAvg != null ? summaryForFocused.trackAvg.toFixed(1) : "—"}
                  </div>
                  <div className="mt-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Trend Score</div>
                  <div className="mt-1">
                    <span
                      className={`inline-flex items-center font-mono font-black text-base px-3 py-1 rounded-lg border ${scoreClass(
                        summaryForFocused.trendScore,
                      )}`}
                      title="90D/1D/Z/Phase を合成した国別トレンドスコア"
                    >
                      {fmtScore(summaryForFocused.trendScore)}
                    </span>
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-background/60 p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Top / Bottom (90D)</div>
                  <div className="mt-1 text-[11px] text-foreground/90">
                    {summaryForFocused.topBy90 ? (
                      <span className="font-mono">
                        {summaryForFocused.topBy90.ticker} {fmtPct(summaryForFocused.topBy90.cumulativeAlpha90d)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                  <div className="mt-1 text-[11px] text-foreground/90">
                    {summaryForFocused.worstBy90 ? (
                      <span className="font-mono">
                        {summaryForFocused.worstBy90.ticker} {fmtPct(summaryForFocused.worstBy90.cumulativeAlpha90d)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-background/60 p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">How to read</div>
                  <div className="mt-1 text-[11px] text-muted-foreground leading-snug">
                    <span className="font-bold text-foreground/80">塗り</span>: 90D（累積Alpha平均） /{" "}
                    <span className="font-bold text-foreground/80">外周</span>: 1D（当日方向） /{" "}
                    <span className="font-bold text-foreground/80">▲▼</span>: 1Dの符号 /{" "}
                    <span className="font-bold text-foreground/80">●</span>: Phase Shift 発生
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

