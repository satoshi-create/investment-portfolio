import React from "react";

import type { AlphaHistory } from "@/src/types/investment";
import { cn } from "@/src/lib/cn";

/** 5d / 短期トレンド用ミニチャート。色は `app/globals.css` の `--accent-emerald` / `--accent-rose` に準拠 */
export function TrendMiniChart({
  history,
  maxPoints = 12,
  lastBarPulse = false,
  isCompoundingIgnited = false,
}: {
  history: AlphaHistory;
  maxPoints?: number;
  /** 最後の棒が本日の暫定 Alpha（ライブ）のときハイライト */
  lastBarPulse?: boolean;
  /** 複利点火（二階微分）検出時: コンテナにエメラルド系の発光（最終バーの ring とは別レイヤー） */
  isCompoundingIgnited?: boolean;
}) {
  const pts = Array.isArray(history) ? history.slice(-Math.max(1, Math.floor(maxPoints))) : [];
  /** 単日の壊れた Alpha でバー高さが他を潰さないよう表示だけ緩衝 */
  const barHeightPx = (h: number) => {
    const w = Math.max(-25, Math.min(25, h));
    return Math.min(Math.abs(w) * 5 + 2, 24);
  };
  const ariaTrend = isCompoundingIgnited ? "短期 Alpha トレンド、複利点火あり" : "短期 Alpha トレンド";
  return (
    <div
      className={cn(
        "mx-auto flex min-w-[4.25rem] shrink-0 justify-center gap-1 h-6 items-end rounded-md px-0.5",
        isCompoundingIgnited &&
          "animate-pulse shadow-[0_0_14px_rgb(var(--accent-emerald)/0.38)] ring-1 ring-accent-emerald/45",
      )}
      role="img"
      aria-label={ariaTrend}
    >
      {pts.map((h, i) => {
        const isLast = i === pts.length - 1;
        const w = Math.max(-25, Math.min(25, h));
        return (
          <div
            key={i}
            className={cn(
              "w-1.5 rounded-full",
              w > 0 ? "bg-accent-emerald/50" : "bg-accent-rose/50",
              lastBarPulse && isLast && "ring-1 ring-cyan-400/55",
            )}
            style={{ height: `${barHeightPx(h)}px` }}
          />
        );
      })}
    </div>
  );
}
