"use client";

import React from "react";

/**
 * 累積 Alpha 系列用ミニチャート。Y 軸中央を 0 とし、長期の「スタートラインからの距離」を視覚化する。
 */
export function EcosystemCumulativeSparkline({
  history,
  tone = "normal",
  variant = "default",
}: {
  history: number[];
  /** `shadow`: 未上場の proxy 観測など、薄く「影」として出す */
  tone?: "normal" | "shadow";
  /** `compact`: ダッシュボードのテーマカード向けミニサイズ */
  variant?: "default" | "compact";
}) {
  if (history.length === 0) {
    return (
      <span className={variant === "compact" ? "text-muted-foreground text-[10px]" : "text-slate-600 text-xs"}>
        —
      </span>
    );
  }

  const compact = variant === "compact";
  const W = compact ? 132 : 208;
  const H = compact ? 34 : 48;
  const padX = 6;
  const padY = 5;
  const midY = H / 2;
  const vals = history;
  const minV = Math.min(0, ...vals);
  const maxV = Math.max(0, ...vals);
  const maxAbs = Math.max(Math.abs(minV), Math.abs(maxV), 0.01);

  const xAt = (i: number) =>
    vals.length <= 1 ? W / 2 : padX + (i / (vals.length - 1)) * (W - 2 * padX);
  const yAt = (v: number) => midY - (v / maxAbs) * (midY - padY);

  const points = vals.map((v, i) => ({ x: xAt(i), y: yAt(v), v }));
  const isShadow = tone === "shadow";
  const segmentOpacity = isShadow ? 0.35 : 1;
  const segmentWidth = isShadow ? 1.25 : 2;
  const dash = isShadow ? "3 3" : undefined;

  return (
    <div
      className={`flex justify-center mx-auto ${compact ? "w-[6.5rem] max-w-[8rem]" : "w-full min-w-[7rem] max-w-[13rem]"}`}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className={compact ? "w-full h-[34px]" : "w-full h-12"}
        role="img"
        aria-label="累積 Alpha の長期推移"
      >
        <title>Cumulative alpha trend</title>
        <rect x={padX} y={padY} width={W - 2 * padX} height={midY - padY} fill="rgba(16, 185, 129, 0.08)" />
        <rect x={padX} y={midY} width={W - 2 * padX} height={midY - padY} fill="rgba(244, 63, 94, 0.08)" />
        <line
          x1={padX}
          x2={W - padX}
          y1={midY}
          y2={midY}
          stroke="rgb(71 85 105)"
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
                strokeWidth={segmentWidth}
                strokeLinecap="round"
                opacity={segmentOpacity}
                strokeDasharray={dash}
              />
            );
          })
        )}
      </svg>
    </div>
  );
}
