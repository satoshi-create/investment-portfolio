/**
 * Market glance UI。数値は API（`fetchGlobalMarketIndicators`）由来で、Yahoo `quote` を優先し
 * 取れない場合は日足チャートにフォールバックする。
 */
import React, { useMemo, useState } from "react";

import type { MarketIndicator } from "@/src/types/investment";

type NenrinPeriod = "5d" | "1mo";
type NenrinPoint = { date: string; changePct: number };

function formatValue(label: string, value: number): string {
  if (!Number.isFinite(value) || value < 0) return "—";
  if (label === "USD/JPY") return value.toFixed(2);
  if (label === "10Y Yield" || label === "VIX") return value.toFixed(2);
  if (label === "Crude (USO)") return value.toFixed(2);
  if (label === "Gold" || label === "BTC") return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (value >= 10_000) return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (value >= 1000) return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function changeClass(pct: number): string {
  if (!Number.isFinite(pct) || pct === 0) return "text-muted-foreground";
  return pct > 0 ? "text-emerald-400" : "text-rose-400";
}

function formatChange(pct: number): string {
  if (!Number.isFinite(pct)) return "—";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

/** `fetchGlobalMarketIndicators`（price-service）のラベルと Yahoo シンボルを同期 */
const MACRO_LABEL_TO_YAHOO_SYMBOL: Record<string, string> = {
  "USD/JPY": "JPY=X",
  "Crude (USO)": "USO",
  Gold: "GC=F",
  BTC: "BTC-USD",
  "S&P 500": "^GSPC",
  "NASDAQ 100": "^NDX",
  SOX: "^SOX",
  VIX: "^VIX",
  "Nikkei 225": "^N225",
  "10Y Yield": "^TNX",
  DJIA: "^DJI",
};

function macroSymbolForLabel(label: string): string | null {
  return MACRO_LABEL_TO_YAHOO_SYMBOL[label] ?? null;
}

function pctClass(v: number): string {
  if (!Number.isFinite(v)) return "text-muted-foreground";
  if (v > 0) return "text-emerald-400";
  if (v < 0) return "text-rose-400";
  return "text-muted-foreground";
}

function MarketNenrinSparkline({ history }: { history: number[] }) {
  if (history.length === 0) {
    return <p className="text-xs text-muted-foreground">No data</p>;
  }

  const W = 260;
  const H = 64;
  const padX = 8;
  const padY = 8;
  const midY = H / 2;
  const vals = history;
  const minV = Math.min(0, ...vals);
  const maxV = Math.max(0, ...vals);
  const maxAbs = Math.max(Math.abs(minV), Math.abs(maxV), 0.01);

  const xAt = (i: number) =>
    vals.length <= 1 ? W / 2 : padX + (i / (vals.length - 1)) * (W - 2 * padX);
  const yAt = (v: number) => midY - (v / maxAbs) * (midY - padY);

  const points = vals.map((v, i) => ({ x: xAt(i), y: yAt(v), v }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-16" role="img" aria-label="累計騰落率（年輪）">
      <title>Nenrin cumulative change</title>
      <rect x={padX} y={padY} width={W - 2 * padX} height={midY - padY} fill="rgba(16, 185, 129, 0.08)" />
      <rect x={padX} y={midY} width={W - 2 * padX} height={midY - padY} fill="rgba(244, 63, 94, 0.08)" />
      <line
        x1={padX}
        x2={W - padX}
        y1={midY}
        y2={midY}
        stroke="rgb(100 116 139)"
        strokeWidth={1}
        strokeDasharray="3 3"
      />
      {vals.length === 1 ? (
        <circle
          cx={points[0]!.x}
          cy={points[0]!.y}
          r={3.5}
          fill="rgb(226 232 240)"
          stroke="rgb(100 116 139)"
          strokeWidth={1}
        />
      ) : (
        vals.slice(0, -1).map((_, i) => {
          const a = points[i]!;
          const b = points[i + 1]!;
          const avg = (a.v + b.v) / 2;
          const stroke = avg >= 0 ? "rgb(52 211 153)" : "rgb(251 113 133)";
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={stroke}
              strokeWidth={2}
              strokeLinecap="round"
            />
          );
        })
      )}
    </svg>
  );
}

export function MarketBar({
  indicators,
  showTitle = true,
  /** モーダル内: グリッド + 大きめタイポで一覧しやすく */
  layout = "strip",
}: {
  indicators: MarketIndicator[];
  showTitle?: boolean;
  layout?: "strip" | "modal";
}) {
  const [openLabel, setOpenLabel] = useState<string | null>(null);
  const [period, setPeriod] = useState<NenrinPeriod>("1mo");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [points, setPoints] = useState<NenrinPoint[]>([]);

  const openIndicator = useMemo(
    () => (openLabel ? indicators.find((m) => m.label === openLabel) ?? null : null),
    [indicators, openLabel],
  );

  const history = useMemo(() => points.map((p) => p.changePct), [points]);
  const lastPct = history.length > 0 ? history[history.length - 1]! : null;

  if (indicators.length === 0) return null;

  async function loadNenrin(nextLabel: string, nextPeriod: NenrinPeriod) {
    const symbol = macroSymbolForLabel(nextLabel);
    if (!symbol) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/market-glance/chart?symbol=${encodeURIComponent(symbol)}&period=${encodeURIComponent(nextPeriod)}`,
        { cache: "no-store" },
      );
      const json = (await res.json()) as { points?: NenrinPoint[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setPoints(Array.isArray(json.points) ? json.points : []);
    } catch (e) {
      setPoints([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function openNenrin(label: string) {
    const sym = macroSymbolForLabel(label);
    if (!sym) return;
    setOpenLabel(label);
    setPeriod("1mo");
    void loadNenrin(label, "1mo");
  }

  if (layout === "modal") {
    return (
      <div
        className="rounded-xl border border-border bg-background/60 p-1 sm:p-2"
        aria-label={showTitle ? "Market glance" : undefined}
      >
        {showTitle ? (
          <div className="mb-3 px-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Market glance</span>
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr,18rem]">
          <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
            {indicators.map((m) => {
              const sym = macroSymbolForLabel(m.label);
              const clickable = sym != null && Number.isFinite(m.value) && m.value >= 0;
              return (
                <li key={m.label} className="relative">
                  <button
                    type="button"
                    onClick={() => clickable && openNenrin(m.label)}
                    disabled={!clickable}
                    className={`w-full rounded-xl border border-border bg-card px-3 py-3 shadow-sm text-left transition-colors ${
                      clickable ? "hover:bg-muted" : "opacity-90"
                    }`}
                    title={clickable ? "クリックで年輪（累計騰落率）を表示" : undefined}
                  >
                    <div className="text-[10px] font-bold uppercase leading-tight tracking-tight text-muted-foreground sm:text-xs">
                      {m.label}
                    </div>
                    <div className="mt-1.5 font-mono text-base font-semibold tabular-nums text-foreground sm:text-lg">
                      {formatValue(m.label, m.value)}
                    </div>
                    <div
                      className={`mt-0.5 font-mono text-sm font-bold tabular-nums sm:text-base ${changeClass(m.changePct)}`}
                    >
                      {m.value < 0 ? "—" : formatChange(m.changePct)}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="rounded-xl border border-border bg-card/80 p-3 sm:p-4 min-h-[10rem]">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Nenrin（累計騰落率）
                </p>
                <p className="mt-1 text-sm font-bold text-foreground truncate">
                  {openLabel ?? "—"}
                </p>
              </div>
              {openLabel ? (
                <button
                  type="button"
                  onClick={() => {
                    setOpenLabel(null);
                    setError(null);
                    setPoints([]);
                  }}
                  className="rounded-lg border border-border px-2 py-1 text-[10px] font-bold text-muted-foreground hover:bg-muted"
                >
                  Close
                </button>
              ) : null}
            </div>

            <div className="mt-3 flex items-center gap-2">
              {(["5d", "1mo"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  disabled={!openLabel || loading}
                  onClick={() => {
                    if (!openLabel) return;
                    setPeriod(p);
                    void loadNenrin(openLabel, p);
                  }}
                  className={`rounded-md border px-2 py-1 text-[10px] font-bold ${
                    p === period ? "border-accent-cyan/60 text-accent-cyan" : "border-border text-muted-foreground"
                  } disabled:opacity-50`}
                >
                  {p === "1mo" ? "1Mo" : "5D"}
                </button>
              ))}
            </div>

            <div className="mt-3">
              {openLabel == null ? (
                <p className="text-xs text-muted-foreground">いずれかの指標カードをクリックすると年輪チャートを表示します。</p>
              ) : loading ? (
                <p className="text-xs text-muted-foreground">Loading…</p>
              ) : error ? (
                <p className="text-xs text-rose-400">{error}</p>
              ) : history.length === 0 ? (
                <p className="text-xs text-muted-foreground">No data</p>
              ) : (
                <>
                  <MarketNenrinSparkline history={history} />
                  <div className="mt-2 flex items-center justify-between gap-3 text-[11px]">
                    <span className="text-muted-foreground">
                      Latest:{" "}
                      <span className="font-mono font-semibold text-foreground">
                        {openIndicator ? formatValue(openIndicator.label, openIndicator.value) : "—"}
                      </span>
                    </span>
                    <span className={`${lastPct == null ? "text-muted-foreground" : pctClass(lastPct)} font-mono font-bold`}>
                      {lastPct == null ? "—" : `${lastPct > 0 ? "+" : ""}${lastPct.toFixed(2)}%`}
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    基準日（期間先頭）= 0% からの累計変化。VIX も指数値ベースの累計変化率。
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border border-border bg-card/60 px-3 py-2.5 shadow-inner"
      aria-label={showTitle ? "Market glance" : undefined}
    >
      {showTitle ? (
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Market glance</span>
        </div>
      ) : null}
      <div className="-mx-1 flex gap-3 overflow-x-auto pb-1 scroll-smooth [scrollbar-width:thin]">
        {indicators.map((m) => (
          <button
            key={m.label}
            type="button"
            onClick={() => macroSymbolForLabel(m.label) && m.value >= 0 && openNenrin(m.label)}
            disabled={macroSymbolForLabel(m.label) == null || m.value < 0}
            className="min-w-[5.75rem] shrink-0 rounded-lg border border-border bg-background/60 px-2.5 py-1.5 text-left disabled:opacity-90 hover:bg-muted transition-colors"
            title={macroSymbolForLabel(m.label) ? "クリックで年輪（累計騰落率）を表示" : undefined}
          >
            <div className="text-[9px] font-bold uppercase tracking-tight text-muted-foreground truncate" title={m.label}>
              {m.label}
            </div>
            <div className="font-mono text-xs font-semibold text-foreground/90 tabular-nums">{formatValue(m.label, m.value)}</div>
            <div className={`font-mono text-[10px] font-bold tabular-nums ${changeClass(m.changePct)}`}>
              {m.value < 0 ? "—" : formatChange(m.changePct)}
            </div>
          </button>
        ))}
      </div>

      {openLabel ? (
        <div className="mt-2 rounded-xl border border-border bg-background/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground truncate">
                Nenrin · {openLabel} · {period === "1mo" ? "1Mo" : "5D"}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Latest{" "}
                <span className="font-mono font-semibold text-foreground">
                  {openIndicator ? formatValue(openIndicator.label, openIndicator.value) : "—"}
                </span>{" "}
                /{" "}
                <span className={`${lastPct == null ? "text-muted-foreground" : pctClass(lastPct)} font-mono font-bold`}>
                  {lastPct == null ? "—" : `${lastPct > 0 ? "+" : ""}${lastPct.toFixed(2)}%`}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              {(["5d", "1mo"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    if (!openLabel) return;
                    setPeriod(p);
                    void loadNenrin(openLabel, p);
                  }}
                  className={`rounded-md border px-2 py-1 text-[9px] font-bold ${
                    p === period ? "border-accent-cyan/60 text-accent-cyan" : "border-border text-muted-foreground"
                  } disabled:opacity-50`}
                >
                  {p === "1mo" ? "1Mo" : "5D"}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setOpenLabel(null);
                  setError(null);
                  setPoints([]);
                }}
                className="rounded-md border border-border px-2 py-1 text-[9px] font-bold text-muted-foreground hover:bg-muted"
              >
                Close
              </button>
            </div>
          </div>

          <div className="mt-2">
            {loading ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : error ? (
              <p className="text-xs text-rose-400">{error}</p>
            ) : history.length === 0 ? (
              <p className="text-xs text-muted-foreground">No data</p>
            ) : (
              <MarketNenrinSparkline history={history} />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
