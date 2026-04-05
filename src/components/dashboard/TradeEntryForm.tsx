"use client";

import React, { useEffect, useMemo, useState, useTransition } from "react";
import { X } from "lucide-react";

import { executeTradeAction } from "@/app/actions/trades";
import { classifyTickerInstrument, USD_JPY_RATE } from "@/src/lib/alpha-logic";

export type TradeEntryInitial = {
  ticker: string;
  name?: string;
};

type Props = {
  userId: string;
  open: boolean;
  initial: TradeEntryInitial | null;
  onClose: () => void;
  onSuccess?: () => void;
};

function todayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function TradeEntryForm({ userId, open, initial, onClose, onSuccess }: Props) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const [ticker, setTicker] = useState("");
  const [name, setName] = useState("");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [feesJpy, setFeesJpy] = useState("0");
  const [tradeDate, setTradeDate] = useState(todayYmd);
  const [accountName, setAccountName] = useState("特定");
  const [category, setCategory] = useState<"Core" | "Satellite">("Satellite");

  useEffect(() => {
    if (!open) return;
    setMessage(null);
    if (initial) {
      setTicker(initial.ticker);
      setName(initial.name ?? "");
    } else {
      setTicker("");
      setName("");
    }
    setTradeDate(todayYmd());
  }, [open, initial]);

  const isJp = useMemo(() => classifyTickerInstrument(ticker) === "JP_INVESTMENT_TRUST", [ticker]);
  const unitLabel = isJp ? `単価（円 / 口・株）` : `単価（USD / 株）→ 円換算 × ${USD_JPY_RATE}`;

  if (!open) return null;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const q = Number(quantity.replace(/,/g, ""));
    const p = Number(unitPrice.replace(/,/g, ""));
    const f = Number(String(feesJpy).replace(/,/g, ""));
    if (!ticker.trim()) {
      setMessage("ティッカーを入力してください。");
      return;
    }
    startTransition(async () => {
      const res = await executeTradeAction({
        userId,
        ticker: ticker.trim(),
        name: name.trim() || undefined,
        accountName,
        side,
        quantity: q,
        unitPriceLocal: p,
        feesJpy: Number.isFinite(f) ? f : 0,
        tradeDate,
        categoryForNewHolding: category,
      });
      setMessage(res.message);
      if (res.ok) {
        onSuccess?.();
        onClose();
      }
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        onClick={() => !pending && onClose()}
      />
      <div
        className="relative w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
        role="dialog"
        aria-modal="true"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-900/95 px-4 py-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">取引実行</h2>
          <button
            type="button"
            onClick={() => !pending && onClose()}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-slate-300"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 p-4">
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">ティッカー</label>
            <input
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 font-mono"
              placeholder="NVDA / 9501"
              required
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">銘柄名（任意）</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">売買</label>
              <select
                value={side}
                onChange={(e) => setSide(e.target.value === "SELL" ? "SELL" : "BUY")}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
              >
                <option value="BUY">買い</option>
                <option value="SELL">売り</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">口座</label>
              <select
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
              >
                <option value="特定">特定</option>
                <option value="NISA">NISA</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">数量</label>
            <input
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 font-mono"
              inputMode="decimal"
              required
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">{unitLabel}</label>
            <input
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 font-mono"
              inputMode="decimal"
              placeholder={isJp ? "例: 646" : "例: 39.42"}
              required
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">手数料（円）</label>
            <input
              value={feesJpy}
              onChange={(e) => setFeesJpy(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 font-mono"
              inputMode="numeric"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">約定日</label>
            <input
              type="date"
              value={tradeDate}
              onChange={(e) => setTradeDate(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
              required
            />
          </div>
          {side === "BUY" ? (
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                新規買い時のカテゴリ
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value === "Core" ? "Core" : "Satellite")}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
              >
                <option value="Satellite">Satellite</option>
                <option value="Core">Core</option>
              </select>
            </div>
          ) : null}

          {message ? (
            <p className={`text-xs ${message.includes("記録") || message.includes("更新") ? "text-emerald-400" : "text-rose-400"}`}>
              {message}
            </p>
          ) : null}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => onClose()}
              disabled={pending}
              className="flex-1 rounded-lg border border-slate-600 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-800 disabled:opacity-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={pending}
              className="flex-1 rounded-lg bg-cyan-600/90 py-2.5 text-xs font-bold text-white hover:bg-cyan-500 disabled:opacity-50"
            >
              {pending ? "実行中…" : "実行"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
