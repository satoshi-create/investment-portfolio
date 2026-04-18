"use client";

import React, { useMemo } from "react";

import type { ThemeEcosystemWatchItem } from "@/src/types/investment";
import { cn } from "@/src/lib/cn";
import { parseCreditStream } from "@/src/lib/unicorn-credit-stream";
import { daysUntil, parseExpectedIpoDate } from "@/src/lib/unicorn-ipo";
import { EcosystemCumulativeSparkline } from "@/src/components/dashboard/EcosystemCumulativeSparkline";
import { EcosystemKeepButton } from "@/src/components/dashboard/EcosystemKeepButton";

function extractStructureText(notes: string | null): string | null {
  if (!notes) return null;
  const s = notes.trim();
  if (s.length === 0) return null;
  const line = s
    .split("\n")
    .map((x) => x.trim())
    .find((x) => x.startsWith("構造:") || x.toLowerCase().startsWith("structure:"));
  if (!line) return s.length > 0 ? s : null;
  return line.replace(/^構造:\s*/i, "").replace(/^structure:\s*/i, "").trim();
}

export function UnicornCard({
  item,
  onToggleKeep,
}: {
  item: ThemeEcosystemWatchItem;
  onToggleKeep?: () => void | Promise<void>;
}) {
  const isUnlisted = item.isUnlisted;
  const structure = extractStructureText(item.observationNotes);
  const credit = useMemo(() => parseCreditStream(item.privateCreditBacking), [item.privateCreditBacking]);
  const ipo = useMemo(() => parseExpectedIpoDate(item.estimatedIpoDate), [item.estimatedIpoDate]);
  const d = useMemo(() => daysUntil(ipo.date), [ipo.date]);

  const miningLabel =
    d == null
      ? ipo.label
      : d >= 0
        ? `${ipo.label} · T-${d}d`
        : `${ipo.label} · +${Math.abs(d)}d`;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 md:p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-1">
            AI Unicorns · Deep seam
          </p>
          <div className="flex items-baseline gap-2 flex-wrap">
            <h3 className="text-base font-bold text-slate-200 truncate">{item.companyName}</h3>
            <span className="text-xs text-slate-500 font-mono">
              {isUnlisted ? `UNLISTED → ${item.proxyTicker ?? "Proxy?"}` : item.ticker}
            </span>
          </div>
          <p className="text-sm text-slate-400 leading-relaxed mt-1">
            {item.role.trim().length > 0 ? item.role : "—"}
          </p>
          {structure ? (
            <p className="text-xs text-slate-500 leading-relaxed mt-2">
              <span className="text-slate-400 font-semibold">構造</span>{" "}
              <span className="text-slate-500">— {structure}</span>
            </p>
          ) : null}
        </div>

        <div className="shrink-0 text-right flex flex-col items-end gap-2">
          {onToggleKeep ? (
            <EcosystemKeepButton isKept={item.isKept} onClick={() => void onToggleKeep()} />
          ) : null}
          <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-1">
            Mining schedule
          </p>
          <p className="text-sm font-bold text-slate-200">{miningLabel}</p>
          {item.lastRoundValuation != null ? (
            <p className="text-[11px] text-slate-500 mt-1">
              Last round{" "}
              <span className="font-mono text-slate-400">
                ${Math.round(item.lastRoundValuation / 1_000_000_000)}B
              </span>
            </p>
          ) : null}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-4 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
            Credit stream
          </p>
          {credit.length === 0 ? (
            <p className="text-xs text-slate-600">未登録（`private_credit_backing`）</p>
          ) : (
            <>
              <div className="flex h-3 w-full overflow-hidden rounded-full border border-slate-800 bg-slate-950/60">
                {credit.map((c) => (
                  <div
                    key={c.label}
                    className={cn(
                      "h-full",
                      c.label.toLowerCase().includes("amazon")
                        ? "bg-amber-500/70"
                        : c.label.toLowerCase().includes("google") || c.label.toLowerCase().includes("alphabet")
                          ? "bg-emerald-500/60"
                          : c.label.toLowerCase().includes("microsoft")
                            ? "bg-sky-500/60"
                            : "bg-violet-500/50",
                    )}
                    style={{ width: `${Math.max(2, Math.min(100, c.weightPct))}%` }}
                    title={`${c.label} ${c.weightPct.toFixed(1)}%`}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {credit.slice(0, 5).map((c) => (
                  <span key={c.label} className="text-[11px] text-slate-500">
                    <span className="font-semibold text-slate-400">{c.label}</span>{" "}
                    <span className="font-mono">{c.weightPct.toFixed(1)}%</span>
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-4 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
            Proxy-alpha (shadow)
          </p>
          {isUnlisted ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-slate-500">
                  Proxy:{" "}
                  <span className="font-mono text-slate-400">{item.proxyTicker ?? "—"}</span>
                </p>
                <p className="text-xs text-slate-500">
                  CUM α:{" "}
                  <span className="font-mono text-slate-400">
                    {item.latestAlpha != null && Number.isFinite(item.latestAlpha)
                      ? `${item.latestAlpha > 0 ? "+" : ""}${item.latestAlpha.toFixed(2)}%`
                      : "—"}
                  </span>
                </p>
              </div>
              <EcosystemCumulativeSparkline history={item.alphaHistory} tone="shadow" />
            </div>
          ) : (
            <p className="text-xs text-slate-600">上場銘柄（影のProxy表示は不要）</p>
          )}
        </div>
      </div>
    </div>
  );
}

