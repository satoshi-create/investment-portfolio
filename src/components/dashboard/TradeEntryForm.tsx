"use client";

import React, { useId, useMemo, useState, useTransition } from "react";
import { X } from "lucide-react";

import { executeTradeAction } from "@/app/actions/trades";
import { classifyTickerInstrument } from "@/src/lib/alpha-logic";
import { calculateMonexUsFee } from "@/src/lib/fees";
import { USD_JPY_RATE_FALLBACK } from "@/src/lib/fx-constants";

export type TradeEntryInitial = {
  ticker: string;
  name?: string;
  /** structure_tags の先頭（テーマ） */
  theme?: string;
  /** structure_tags の 2 番目および holdings.sector */
  sector?: string;
};

type Props = {
  userId: string;
  open: boolean;
  initial: TradeEntryInitial | null;
  onClose: () => void;
  onSuccess?: () => void;
  /** 取引実行時の円換算はサーバーで `JPY=X` を再取得。ここは表示ヒント用。 */
  fxUsdJpy?: number | null;
  /** 保有銘柄（候補）。未指定・空なら手入力のみ。 */
  holdingOptions?: { ticker: string; name: string }[];
};

function todayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function TradeEntryForm({
  userId,
  open,
  initial,
  onClose,
  onSuccess,
  fxUsdJpy,
  holdingOptions = [],
}: Props) {
  if (!open) return null;

  return (
    <TradeEntryFormInner
      key={initial?.ticker ?? "__new__"}
      userId={userId}
      initial={initial}
      onClose={onClose}
      onSuccess={onSuccess}
      fxUsdJpy={fxUsdJpy}
      holdingOptions={holdingOptions}
    />
  );
}

function TradeEntryFormInner({
  userId,
  initial,
  onClose,
  onSuccess,
  fxUsdJpy,
  holdingOptions,
}: Omit<Props, "open">) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const [ticker, setTicker] = useState(initial?.ticker ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [autoFee, setAutoFee] = useState(true);
  const [manualFeeLocal, setManualFeeLocal] = useState("");
  const [tradeDate, setTradeDate] = useState(todayYmd());
  const [accountName, setAccountName] = useState<"特定" | "NISA">("特定");
  const [category, setCategory] = useState<"Core" | "Satellite">("Satellite");
  const [structureTheme, setStructureTheme] = useState(initial?.theme ?? "");
  const [structureSector, setStructureSector] = useState(initial?.sector ?? "");

  const isJp = useMemo(() => classifyTickerInstrument(ticker) === "JP_INVESTMENT_TRUST", [ticker]);
  const isUs = useMemo(() => classifyTickerInstrument(ticker) === "US_EQUITY", [ticker]);

  const tickerDatalistId = useId();

  const sortedHoldingOptions = useMemo(() => {
    const seen = new Set<string>();
    const out: { ticker: string; name: string }[] = [];
    for (const h of holdingOptions) {
      const t = h.ticker.trim();
      if (t.length === 0 || seen.has(t)) continue;
      seen.add(t);
      out.push({ ticker: t, name: (h.name ?? "").trim() || t });
    }
    out.sort((a, b) => a.ticker.localeCompare(b.ticker, "en"));
    return out;
  }, [holdingOptions]);
  const fxHint =
    fxUsdJpy != null && Number.isFinite(fxUsdJpy) && fxUsdJpy > 0 ? fxUsdJpy : USD_JPY_RATE_FALLBACK;
  const unitLabel = isJp
    ? `単価（円 / 口・株）`
    : `単価（USD / 株）→ 概算円換算 × ${fxHint.toFixed(2)}（参考・実行時は JPY=X）`;
  const feeCurrency: "JPY" | "USD" = isUs ? "USD" : "JPY";

  const parsedQty = useMemo(() => Number(quantity.replace(/,/g, "")), [quantity]);
  const parsedUnit = useMemo(() => Number(unitPrice.replace(/,/g, "")), [unitPrice]);

  const estimatedFeeLocal = useMemo(() => {
    if (!autoFee) return null;
    if (!Number.isFinite(parsedQty) || parsedQty <= 0) return null;
    if (!Number.isFinite(parsedUnit) || parsedUnit <= 0) return null;
    if (!isUs) return 0;
    return calculateMonexUsFee(parsedQty, parsedUnit);
  }, [autoFee, isUs, parsedQty, parsedUnit]);

  const feeLocal = autoFee ? (estimatedFeeLocal != null ? String(estimatedFeeLocal) : "") : manualFeeLocal;

  const feeLocalNumber = useMemo(() => {
    const v = Number(String(feeLocal).replace(/,/g, ""));
    return Number.isFinite(v) && v >= 0 ? v : 0;
  }, [feeLocal]);

  const feesJpyComputed = useMemo(() => {
    if (feeCurrency === "JPY") return Math.round(feeLocalNumber);
    return Math.round(feeLocalNumber * fxHint);
  }, [feeCurrency, feeLocalNumber, fxHint]);

  const feePreviewText = useMemo(() => {
    if (!Number.isFinite(parsedQty) || parsedQty <= 0) return "—";
    if (!Number.isFinite(parsedUnit) || parsedUnit <= 0) return "—";
    const notional = parsedQty * parsedUnit;
    const effective = (notional + feeLocalNumber) / parsedQty;
    if (!Number.isFinite(effective) || effective <= 0) return "—";
    const base = feeCurrency === "JPY" ? `手数料: ¥${feeLocalNumber.toFixed(0)}` : `手数料: $${feeLocalNumber.toFixed(2)}`;
    const jpy = feeCurrency === "USD" ? `（約 ¥${feesJpyComputed.toLocaleString()}）` : "";
    const effLabel = feeCurrency === "JPY" ? `手数料込み単価: ¥${effective.toFixed(0)}` : `手数料込み単価: $${effective.toFixed(4)}`;
    return `${base}${jpy} / ${effLabel}`;
  }, [feeCurrency, feeLocalNumber, feesJpyComputed, parsedQty, parsedUnit]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const q = parsedQty;
    const p = parsedUnit;
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
        feeLocal: feeLocalNumber,
        feeCurrency,
        feesJpy: feesJpyComputed,
        tradeDate,
        categoryForNewHolding: category,
        structureTheme: structureTheme.trim(),
        structureSector: structureSector.trim(),
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
            {initial ? (
              <input
                value={ticker}
                readOnly
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 font-mono opacity-90"
              />
            ) : (
              <>
                <input
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value)}
                  list={sortedHoldingOptions.length > 0 ? tickerDatalistId : undefined}
                  autoComplete="off"
                  placeholder={
                    sortedHoldingOptions.length > 0
                      ? "保有から選ぶか、ティッカーを入力"
                      : "ティッカーを入力（例: AAPL, 9501）"
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 font-mono"
                  required
                />
                {sortedHoldingOptions.length > 0 ? (
                  <datalist id={tickerDatalistId}>
                    {sortedHoldingOptions.map((h) => (
                      <option key={h.ticker} value={h.ticker}>
                        {h.name !== h.ticker ? h.name : undefined}
                      </option>
                    ))}
                  </datalist>
                ) : null}
                <p className="text-[9px] text-slate-600 mt-1">
                  下矢印で保有候補を表示。候補にない銘柄もそのまま入力できます。
                </p>
              </>
            )}
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">銘柄名（任意）</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
              Theme（構造投資テーマ）
            </label>
            <input
              value={structureTheme}
              onChange={(e) => setStructureTheme(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
              placeholder="例: グロース / 非石油文明"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Sector（セクター）</label>
            <input
              value={structureSector}
              onChange={(e) => setStructureSector(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
              placeholder="例: ソフトウェア / エネルギー"
            />
            <p className="text-[9px] text-slate-600 mt-1">
              保存時: structure_tags の [0]=Theme、[1]=Sector、かつ sector 列に Sector を保存します。
            </p>
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
              <div className="flex rounded-lg border border-slate-700 bg-slate-950 p-1">
                <button
                  type="button"
                  onClick={() => setAccountName("特定")}
                  className={`flex-1 rounded-md px-2 py-1.5 text-xs font-bold ${
                    accountName === "特定" ? "bg-slate-800 text-slate-100" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  特定
                </button>
                <button
                  type="button"
                  onClick={() => setAccountName("NISA")}
                  className={`flex-1 rounded-md px-2 py-1.5 text-xs font-bold ${
                    accountName === "NISA" ? "bg-slate-800 text-slate-100" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  NISA
                </button>
              </div>
              <p className="text-[9px] text-slate-600 mt-1">短期 Alpha 狙いは「特定」デフォルト。</p>
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
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase text-slate-500">
                  {feeCurrency === "USD" ? "推定手数料（USD, Monex US）" : "手数料（JPY）"}
                </p>
                <label className="flex items-center gap-2 text-[10px] text-slate-400 select-none">
                  <input
                    type="checkbox"
                    checked={autoFee}
                    onChange={(e) => setAutoFee(e.target.checked)}
                    className="accent-cyan-500"
                  />
                  自動計算
                </label>
              </div>

              <input
                value={feeLocal}
                onChange={(e) => {
                  setAutoFee(false);
                  setManualFeeLocal(e.target.value);
                }}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 font-mono"
                inputMode="decimal"
                placeholder={feeCurrency === "USD" ? "例: 0.99" : "例: 0"}
              />
              <p className="text-[9px] text-slate-600">{feePreviewText}</p>
              {feeCurrency === "USD" ? (
                <p className="text-[9px] text-slate-600">
                  送信時に円換算: 約 ¥{feesJpyComputed.toLocaleString()}（参考。実行時の最終円換算はサーバー側のレートに依存）
                </p>
              ) : null}
            </div>
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
