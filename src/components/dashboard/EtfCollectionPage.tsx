"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Globe, RefreshCw } from "lucide-react";

import { defaultProfileUserId } from "@/src/lib/authorize-signals";
import { fetchWithTimeout } from "@/src/lib/fetch-utils";
import { EtfTable, type EtfRegionGroup, type EtfRow, type RegionMomentumRow } from "@/src/components/dashboard/EtfTable";
import { RotationRadarChart, type RotationRadarMode, type RotationRadarSelection } from "@/src/components/dashboard/RotationRadarChart";
import { WorldMapHeat } from "@/src/components/dashboard/WorldMapHeat";

const DEFAULT_USER_ID = defaultProfileUserId();

type Payload = {
  userId: string;
  asOf: string;
  fxUsdJpy: number | null;
  etfs: EtfRow[];
  commoditiesEtfs: EtfRow[];
  regionalMomentum: RegionMomentumRow[];
  stale?: boolean;
};

const EMPTY: Payload = {
  userId: DEFAULT_USER_ID,
  asOf: "",
  fxUsdJpy: null,
  etfs: [],
  commoditiesEtfs: [],
  regionalMomentum: [],
};

function regionLabelJa(region: "ALL" | EtfRegionGroup): string {
  if (region === "ALL") return "World";
  if (region === "GLOBAL_DEVELOPED") return "Global / Developed";
  if (region === "EMERGING_FRONTIER") return "Emerging / Frontier";
  return "Thematic Strata";
}

function regionHintJa(region: "ALL" | EtfRegionGroup): string {
  if (region === "ALL") return "地球全体の地層（重力の向き）";
  if (region === "GLOBAL_DEVELOPED") return "成熟市場（米国・欧州など）";
  if (region === "EMERGING_FRONTIER") return "新興・フロンティア（資本の流入先）";
  return "テーマ構造（半導体・電池など）";
}

function barColor(region: string): string {
  if (region === "GLOBAL_DEVELOPED") return "bg-sky-500/50";
  if (region === "EMERGING_FRONTIER") return "bg-amber-500/55";
  if (region === "THEMATIC_STRATA") return "bg-emerald-500/55";
  return "bg-muted-foreground/40";
}

export function EtfCollectionPage() {
  const [data, setData] = useState<Payload>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [region, setRegion] = useState<"ALL" | EtfRegionGroup>("ALL");
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [radarMode, setRadarMode] = useState<RotationRadarMode>("ETF");
  const [selectedGroup, setSelectedGroup] = useState<RotationRadarSelection | null>(null);
  const [dataset, setDataset] = useState<"GLOBAL" | "COMMODITIES">("GLOBAL");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithTimeout(
        `/api/etf-collection?userId=${encodeURIComponent(DEFAULT_USER_ID)}`,
        { cache: "no-store" },
        { timeoutMs: 12_000 },
      );
      const json = (await res.json()) as Partial<Payload> & { error?: string; hint?: string };
      if (!res.ok) {
        setError(json.error ?? `HTTP ${res.status}${json.hint ? ` — ${json.hint}` : ""}`);
        return;
      }
      setData({
        userId: json.userId ?? DEFAULT_USER_ID,
        asOf: json.asOf ?? "",
        fxUsdJpy: json.fxUsdJpy ?? null,
        etfs: (json.etfs ?? []) as EtfRow[],
        commoditiesEtfs: (json.commoditiesEtfs ?? []) as EtfRow[],
        regionalMomentum: (json.regionalMomentum ?? []) as RegionMomentumRow[],
        stale: json.stale,
      });
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") setError("接続タイムアウト：通信環境を確認してください");
      else setError(e instanceof Error ? e.message : "Failed to load ETF collection");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeEtfs = useMemo(() => {
    return dataset === "COMMODITIES" ? (data.commoditiesEtfs ?? []) : (data.etfs ?? []);
  }, [data.commoditiesEtfs, data.etfs, dataset]);

  const phaseAlerts = useMemo(() => {
    const hits = activeEtfs.filter((e) => e.phaseShift);
    hits.sort((a, b) => (Math.abs(b.dailyAlphaZ ?? 0) - Math.abs(a.dailyAlphaZ ?? 0)));
    return hits.slice(0, 3);
  }, [activeEtfs]);

  const regionMomentumTop = useMemo(() => {
    return [...(data.regionalMomentum ?? [])].sort((a, b) => b.gravityWeight - a.gravityWeight).slice(0, 3);
  }, [data.regionalMomentum]);

  const groupTickers = useMemo(() => {
    if (!selectedGroup) return [];
    const uniq = [...new Set((selectedGroup.tickers ?? []).map((t) => t.trim()).filter((t) => t.length > 0))];
    uniq.sort((a, b) => a.localeCompare(b, "en"));
    return uniq;
  }, [selectedGroup]);

  const groupSpillover = useMemo(() => {
    if (!selectedGroup) return [];
    const by = new Map<string, { ticker: string; name: string; reason: string; hits: number }>();
    const set = new Set(groupTickers);
    for (const e of activeEtfs ?? []) {
      if (!set.has(e.ticker)) continue;
      for (const h of e.spilloverHoldings ?? []) {
        const tk = String(h.ticker).trim();
        if (!tk) continue;
        const cur = by.get(tk) ?? { ticker: tk, name: String(h.name ?? ""), reason: String(h.reason ?? ""), hits: 0 };
        cur.hits += 1;
        if (!cur.reason && h.reason) cur.reason = String(h.reason);
        if (!cur.name && h.name) cur.name = String(h.name);
        by.set(tk, cur);
      }
    }
    const out = [...by.values()].sort((a, b) => b.hits - a.hits || a.ticker.localeCompare(b.ticker, "en"));
    return out.slice(0, 12);
  }, [activeEtfs, groupTickers, selectedGroup]);

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 font-sans">
      <div className="mx-auto w-full max-w-6xl lg:max-w-7xl 2xl:max-w-[90rem] space-y-6">
        <div className="rounded-2xl border border-border bg-card/60 p-5 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center h-9 w-9 rounded-xl border border-border bg-background/60">
                  <Globe size={18} className="text-accent-cyan" />
                </span>
                <div>
                  <h1 className="text-lg font-black tracking-tight">Global Strata（ETF Collection）</h1>
                  <p className="text-xs text-muted-foreground">
                    「今、世界のどの地層が動いているか」を、ETFの重力で一枚絵にする
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setDataset("GLOBAL");
                    setSelectedGroup(null);
                    setSelectedTicker(null);
                  }}
                  className={`text-[10px] font-bold uppercase tracking-wide px-3 py-2 rounded-lg border transition-all ${
                    dataset === "GLOBAL"
                      ? "text-accent-cyan border-accent-cyan/40 bg-accent-cyan/10"
                      : "text-muted-foreground border-border hover:bg-muted/50"
                  }`}
                  title="Global Strata"
                >
                  Global
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDataset("COMMODITIES");
                    setSelectedGroup(null);
                    setSelectedTicker(null);
                  }}
                  className={`text-[10px] font-bold uppercase tracking-wide px-3 py-2 rounded-lg border transition-all ${
                    dataset === "COMMODITIES"
                      ? "text-accent-cyan border-accent-cyan/40 bg-accent-cyan/10"
                      : "text-muted-foreground border-border hover:bg-muted/50"
                  }`}
                  title="Commodities (vs VOO)"
                >
                  Commodities
                </button>
                {(["ALL", "GLOBAL_DEVELOPED", "EMERGING_FRONTIER", "THEMATIC_STRATA"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setRegion(k)}
                    className={`text-[10px] font-bold uppercase tracking-wide px-3 py-2 rounded-lg border transition-all ${
                      region === k
                        ? "text-accent-cyan border-accent-cyan/40 bg-accent-cyan/10"
                        : "text-muted-foreground border-border hover:bg-muted/50"
                    }`}
                    title={regionHintJa(k)}
                  >
                    {regionLabelJa(k)}
                  </button>
                ))}
                <Link
                  href="/"
                  className="text-[10px] font-bold uppercase tracking-wide px-3 py-2 rounded-lg border border-border text-muted-foreground hover:bg-muted/50 transition-all"
                  title="ポートフォリオに戻る"
                >
                  Portfolio
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <button
                type="button"
                onClick={() => void load()}
                disabled={loading}
                className="text-[10px] font-bold uppercase tracking-wide text-foreground/80 border border-border px-3 py-2 rounded-lg hover:bg-muted transition-all flex items-center gap-2 disabled:opacity-50"
                title="再取得"
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                Refresh
              </button>
              <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground border border-border bg-background/60 px-3 py-2 rounded-lg">
                {data.asOf ? `AsOf ${new Date(data.asOf).toLocaleString("ja-JP")}` : "AsOf —"}
                {data.stale ? <span className="ml-2 text-amber-300">STALE</span> : null}
              </span>
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-xl border border-rose-500/25 bg-rose-500/5 p-4">
              <p className="text-sm font-bold text-rose-300">データ取得に失敗しました</p>
              <p className="text-xs text-rose-200/80 mt-1">{error}</p>
            </div>
          ) : null}
        </div>

        <RotationRadarChart
          etfs={activeEtfs ?? []}
          mode={radarMode}
          onChangeMode={(next) => {
            setRadarMode(next);
            setSelectedGroup(null);
            setSelectedTicker(null);
          }}
          onSelect={(sel) => {
            setSelectedGroup(sel);
            // Pick a representative ETF to scroll to (first ticker in group).
            const first = (sel.tickers ?? []).map((t) => t.trim()).find((t) => t.length > 0) ?? "";
            setSelectedTicker(first.length > 0 ? first : null);
          }}
        />

        {/* Phase Shift Alerts */}
        <div className="rounded-2xl border border-border bg-card/60 p-5 shadow-2xl">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Phase Shift Alerts</h3>
          <p className="text-[11px] text-muted-foreground mt-2">
            日次AlphaのZが閾値を超えたETFを検知し、保有銘柄（structure_tags）へ波及候補を提示。
          </p>
          <div className="mt-4 space-y-3">
            {phaseAlerts.length === 0 ? (
              <div className="text-xs text-muted-foreground">No active phase shifts</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {phaseAlerts.map((e) => (
                  <div key={e.ticker} className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-bold text-foreground/90">
                        {e.ticker}{" "}
                        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                          {regionLabelJa(e.regionGroup)}
                        </span>
                      </div>
                      <div className="font-mono text-[10px] text-foreground/90">
                        {e.dailyAlphaZ != null ? `${e.dailyAlphaZ > 0 ? "+" : ""}${e.dailyAlphaZ.toFixed(2)}σ` : "—"}
                      </div>
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground line-clamp-2" title={e.underlyingStructure}>
                      {e.underlyingStructure}
                    </div>
                    <div className="mt-2 text-[10px] text-muted-foreground">
                      <span className="font-bold text-foreground/80">Spillover</span>{" "}
                      {e.spilloverHoldings.length > 0 ? (
                        <span className="font-mono text-foreground/90">
                          {e.spilloverHoldings
                            .slice(0, 6)
                            .map((h) => h.ticker)
                            .join(", ")}
                          {e.spilloverHoldings.length > 6 ? ` +${e.spilloverHoldings.length - 6}` : ""}
                        </span>
                      ) : (
                        <span>—</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {dataset === "GLOBAL" ? (
          <div className="rounded-2xl border border-border bg-card/60 p-5 shadow-2xl">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Regional Momentum（資本の重力）</h3>
              <p className="text-[11px] text-muted-foreground mt-2">
                直近90日累積Alpha（対VOO）の平均を地域ごとに集約し、softmaxで「重力」を可視化。
              </p>
              <div className="mt-4">
                <WorldMapHeat
                  etfs={data.etfs ?? []}
                  selectedFilter={region}
                  onSelectFilter={(next) => setRegion(next)}
                />
              </div>
              <div className="mt-4 space-y-3">
                {(data.regionalMomentum ?? []).length === 0 ? (
                  <div className="text-xs text-muted-foreground">—</div>
                ) : (
                  (data.regionalMomentum ?? []).map((m) => (
                    <div key={m.region} className="flex items-center gap-3">
                      <div className="w-44 text-[10px] font-bold uppercase tracking-wide text-foreground/90">
                        {regionLabelJa(m.region as EtfRegionGroup)}
                      </div>
                      <div className="flex-1 h-2 rounded-full bg-muted/40 overflow-hidden border border-border">
                        <div
                          className={`h-full ${barColor(m.region)}`}
                          style={{ width: `${Math.max(2, Math.round(m.gravityWeight * 100))}%` }}
                          aria-hidden
                        />
                      </div>
                      <div className="w-28 text-right font-mono text-[10px] text-foreground/90 tabular-nums">
                        {(m.gravityWeight * 100).toFixed(1)}%
                      </div>
                      <div className="w-24 text-right font-mono text-[10px] text-muted-foreground tabular-nums">
                        {m.cumulativeAlpha > 0 ? "+" : ""}
                        {m.cumulativeAlpha.toFixed(2)}%
                      </div>
                    </div>
                  ))
                )}
              </div>
              {regionMomentumTop.length > 0 ? (
                <div className="mt-4 text-[11px] text-muted-foreground">
                  <span className="font-bold text-foreground/80">Gravity Top</span>{" "}
                  {regionMomentumTop.map((m) => (
                    <span key={m.region} className="mr-2">
                      <span className="font-bold text-accent-cyan">{regionLabelJa(m.region as EtfRegionGroup)}</span>
                      <span className="ml-1 font-mono">{(m.gravityWeight * 100).toFixed(0)}%</span>
                    </span>
                  ))}
                </div>
              ) : null}
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card/60 p-5 shadow-2xl">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Commodities（実物資産の潮流）</h3>
            <p className="text-[11px] text-muted-foreground mt-2">
              VOO（株式ベンチ）に対して、金・原油・銅など「実物」へ資金が向かっているかを Rotation Radar で読む。
            </p>
          </div>
        )}

        {/* Table is always global (no pin-driven filtering). */}
        {selectedGroup ? (
          <div className="rounded-2xl border border-border bg-card/60 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Radar selection</div>
                <div className="mt-1 text-sm font-black text-foreground/90">
                  {selectedGroup.kind} — <span className="font-mono">{selectedGroup.key}</span>
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground">
                  ETFs: <span className="font-mono text-foreground/90">{groupTickers.length}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {groupTickers.slice(0, 18).map((tk) => (
                    <button
                      key={tk}
                      type="button"
                      onClick={() => setSelectedTicker(tk)}
                      className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-md border transition-all ${
                        selectedTicker === tk
                          ? "text-accent-cyan border-accent-cyan/40 bg-accent-cyan/10"
                          : "text-muted-foreground border-border hover:bg-muted/40"
                      }`}
                      title="Scroll to ETF"
                    >
                      {tk}
                    </button>
                  ))}
                  {groupTickers.length > 18 ? (
                    <span className="text-[10px] text-muted-foreground">+{groupTickers.length - 18}</span>
                  ) : null}
                </div>
                <div className="mt-4">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Spillover (group)</div>
                  {groupSpillover.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {groupSpillover.map((h) => (
                        <span
                          key={h.ticker}
                          className="inline-flex items-center gap-2 text-[10px] font-bold border border-border bg-background/60 px-2 py-1 rounded-md"
                          title={h.name}
                        >
                          <span className="font-mono text-foreground/90">{h.ticker}</span>
                          <span className="text-muted-foreground">{h.reason || "hit"}</span>
                          <span className="text-muted-foreground/70 font-mono">×{h.hits}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 text-[10px] text-muted-foreground">
                      —（Phase Shift が発生しているETFがある場合に波及候補が現れます）
                    </div>
                  )}
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedGroup(null);
                    setSelectedTicker(null);
                  }}
                  className="text-[10px] font-bold uppercase tracking-wide px-3 py-2 rounded-lg border border-border text-muted-foreground hover:bg-muted/40 transition-all"
                  title="選択解除"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <EtfTable
          etfs={activeEtfs ?? []}
          fxUsdJpy={data.fxUsdJpy ?? null}
          regionFilter="ALL"
          selectedTicker={selectedTicker}
          highlightTickers={selectedGroup ? groupTickers : undefined}
          onSelectTicker={(ticker) => {
            const t = ticker.trim();
            setSelectedTicker(t.length > 0 ? t : null);
          }}
        />
      </div>
    </div>
  );
}

