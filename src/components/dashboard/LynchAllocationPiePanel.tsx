"use client";

import React, { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import type { Stock, ThemeEcosystemWatchItem } from "@/src/types/investment";
import { useCurrencyConverter } from "@/src/hooks/use-currency-converter";
import { formatJpyValueForView } from "@/src/lib/format-display-currency";
import {
  buildLynchPieRows,
  buildLynchPieRowsFromWatchItems,
  type LynchPieRow,
} from "@/src/lib/lynch-allocation-pie";

type PieSource = "holdings" | "watch";

function LynchPieTooltip({
  active,
  payload,
  viewCurrency,
  convert,
  pieSource,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: LynchPieRow }>;
  viewCurrency: "USD" | "JPY";
  convert: (amount: number, from: "USD" | "JPY", to: "USD" | "JPY") => number;
  pieSource: PieSource;
}) {
  if (!active || payload == null || payload.length === 0) return null;
  const p = payload[0]?.payload;
  if (p == null) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-[10px] shadow-lg">
      <p className="font-bold text-foreground">{p.name}</p>
      <p className="font-mono text-muted-foreground mt-1 tabular-nums">
        {pieSource === "holdings"
          ? `${formatJpyValueForView(p.value, viewCurrency, convert)}（${p.pct.toFixed(1)}%）`
          : `${p.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}（${p.pct.toFixed(1)}%）`}
      </p>
      {pieSource === "watch" ? (
        <p className="text-muted-foreground/90 mt-0.5 text-[9px] leading-snug">
          観測ウェイト（MCAP→ラウンド評価額→等重み）。通貨は銘柄により異なります。
        </p>
      ) : null}
      <p className="text-muted-foreground mt-0.5">{p.count} 銘柄</p>
    </div>
  );
}

type Props = {
  stocks: Stock[];
  /** テーマ API の観測ウォッチ。保有ベースの円が空のときにフォールバックで使用。 */
  ecosystem?: readonly ThemeEcosystemWatchItem[];
  /** ラッパーに余白・枠を付けない（親カード内の右カラム用） */
  bare?: boolean;
  className?: string;
};

export function LynchAllocationPiePanel({ stocks, ecosystem, bare = false, className }: Props) {
  const { convert, viewCurrency } = useCurrencyConverter();
  const { lynchPieRows, pieSource } = useMemo(() => {
    const fromHoldings = buildLynchPieRows(stocks);
    if (fromHoldings.length > 0) {
      return { lynchPieRows: fromHoldings, pieSource: "holdings" as const };
    }
    const fromWatch = buildLynchPieRowsFromWatchItems(ecosystem ?? []);
    if (fromWatch.length > 0) {
      return { lynchPieRows: fromWatch, pieSource: "watch" as const };
    }
    return { lynchPieRows: [] as LynchPieRow[], pieSource: "holdings" as const };
  }, [stocks, ecosystem]);

  const inner = (
    <>
      <h4
        id="lynch-allocation-heading"
        className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1"
      >
        リンチ分類（評価額）
      </h4>
      {lynchPieRows.length === 0 ? (
        <p className="text-[9px] text-muted-foreground mb-3 leading-relaxed">
          テーマ内保有（数量 &gt; 0 かつ評価額あり）を優先し、該当がなければ観測ウォッチ全行で表示します（ウェイトは
          時価総額→ラウンド評価額→等重み）。分類はルールベース自動判定で、DB の expectation_category は参照しません。
        </p>
      ) : pieSource === "holdings" ? (
        <p className="text-[9px] text-muted-foreground mb-3 leading-relaxed">
          数量 &gt; 0 かつ評価額がある銘柄のみ。シェアは円ベース評価額の合計に対する比率です。分類は Inventory
          と同じルールベース自動判定です。DB の expectation_category は参照しません。
        </p>
      ) : (
        <p className="text-[9px] text-muted-foreground mb-3 leading-relaxed">
          テーマ内の評価額付き保有がないため、観測ウォッチ全行を対象にしています。シェアは時価総額（取得時）→
          直近ラウンド評価額→等重み（1）の合成ウェイトに対する比率です。分類は観測表と同じルールベース自動判定で、DB
          の expectation_category は参照しません。
        </p>
      )}
      {lynchPieRows.length > 0 ? (
        <>
          <div className="h-[200px] w-full max-w-[280px] mx-auto lg:mx-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={lynchPieRows}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={80}
                  paddingAngle={1}
                  stroke="rgba(148,163,184,0.35)"
                  strokeWidth={1}
                >
                  {lynchPieRows.map((row) => (
                    <Cell key={row.key} fill={row.fill} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => (
                    <LynchPieTooltip
                      active={active}
                      payload={payload}
                      viewCurrency={viewCurrency}
                      convert={convert}
                      pieSource={pieSource}
                    />
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-3 space-y-1.5 max-w-[280px] mx-auto lg:mx-0">
            {lynchPieRows.map((row) => (
              <li
                key={row.key}
                className="flex justify-between gap-2 text-[10px] font-bold uppercase tracking-tighter"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span
                    className="inline-block h-2 w-2 shrink-0 rounded-full border border-white/10"
                    style={{ backgroundColor: row.fill }}
                  />
                  <span className="truncate text-foreground/85">{row.name}</span>
                </span>
                <span className="font-mono text-foreground/85 shrink-0 tabular-nums">
                  {row.pct.toFixed(1)}%
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          評価額のある保有、または観測ウォッチの対象がありません。
        </p>
      )}
    </>
  );

  if (bare) {
    return (
      <div className={className} aria-labelledby="lynch-allocation-heading">
        {inner}
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-border bg-card/60 px-4 py-4 md:px-5 ${className ?? ""}`}
      aria-labelledby="lynch-allocation-heading"
    >
      {inner}
    </div>
  );
}
