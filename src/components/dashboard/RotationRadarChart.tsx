"use client";

import React, { useId, useMemo } from "react";
import {
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { EtfRow } from "@/src/components/dashboard/EtfTable";
import {
  rotationEventsForTransition,
  rotationQuadrantOf,
  type RotationRadarPoint,
  type RotationQuadrant,
} from "@/src/lib/alpha-logic";

type RadarEtf = Pick<EtfRow, "ticker" | "name" | "rotationRadar">;
type RadarEtfExtended = RadarEtf & Pick<EtfRow, "geographyCode" | "geographyLabel" | "regionGroup" | "strataThemeKey">;

type TailPoint = RotationRadarPoint & { ticker: string; name: string };

function quadrantLabel(q: RotationQuadrant): string {
  if (q === "LEADING") return "Leading";
  if (q === "WEAKENING") return "Weakening";
  if (q === "LAGGING") return "Lagging";
  return "Improving";
}

function quadrantColor(q: RotationQuadrant): string {
  if (q === "LEADING") return "rgb(52 211 153)"; // emerald
  if (q === "IMPROVING") return "rgb(34 211 238)"; // cyan
  if (q === "WEAKENING") return "rgb(251 191 36)"; // amber
  return "rgb(251 113 133)"; // rose
}

function safeNum(x: unknown, fallback: number): number {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function fmtAxis(v: number): string {
  if (!Number.isFinite(v)) return "—";
  return v.toFixed(0);
}

function fmtTooltip(v: number): string {
  if (!Number.isFinite(v)) return "—";
  return v.toFixed(2);
}

export type RotationRadarMode = "ETF" | "AREA" | "THEME";

export type RotationRadarSelection =
  | { kind: "ETF"; key: string; tickers: string[] }
  | { kind: "AREA"; key: string; tickers: string[] }
  | { kind: "THEME"; key: string; tickers: string[] };

function modeLabel(mode: RotationRadarMode): string {
  if (mode === "ETF") return "ETF";
  if (mode === "AREA") return "Area";
  return "Theme";
}

function themeLabel(key: string): string {
  // Minimal mapping for readability; unknown keys fall back to the key itself.
  const k = key.trim().toUpperCase();
  if (k === "AI_SEMICONDUCTOR") return "AI / Semiconductor";
  if (k === "EV_BATTERY") return "EV / Battery";
  if (k === "US_TECH_PLATFORM") return "US Tech / Platform";
  if (k === "US_EQUITY_CORE") return "US Equity (Core)";
  if (k === "EU_EQUITY") return "Europe Equity";
  if (k === "JAPAN_EQUITY") return "Japan Equity";
  if (k === "CHINA_EQUITY") return "China Equity";
  if (k === "INDIA_EQUITY") return "India Equity";
  if (k === "SEA_EQUITY") return "SEA Equity";
  if (k === "AFRICA_EQUITY") return "Africa Equity";
  if (k === "MEXICO_EQUITY") return "Mexico Equity";
  if (k === "FRONTIER_EQUITY") return "Frontier Equity";
  return key;
}

function areaLabel(code: string): string {
  const c = code.trim().toUpperCase();
  if (c === "US") return "United States";
  if (c === "EU") return "Europe";
  if (c === "JP") return "Japan";
  if (c === "CN") return "China";
  if (c === "IN") return "India";
  if (c === "SEA") return "Southeast Asia";
  if (c === "AF") return "Africa";
  if (c === "MX") return "Mexico";
  if (c === "FR") return "Frontier";
  if (c === "GL") return "Global";
  if (c === "OTHER") return "Other";
  return c || "Other";
}

function aggregateRotationVectors(items: Array<{ rotationRadar?: RotationRadarPoint[] }>): RotationRadarPoint[] {
  const vectors = items
    .map((x) => x.rotationRadar ?? [])
    .filter((v) => Array.isArray(v) && v.length > 0);
  if (vectors.length === 0) return [];

  // Align by date; only average dates that exist in at least 1 vector.
  const byDate = new Map<string, { sumX: number; sumY: number; n: number }>();
  for (const v of vectors) {
    for (const p of v) {
      const date = String(p.date ?? "").slice(0, 10);
      if (date.length !== 10) continue;
      const x = Number(p.rsRatio);
      const y = Number(p.rsMomentum);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      const cur = byDate.get(date) ?? { sumX: 0, sumY: 0, n: 0 };
      cur.sumX += x;
      cur.sumY += y;
      cur.n += 1;
      byDate.set(date, cur);
    }
  }
  const out = [...byDate.entries()]
    .map(([date, agg]) => ({
      date,
      rsRatio: agg.n > 0 ? agg.sumX / agg.n : 100,
      rsMomentum: agg.n > 0 ? agg.sumY / agg.n : 100,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Keep the last 20 points to match the underlying vectors.
  return out.slice(-20).map((p) => ({
    date: p.date,
    rsRatio: Number.isFinite(p.rsRatio) ? Number(p.rsRatio.toFixed(2)) : 100,
    rsMomentum: Number.isFinite(p.rsMomentum) ? Number(p.rsMomentum.toFixed(2)) : 100,
  }));
}

export function RotationRadarChart({
  etfs,
  mode,
  onChangeMode,
  onSelect,
}: {
  etfs: RadarEtfExtended[];
  mode: RotationRadarMode;
  onChangeMode: (next: RotationRadarMode) => void;
  onSelect: (sel: RotationRadarSelection) => void;
}) {
  const rawId = useId();
  const gid = `rot-radar-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const { heads, tails, xDomain, yDomain, byTickerMeta, lastMoveByKey } = useMemo(() => {
    const heads: Array<TailPoint & { quadrant: RotationQuadrant; events: string[] }> = [];
    const tailsByTicker: Map<string, TailPoint[]> = new Map();
    const allX: number[] = [];
    const allY: number[] = [];

    const byTickerMeta = new Map<
      string,
      { quadrant: RotationQuadrant; prevQuadrant: RotationQuadrant | null; events: string[] }
    >();

    type Group = { key: string; label: string; tickers: string[]; vector: RotationRadarPoint[] };
    const groups: Group[] = [];

    if (mode === "ETF") {
      for (const e of etfs) {
        const v = e.rotationRadar ?? [];
        if (!Array.isArray(v) || v.length < 6) continue;
        groups.push({ key: e.ticker, label: `${e.ticker}`, tickers: [e.ticker], vector: v });
      }
    } else if (mode === "AREA") {
      const by = new Map<string, RadarEtfExtended[]>();
      for (const e of etfs) {
        const codeRaw = e.geographyCode ?? "";
        const code = String(codeRaw).trim().toUpperCase() || "OTHER";
        if (!by.has(code)) by.set(code, []);
        by.get(code)!.push(e);
      }
      for (const [code, items] of by) {
        const vector = aggregateRotationVectors(items);
        if (vector.length < 6) continue;
        groups.push({
          key: code,
          label: `${code} — ${areaLabel(code)}`,
          tickers: items.map((x) => x.ticker),
          vector,
        });
      }
    } else {
      const by = new Map<string, RadarEtfExtended[]>();
      for (const e of etfs) {
        const raw = e.strataThemeKey != null ? String(e.strataThemeKey).trim() : "";
        const key = raw.length > 0 ? raw : e.regionGroup;
        if (!by.has(key)) by.set(key, []);
        by.get(key)!.push(e);
      }
      for (const [key, items] of by) {
        const vector = aggregateRotationVectors(items);
        if (vector.length < 6) continue;
        groups.push({
          key,
          label: `${key} — ${themeLabel(key)}`,
          tickers: items.map((x) => x.ticker),
          vector,
        });
      }
    }

    for (const g of groups) {
      const v = g.vector ?? [];
      if (!Array.isArray(v) || v.length < 6) continue;

      const tail = v.slice(-5).map((p) => ({
        ...p,
        ticker: g.key,
        name: g.label,
      }));
      tailsByTicker.set(g.key, tail);

      const last = v[v.length - 1]!;
      const prev = v[v.length - 2] ?? null;
      const quadrant = rotationQuadrantOf(last);
      const prevQuadrant = prev ? rotationQuadrantOf(prev) : null;
      const events = prevQuadrant != null ? rotationEventsForTransition(prevQuadrant, quadrant) : [];

      byTickerMeta.set(g.key, { quadrant, prevQuadrant, events });

      const head = { ...last, ticker: g.key, name: g.label };
      heads.push({ ...head, quadrant, events });

      for (const p of tail) {
        const x = safeNum(p.rsRatio, 100);
        const y = safeNum(p.rsMomentum, 100);
        allX.push(x);
        allY.push(y);
      }
    }

    // Domain padding (nice, not too zoomed).
    const minX = allX.length ? Math.min(...allX) : 95;
    const maxX = allX.length ? Math.max(...allX) : 105;
    const minY = allY.length ? Math.min(...allY) : 95;
    const maxY = allY.length ? Math.max(...allY) : 105;
    const padX = Math.max(3, (maxX - minX) * 0.12);
    const padY = Math.max(3, (maxY - minY) * 0.12);

    const xDomain: [number, number] = [Math.floor(minX - padX), Math.ceil(maxX + padX)];
    const yDomain: [number, number] = [Math.floor(minY - padY), Math.ceil(maxY + padY)];

    const tails = [...tailsByTicker.entries()].map(([ticker, points]) => ({ ticker, points }));
    const lastMoveByKey = new Map<string, { dx: number; dy: number }>();
    for (const [key, pts] of tailsByTicker.entries()) {
      const last = pts[pts.length - 1];
      const prev = pts.length >= 2 ? pts[pts.length - 2] : null;
      if (!last || !prev) continue;
      const dx = safeNum(last.rsRatio, 100) - safeNum(prev.rsRatio, 100);
      const dy = safeNum(last.rsMomentum, 100) - safeNum(prev.rsMomentum, 100);
      lastMoveByKey.set(key, { dx, dy });
    }
    return { heads, tails, xDomain, yDomain, byTickerMeta, lastMoveByKey };
  }, [etfs, mode]);

  const hasData = heads.length > 0;

  const quadrantDashboard = useMemo(() => {
    if (!hasData) return null;
    if (mode !== "AREA" && mode !== "THEME") return null;
    const items = heads.map((h) => {
      const move = lastMoveByKey.get(h.ticker) ?? { dx: 0, dy: 0 };
      const arrow =
        Math.abs(move.dx) < 0.02 && Math.abs(move.dy) < 0.02
          ? "•"
          : move.dx >= 0 && move.dy >= 0
            ? "↗"
            : move.dx >= 0 && move.dy < 0
              ? "↘"
              : move.dx < 0 && move.dy >= 0
                ? "↖"
                : "↙";
      return {
        key: h.ticker,
        label: h.name,
        rsRatio: safeNum(h.rsRatio, 100),
        rsMomentum: safeNum(h.rsMomentum, 100),
        quadrant: h.quadrant,
        events: h.events,
        arrow,
      };
    });
    // Sort inside each quadrant: momentum desc, ratio desc.
    const byQ = new Map<RotationQuadrant, typeof items>();
    for (const it of items) {
      if (!byQ.has(it.quadrant)) byQ.set(it.quadrant, []);
      byQ.get(it.quadrant)!.push(it);
    }
    for (const [q, arr] of byQ) {
      arr.sort((a, b) => b.rsMomentum - a.rsMomentum || b.rsRatio - a.rsRatio);
      byQ.set(q, arr);
    }
    return byQ;
  }, [hasData, heads, lastMoveByKey, mode]);

  return (
    <section className="rounded-2xl border border-border bg-card/60 shadow-2xl overflow-hidden">
      <div className="border-b border-border bg-card/60 px-5 py-4">
        <div className="flex flex-col gap-1.5 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
              Capital Flow Rotation Radar
            </p>
            <h2 className="text-lg font-black tracking-tight text-foreground/90">
              Rotation Radar（資金循環の羅針盤）
            </h2>
            <p className="text-[11px] text-muted-foreground leading-relaxed max-w-3xl">
              横軸: RS-Ratio（相対強度） / 縦軸: RS-Momentum（加速） — 直近5点の軌跡で「潮流の向き」を読む。
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <div className="text-[10px] text-muted-foreground font-mono">Center: (100, 100)</div>
            <div className="flex items-center gap-1 border border-border bg-background/40 rounded-lg p-1">
              {(["ETF", "AREA", "THEME"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => onChangeMode(m)}
                  className={`text-[10px] font-bold uppercase tracking-wide px-2.5 py-1.5 rounded-md transition-all border ${
                    mode === m
                      ? "text-accent-cyan border-accent-cyan/40 bg-accent-cyan/10"
                      : "text-muted-foreground border-transparent hover:bg-muted/40"
                  }`}
                  title={`View: ${modeLabel(m)}`}
                >
                  {modeLabel(m)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="px-2 pb-4 pt-2 md:px-4 md:pb-6 h-[min(420px,60vh)] min-h-[280px]">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 12, right: 16, bottom: 8, left: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(148 163 184 / 0.18)" />
              <XAxis
                type="number"
                dataKey="rsRatio"
                domain={xDomain}
                tickFormatter={(v) => fmtAxis(Number(v))}
                tick={{ fontSize: 10, fill: "rgb(148 163 184)" }}
                axisLine={{ stroke: "rgb(148 163 184 / 0.30)" }}
                tickLine={false}
              />
              <YAxis
                type="number"
                dataKey="rsMomentum"
                domain={yDomain}
                tickFormatter={(v) => fmtAxis(Number(v))}
                tick={{ fontSize: 10, fill: "rgb(148 163 184)" }}
                axisLine={{ stroke: "rgb(148 163 184 / 0.30)" }}
                tickLine={false}
                width={54}
              />

              {/* Quadrants */}
              <ReferenceArea x1={100} x2={xDomain[1]} y1={100} y2={yDomain[1]} fill="rgb(52 211 153 / 0.07)" />
              <ReferenceArea x1={100} x2={xDomain[1]} y1={yDomain[0]} y2={100} fill="rgb(251 191 36 / 0.07)" />
              <ReferenceArea x1={xDomain[0]} x2={100} y1={yDomain[0]} y2={100} fill="rgb(251 113 133 / 0.07)" />
              <ReferenceArea x1={xDomain[0]} x2={100} y1={100} y2={yDomain[1]} fill="rgb(34 211 238 / 0.07)" />

              <ReferenceLine x={100} stroke="rgb(148 163 184 / 0.55)" strokeDasharray="4 4" />
              <ReferenceLine y={100} stroke="rgb(148 163 184 / 0.55)" strokeDasharray="4 4" />

              <Tooltip
                contentStyle={{
                  backgroundColor: "rgb(2 6 23 / 0.92)",
                  border: "1px solid rgb(51 65 85 / 0.8)",
                  borderRadius: "0.75rem",
                  fontSize: "12px",
                  color: "rgb(226 232 240)",
                }}
                wrapperStyle={{ color: "rgb(226 232 240)" }}
                labelStyle={{ color: "rgb(226 232 240)" }}
                itemStyle={{ color: "rgb(226 232 240)" }}
                cursor={{ stroke: "rgb(34 211 238 / 0.28)", strokeWidth: 1 }}
                formatter={(value, name) => {
                  const n = name === "rsRatio" ? "RS-Ratio" : name === "rsMomentum" ? "RS-Momentum" : String(name);
                  return [fmtTooltip(Number(value)), n];
                }}
                labelFormatter={(_, payload) => {
                  const p = payload?.[0]?.payload as TailPoint | undefined;
                  if (!p) return "";
                  const meta = byTickerMeta.get(p.ticker);
                  const q = meta?.quadrant ? quadrantLabel(meta.quadrant) : "—";
                  const ev = meta?.events?.includes("NONLINEAR_BREAKOUT")
                    ? "🔥 breakout"
                    : meta?.events?.includes("HARVEST")
                      ? "harvest?"
                      : "";
                  return `${p.ticker} — ${p.name}${ev ? ` / ${ev}` : ""} / ${q}`;
                }}
              />

              {/* Tails (5 points) */}
              {tails.map(({ ticker, points }) => {
                const meta = byTickerMeta.get(ticker);
                const q = meta?.quadrant ?? "LAGGING";
                const stroke = quadrantColor(q);
                return (
                  <Scatter
                    key={`${gid}-tail-${ticker}`}
                    data={points}
                    line={{ stroke, strokeOpacity: 0.26, strokeWidth: 1.5 }}
                    fill={stroke}
                    fillOpacity={0.18}
                    shape="circle"
                    isAnimationActive={false}
                  />
                );
              })}

              {/* Heads (latest points) */}
              <Scatter
                data={heads}
                isAnimationActive={false}
                shape={(props) => {
                  const { cx, cy, payload } = props as unknown as {
                    cx: number;
                    cy: number;
                    payload: TailPoint & { quadrant: RotationQuadrant; events: string[] };
                  };
                  const q = payload?.quadrant ?? "LAGGING";
                  const events = payload?.events ?? [];
                  const stroke = quadrantColor(q);
                  const isBreakout = events.includes("NONLINEAR_BREAKOUT");
                  const isHarvest = events.includes("HARVEST");
                  const r = isBreakout ? 8.5 : isHarvest ? 7.5 : 6.5;
                  const halo = isBreakout ? 18 : 14;

                  return (
                    <g
                      style={{ cursor: "pointer" }}
                      onClick={() => {
                        const key = payload.ticker;
                        if (mode === "ETF") onSelect({ kind: "ETF", key, tickers: [key] });
                        else if (mode === "AREA")
                          onSelect({
                            kind: "AREA",
                            key,
                            tickers: etfs
                              .filter((e) => String(e.geographyCode ?? "").trim().toUpperCase() === key)
                              .map((e) => e.ticker),
                          });
                        else
                          onSelect({
                            kind: "THEME",
                            key,
                            tickers: etfs
                              .filter((e) => {
                                const raw = e.strataThemeKey != null ? String(e.strataThemeKey).trim() : "";
                                const k = raw.length > 0 ? raw : e.regionGroup;
                                return k === key;
                              })
                              .map((e) => e.ticker),
                          });
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          const key = payload.ticker;
                          if (mode === "ETF") onSelect({ kind: "ETF", key, tickers: [key] });
                        }
                      }}
                      aria-label={`${payload.ticker} rotation point`}
                    >
                      <circle cx={cx} cy={cy} r={halo} fill={stroke} fillOpacity={isBreakout ? 0.16 : 0.1} />
                      <circle
                        cx={cx}
                        cy={cy}
                        r={r}
                        fill={stroke}
                        fillOpacity={0.92}
                        stroke="rgb(2 6 23 / 0.85)"
                        strokeWidth={2}
                      />
                      {isBreakout ? (
                        <text
                          x={cx}
                          y={cy - 12}
                          textAnchor="middle"
                          className="fill-amber-200/95 text-[14px] font-black"
                        >
                          🔥
                        </text>
                      ) : null}
                      {isHarvest ? (
                        <text
                          x={cx}
                          y={cy - 12}
                          textAnchor="middle"
                          className="fill-slate-200/90 text-[10px] font-black"
                        >
                          TAKE
                        </text>
                      ) : null}
                      <text
                        x={cx}
                        y={cy + 18}
                        textAnchor="middle"
                        className={`fill-slate-200/85 font-black uppercase tracking-widest ${
                          mode === "AREA" ? "text-[11px]" : mode === "THEME" ? "text-[10px]" : "text-[9px]"
                        }`}
                      >
                        {payload.ticker}
                      </text>
                    </g>
                  );
                }}
              />
            </ScatterChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full min-h-[260px] flex items-center justify-center px-4 text-center">
            <p className="text-sm text-muted-foreground">
              Rotation Radar を描画するには、各ETFの直近データ（少なくとも6日以上）が必要です。
            </p>
          </div>
        )}
      </div>

      {(mode === "AREA" || mode === "THEME") && quadrantDashboard ? (
        <div className="border-t border-border bg-background/20 px-5 py-4">
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {mode === "AREA" ? "Area flow dashboard" : "Theme flow dashboard"}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">
                4象限ごとに「{mode === "AREA" ? "どの国が" : "どのテーマが"}、いま資金のどこにいるか」を一覧化（矢印は直近の移動方向）。
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground font-mono">
              ↗(強化) ↘(減速) ↖(反転) ↙(悪化)
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            {(["LEADING", "IMPROVING", "WEAKENING", "LAGGING"] as const).map((q) => {
              const list = quadrantDashboard.get(q) ?? [];
              const accent = quadrantColor(q);
              return (
                <div key={q} className="rounded-2xl border border-border bg-card/40 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-black tracking-tight text-foreground/90">
                      {quadrantLabel(q)}
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {list.length} {mode === "AREA" ? "areas" : "themes"}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {list.length === 0 ? (
                      <span className="text-[11px] text-muted-foreground">—</span>
                    ) : (
                      list.map((it) => {
                        const isBreakout = it.events.includes("NONLINEAR_BREAKOUT");
                        const isHarvest = it.events.includes("HARVEST");
                        return (
                          <button
                            key={it.key}
                            type="button"
                            onClick={() =>
                              mode === "AREA"
                                ? onSelect({
                                    kind: "AREA",
                                    key: it.key,
                                    tickers: etfs
                                      .filter((e) => String(e.geographyCode ?? "").trim().toUpperCase() === it.key)
                                      .map((e) => e.ticker),
                                  })
                                : onSelect({
                                    kind: "THEME",
                                    key: it.key,
                                    tickers: etfs
                                      .filter((e) => {
                                        const raw = e.strataThemeKey != null ? String(e.strataThemeKey).trim() : "";
                                        const k = raw.length > 0 ? raw : e.regionGroup;
                                        return k === it.key;
                                      })
                                      .map((e) => e.ticker),
                                  })
                            }
                            className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-[10px] font-bold transition-all hover:bg-muted/40 ${
                              isBreakout
                                ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                                : isHarvest
                                  ? "border-amber-500/30 bg-amber-500/5 text-amber-200/90"
                                  : "border-border bg-background/40 text-foreground/85"
                            }`}
                            title={`${it.label} / RS ${it.rsRatio.toFixed(1)} / MOM ${it.rsMomentum.toFixed(1)}`}
                          >
                            <span className="font-mono" style={{ color: accent }}>
                              {it.key}
                            </span>
                            <span className="text-muted-foreground">{it.arrow}</span>
                            <span className="font-mono text-muted-foreground">
                              {it.rsMomentum.toFixed(0)}
                            </span>
                            {isBreakout ? <span className="text-[11px]">🔥</span> : null}
                            {isHarvest ? <span className="text-[9px] text-muted-foreground">TAKE</span> : null}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}

