"use client";

import * as React from "react";

import { TrendMiniChart } from "@/src/components/dashboard/TrendMiniChart";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/src/components/ui/tooltip";

/**
 * 指標本体の時系列が無い列向け: ホバーで日次 α（%）の直近推移を表示（観測日アンカー）。
 * cum α 列・累積トレンド列では使わない。
 */
export function DailyAlphaContextTooltip({
  children,
  dailyValues,
  observationDates,
  metricLabel,
}: {
  children: React.ReactNode;
  dailyValues: readonly number[];
  observationDates?: readonly string[] | null;
  metricLabel: string;
}) {
  const n = dailyValues.length;
  if (n < 2) {
    return (
      <span
        className="inline-flex min-w-0 max-w-full cursor-help"
        title={`${metricLabel}: 日次αの観測点が2未満のため推移チャートは出ません（指標値のみ）。`}
      >
        {children}
      </span>
    );
  }
  const show = Math.min(14, n);
  const vals = dailyValues.slice(-show);
  const datesOk =
    observationDates != null &&
    observationDates.length === dailyValues.length &&
    observationDates.length >= show;
  const dates = datesOk ? observationDates.slice(-show) : null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex min-w-0 max-w-full cursor-help select-none">{children}</span>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-[min(18rem,90vw)]">
        <p className="mb-1.5 text-[10px] font-bold text-foreground">{metricLabel}</p>
        <p className="mb-2 text-[9px] leading-snug text-muted-foreground">
          本指標の履歴系列は未取得のため、観測に紐づく日次 α（%）をアンカーとして表示しています。
        </p>
        <div className="flex justify-center py-1">
          <TrendMiniChart history={[...vals]} maxPoints={show} lastBarPulse={false} />
        </div>
        <table className="mt-1 w-full border-collapse text-[9px] tabular-nums">
          <tbody>
            {vals.map((v, i) => (
              <tr key={i} className="border-t border-border/50 first:border-t-0">
                <td className="py-0.5 pr-2 text-muted-foreground">{dates?.[i] ?? `−${show - i}`}</td>
                <td className="py-0.5 text-right font-mono">
                  {Number.isFinite(v) ? `${v >= 0 ? "+" : ""}${v.toFixed(2)}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TooltipContent>
    </Tooltip>
  );
}
