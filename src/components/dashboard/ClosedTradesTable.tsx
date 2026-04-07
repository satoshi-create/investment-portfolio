import React, { useMemo, useState } from "react";
import { History } from "lucide-react";

import type { ClosedTradeDashboardRow } from "@/src/types/investment";
import { stickyTdFirst, stickyTdFootFirst, stickyThFirst } from "@/src/components/dashboard/table-sticky";

const jpyFmt = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

function marketLabel(m: "JP" | "US"): string {
  return m === "JP" ? "日本" : "米国";
}

function sideLabel(s: "BUY" | "SELL"): string {
  return s === "SELL" ? "売り" : "買い";
}

function fmtQty(q: number): string {
  if (!Number.isFinite(q)) return "—";
  if (Math.abs(q - Math.round(q)) < 1e-9) return String(Math.round(q));
  return q.toLocaleString("ja-JP", { maximumFractionDigits: 4 });
}

function fmtPct(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

function pctClass(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "text-muted-foreground";
  if (v > 0) return "text-emerald-400";
  if (v < 0) return "text-rose-400";
  return "text-muted-foreground";
}

function pnlClass(v: number): string {
  if (v > 0) return "text-emerald-400";
  if (v < 0) return "text-rose-400";
  return "text-muted-foreground";
}

function computeClosedTradesFooter(rows: ClosedTradeDashboardRow[]) {
  let sumQty = 0;
  let sumCostJpy = 0;
  let sumProceedsJpy = 0;
  let sumFeesJpy = 0;
  let sumRealizedPnlJpy = 0;
  const postExitPcts: number[] = [];

  for (const r of rows) {
    if (Number.isFinite(r.quantity) && r.quantity > 0) sumQty += r.quantity;
    if (Number.isFinite(r.costJpy)) sumCostJpy += r.costJpy;
    if (Number.isFinite(r.proceedsJpy)) sumProceedsJpy += r.proceedsJpy;
    if (Number.isFinite(r.feesJpy)) sumFeesJpy += r.feesJpy;
    if (Number.isFinite(r.realizedPnlJpy)) sumRealizedPnlJpy += r.realizedPnlJpy;
    if (r.postExitReturnPct != null && Number.isFinite(r.postExitReturnPct)) {
      postExitPcts.push(r.postExitReturnPct);
    }
  }

  const avgPostExitPct =
    postExitPcts.length > 0
      ? Math.round((postExitPcts.reduce((a, b) => a + b, 0) / postExitPcts.length) * 100) / 100
      : null;

  return {
    count: rows.length,
    sumQty,
    sumCostJpy,
    sumProceedsJpy,
    sumFeesJpy,
    sumRealizedPnlJpy,
    avgPostExitPct,
    postExitCount: postExitPcts.length,
  };
}

export function ClosedTradesTable({ rows }: { rows: ClosedTradeDashboardRow[] }) {
  const footer = useMemo(() => computeClosedTradesFooter(rows), [rows]);
  const [sortKey, setSortKey] = useState<
    "name" | "ticker" | "date" | "market" | "account" | "side" | "qty" | "cost" | "proceeds" | "fees" | "pnl" | "price" | "post" | "verdict"
  >("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const arr = [...rows];
    const cmpStr = (a: string, b: string) => a.localeCompare(b, "ja");
    const cmpNum = (a: number | null, b: number | null) => {
      const ax = a == null || !Number.isFinite(a) ? null : a;
      const by = b == null || !Number.isFinite(b) ? null : b;
      if (ax == null && by == null) return 0;
      if (ax == null) return 1;
      if (by == null) return -1;
      return ax < by ? -1 : ax > by ? 1 : 0;
    };
    arr.sort((a, b) => {
      switch (sortKey) {
        case "name":
          return dir * cmpStr(a.name ?? "", b.name ?? "");
        case "ticker":
          return dir * cmpStr(a.ticker, b.ticker);
        case "date":
          return dir * cmpStr(a.tradeDate, b.tradeDate);
        case "market":
          return dir * cmpStr(a.market, b.market);
        case "account":
          return dir * cmpStr(a.accountName ?? "", b.accountName ?? "");
        case "side":
          return dir * cmpStr(a.side, b.side);
        case "qty":
          return dir * cmpNum(a.quantity, b.quantity);
        case "cost":
          return dir * cmpNum(a.costJpy, b.costJpy);
        case "proceeds":
          return dir * cmpNum(a.proceedsJpy, b.proceedsJpy);
        case "fees":
          return dir * cmpNum(a.feesJpy, b.feesJpy);
        case "pnl":
          return dir * cmpNum(a.realizedPnlJpy, b.realizedPnlJpy);
        case "price":
          return dir * cmpNum(a.currentPriceJpy, b.currentPriceJpy);
        case "post":
          return dir * cmpNum(a.postExitReturnPct, b.postExitReturnPct);
        case "verdict":
          return dir * cmpStr(a.verdictLabel ?? "", b.verdictLabel ?? "");
        default:
          return 0;
      }
    });
    return arr;
  }, [rows, sortDir, sortKey]);

  function toggleSort(next: typeof sortKey) {
    if (next === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(next);
      setSortDir("desc");
    }
  }

  function sortMark(k: typeof sortKey) {
    if (k !== sortKey) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-2xl">
      <div className="p-5 border-b border-border bg-card/60 flex items-center gap-2">
        <History size={16} className="text-amber-500/90" />
        <div>
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">取引履歴</h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            完了済み売買（DB: trade_history・売却のみ）。現在価格は Yahoo 終値ベース（米国株は{" "}
            <span className="font-mono text-muted-foreground/90">USD_JPY_RATE</span> で円換算）。
          </p>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-sm text-muted-foreground">
          行がありません。マイグレーション{" "}
          <span className="font-mono text-muted-foreground/90">005_trade_history</span> を適用し、
          <span className="font-mono text-muted-foreground/90"> trade_history</span> にデータを投入してください。
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[1280px]">
            <thead className="bg-background text-muted-foreground text-[10px] uppercase font-bold tracking-[0.06em]">
              <tr>
                <th
                  className={`px-3 py-3 whitespace-nowrap min-w-[7rem] max-w-[10rem] ${stickyThFirst} cursor-pointer select-none`}
                  onClick={() => toggleSort("name")}
                  title="Sort"
                >
                  銘柄名{sortMark("name")}
                </th>
                <th className="px-3 py-3 whitespace-nowrap cursor-pointer select-none" onClick={() => toggleSort("ticker")} title="Sort">
                  ティッカー{sortMark("ticker")}
                </th>
                <th className="px-3 py-3 whitespace-nowrap cursor-pointer select-none" onClick={() => toggleSort("date")} title="Sort">
                  約定日{sortMark("date")}
                </th>
                <th className="px-3 py-3 whitespace-nowrap cursor-pointer select-none" onClick={() => toggleSort("market")} title="Sort">
                  市場{sortMark("market")}
                </th>
                <th className="px-3 py-3 whitespace-nowrap cursor-pointer select-none" onClick={() => toggleSort("account")} title="Sort">
                  口座{sortMark("account")}
                </th>
                <th className="px-3 py-3 whitespace-nowrap cursor-pointer select-none" onClick={() => toggleSort("side")} title="Sort">
                  売買{sortMark("side")}
                </th>
                <th className="px-3 py-3 text-right whitespace-nowrap cursor-pointer select-none" onClick={() => toggleSort("qty")} title="Sort">
                  数量{sortMark("qty")}
                </th>
                <th className="px-3 py-3 text-right whitespace-nowrap cursor-pointer select-none" onClick={() => toggleSort("cost")} title="Sort">
                  取得代金（円）{sortMark("cost")}
                </th>
                <th className="px-3 py-3 text-right whitespace-nowrap cursor-pointer select-none" onClick={() => toggleSort("proceeds")} title="Sort">
                  譲渡代金（円）{sortMark("proceeds")}
                </th>
                <th className="px-3 py-3 text-right whitespace-nowrap cursor-pointer select-none" onClick={() => toggleSort("fees")} title="Sort">
                  諸経費{sortMark("fees")}
                </th>
                <th className="px-3 py-3 text-right whitespace-nowrap cursor-pointer select-none" onClick={() => toggleSort("pnl")} title="Sort">
                  確定損益{sortMark("pnl")}
                </th>
                <th className="px-3 py-3 text-right whitespace-nowrap cursor-pointer select-none" onClick={() => toggleSort("price")} title="Sort">
                  現在価格（円/単位）{sortMark("price")}
                </th>
                <th className="px-3 py-3 text-right whitespace-nowrap cursor-pointer select-none" onClick={() => toggleSort("post")} title="Sort">
                  売却後騰落率{sortMark("post")}
                </th>
                <th className="px-3 py-3 whitespace-nowrap cursor-pointer select-none" onClick={() => toggleSort("verdict")} title="Sort">
                  売却判定{sortMark("verdict")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {sorted.map((r) => (
                <tr key={r.id} className="group hover:bg-muted/60 transition-colors">
                  <td
                    className={`px-3 py-2.5 text-muted-foreground text-xs min-w-[7rem] max-w-[10rem] ${stickyTdFirst}`}
                    title={r.name || undefined}
                  >
                    <span className="line-clamp-3 break-words">{r.name || "—"}</span>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-foreground/90 text-xs whitespace-nowrap">
                    {r.ticker}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-muted-foreground text-xs whitespace-nowrap">
                    {r.tradeDate}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground text-xs whitespace-nowrap">
                    {marketLabel(r.market)}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground text-xs whitespace-nowrap">
                    {r.accountName}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground text-xs whitespace-nowrap">
                    {sideLabel(r.side)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-muted-foreground text-xs">
                    {fmtQty(r.quantity)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-muted-foreground text-xs">
                    {jpyFmt.format(r.costJpy)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-muted-foreground text-xs">
                    {jpyFmt.format(r.proceedsJpy)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-muted-foreground text-xs">
                    {jpyFmt.format(r.feesJpy)}
                  </td>
                  <td
                    className={`px-3 py-2.5 text-right font-mono text-xs font-medium ${pnlClass(r.realizedPnlJpy)}`}
                  >
                    {jpyFmt.format(r.realizedPnlJpy)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-foreground/90 text-xs">
                    {r.currentPriceJpy != null && Number.isFinite(r.currentPriceJpy)
                      ? jpyFmt.format(r.currentPriceJpy)
                      : "—"}
                  </td>
                  <td
                    className={`px-3 py-2.5 text-right font-mono text-xs font-medium ${pctClass(r.postExitReturnPct)}`}
                  >
                    {fmtPct(r.postExitReturnPct)}
                  </td>
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap text-foreground/90">
                    {r.verdictLabel}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="group bg-card/95 border-t border-border">
                <td
                  className={`px-3 py-3 text-xs font-bold text-foreground/90 min-w-[7rem] max-w-[10rem] ${stickyTdFootFirst}`}
                >
                  Σ / 平均
                  <span className="block text-[10px] font-normal text-muted-foreground font-mono">
                    {footer.count} 件
                  </span>
                </td>
                <td className="px-3 py-3 text-[10px] text-muted-foreground whitespace-nowrap">—</td>
                <td className="px-3 py-3 text-[10px] text-muted-foreground whitespace-nowrap">—</td>
                <td className="px-3 py-3 text-[10px] text-muted-foreground whitespace-nowrap">—</td>
                <td className="px-3 py-3 text-[10px] text-muted-foreground whitespace-nowrap">—</td>
                <td className="px-3 py-3 text-[10px] text-muted-foreground whitespace-nowrap">—</td>
                <td
                  className="px-3 py-3 text-right font-mono text-sm font-bold text-foreground whitespace-nowrap"
                  title="日本株・米株で単位が異なるため参考値です。"
                >
                  {footer.sumQty > 0 ? fmtQty(footer.sumQty) : "—"}
                </td>
                <td className="px-3 py-3 text-right font-mono text-sm font-bold text-foreground whitespace-nowrap">
                  {footer.count > 0 ? jpyFmt.format(footer.sumCostJpy) : "—"}
                </td>
                <td className="px-3 py-3 text-right font-mono text-sm font-bold text-foreground whitespace-nowrap">
                  {footer.count > 0 ? jpyFmt.format(footer.sumProceedsJpy) : "—"}
                </td>
                <td className="px-3 py-3 text-right font-mono text-xs font-bold text-muted-foreground whitespace-nowrap">
                  {footer.count > 0 ? jpyFmt.format(footer.sumFeesJpy) : "—"}
                </td>
                <td
                  className={`px-3 py-3 text-right font-mono text-sm font-bold whitespace-nowrap ${pnlClass(footer.sumRealizedPnlJpy)}`}
                >
                  {footer.count > 0 ? jpyFmt.format(footer.sumRealizedPnlJpy) : "—"}
                </td>
                <td className="px-3 py-3 text-right text-[10px] text-muted-foreground whitespace-nowrap">—</td>
                <td
                  className={`px-3 py-3 text-right font-mono text-xs font-bold whitespace-nowrap ${pctClass(footer.avgPostExitPct)}`}
                  title={`売却後騰落率が算出できた ${footer.postExitCount} 件の算術平均`}
                >
                  {footer.avgPostExitPct != null ? (
                    <span>
                      Avg {fmtPct(footer.avgPostExitPct)}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-3 text-[10px] text-muted-foreground whitespace-nowrap">—</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
