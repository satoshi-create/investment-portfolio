"use client";

import React, { useEffect, useId, useMemo, useState, useTransition } from "react";
import { X } from "lucide-react";

import { executeTradeAction, listInvestmentThemesForUser } from "@/app/actions/trades";
import { classifyTickerInstrument } from "@/src/lib/alpha-logic";
import type { LynchCategory } from "@/src/types/investment";
import { LYNCH_CATEGORY_KEYS, LYNCH_CATEGORY_LABEL_JA } from "@/src/types/investment";
import { calculateMonexUsFee } from "@/src/lib/fees";
import { USD_JPY_RATE_FALLBACK } from "@/src/lib/fx-constants";

export type TradeEntryInitial = {
  ticker: string;
  name?: string;
  /** structure_tags の先頭（テーマ）。ドロップダウン未選択時の手入力にも使用 */
  theme?: string;
  /** `investment_themes.id`（テーマページなど） */
  themeId?: string;
  /** structure_tags の 2 番目および holdings.sector */
  sector?: string;
  /** 現在値（米株=USD/株、投信等=円） */
  unitPrice?: number | null;
  /** 数量の初期値（既定 1） */
  quantityDefault?: number;
  /** `holdings.expectation_category`（リンチ分類）の既存値（取引ボタンから開いたとき） */
  expectationCategory?: LynchCategory | null;
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

function formatInitialUnitPriceLocal(ticker: string, price: number): string {
  const kind = classifyTickerInstrument(ticker.trim());
  if (!Number.isFinite(price) || price <= 0) return "";
  if (kind !== "US_EQUITY") return String(Math.round(price));
  return price.toFixed(2);
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
      key={`${initial?.ticker ?? "__new__"}|${initial?.unitPrice ?? ""}|${initial?.theme ?? ""}|${initial?.themeId ?? ""}|${initial?.quantityDefault ?? ""}|${initial?.expectationCategory ?? ""}`}
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
  const [quantity, setQuantity] = useState(() => {
    const q = initial?.quantityDefault;
    if (q != null && Number.isFinite(q) && q > 0) return String(q);
    return "1";
  });
  const [unitPrice, setUnitPrice] = useState(() =>
    initial?.ticker &&
    initial?.unitPrice != null &&
    Number.isFinite(initial.unitPrice) &&
    initial.unitPrice > 0
      ? formatInitialUnitPriceLocal(initial.ticker, initial.unitPrice)
      : "",
  );
  const [autoFee, setAutoFee] = useState(true);
  const [manualFeeLocal, setManualFeeLocal] = useState("");
  const [tradeDate, setTradeDate] = useState(todayYmd());
  const [accountName, setAccountName] = useState<"特定" | "NISA">("特定");
  const [category, setCategory] = useState<"Core" | "Satellite">("Satellite");
  const [structureTheme, setStructureTheme] = useState(initial?.theme ?? "");
  const [structureSector, setStructureSector] = useState(initial?.sector ?? "");
  const [selectedThemeId, setSelectedThemeId] = useState(initial?.themeId?.trim() ?? "");
  const [themeOptions, setThemeOptions] = useState<{ id: string; name: string }[]>([]);
  const [tradeReason, setTradeReason] = useState("");
  const [expectationCategory, setExpectationCategory] = useState<string>(() =>
    initial?.expectationCategory != null ? initial.expectationCategory : "",
  );
  const [exitRuleEnabled, setExitRuleEnabled] = useState(false);
  const [stopLossPctInput, setStopLossPctInput] = useState("");
  const [targetProfitPctInput, setTargetProfitPctInput] = useState("");
  const [tradeDeadlineInput, setTradeDeadlineInput] = useState("");

  useEffect(() => {
    let cancelled = false;
    void listInvestmentThemesForUser(userId).then((rows) => {
      if (cancelled) return;
      setThemeOptions(rows);

      // Resolve initial theme selection once we have options.
      const tid = initial?.themeId?.trim();
      if (tid && rows.some((t) => t.id === tid)) {
        setSelectedThemeId(tid);
        const row = rows.find((t) => t.id === tid);
        if (row) setStructureTheme(row.name);
        return;
      }
      const th = initial?.theme?.trim();
      if (th) {
        const m = rows.find((t) => t.name.trim() === th);
        if (m) {
          setSelectedThemeId(m.id);
          setStructureTheme(m.name);
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [userId, initial?.themeId, initial?.theme]);

  const isJp = useMemo(() => classifyTickerInstrument(ticker) !== "US_EQUITY", [ticker]);
  const isUs = useMemo(() => classifyTickerInstrument(ticker) === "US_EQUITY", [ticker]);

  const tickerDatalistId = useId();

  const sortedHoldingOptions = useMemo(() => {
    const safeHoldingOptions = holdingOptions ?? [];
    const seen = new Set<string>();
    const out: { ticker: string; name: string }[] = [];
    for (const h of safeHoldingOptions) {
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

  function parseOptionalPositivePercentInput(raw: string): number | null {
    const t = raw.trim().replace(/,/g, "");
    if (t.length === 0) return null;
    const n = Number(t);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

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
        themeId: selectedThemeId.trim() || undefined,
        reason: tradeReason.trim() || undefined,
        expectationCategory,
        shortTermExitRules:
          side === "BUY"
            ? {
                stopLossPct: parseOptionalPositivePercentInput(stopLossPctInput),
                targetProfitPct: parseOptionalPositivePercentInput(targetProfitPctInput),
                tradeDeadline: tradeDeadlineInput.trim().length >= 10 ? tradeDeadlineInput.trim().slice(0, 10) : null,
                exitRuleEnabled,
              }
            : undefined,
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
              構造投資テーマ（DB 紐付け）
            </label>
            <select
              value={selectedThemeId}
              onChange={(e) => {
                const v = e.target.value;
                setSelectedThemeId(v);
                if (v === "") return;
                const row = themeOptions.find((t) => t.id === v);
                if (row) setStructureTheme(row.name);
              }}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
            >
              <option value="">— 紐付けなし（下の手入力のみ）—</option>
              {themeOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            {selectedThemeId === "" ? (
              <input
                value={structureTheme}
                onChange={(e) => setStructureTheme(e.target.value)}
                className="w-full mt-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                placeholder="テーマ名（structure_tags 用・例: 非石油文明）"
              />
            ) : (
              <p className="text-[9px] text-slate-600 mt-1">
                取引は <span className="font-mono text-slate-500">{structureTheme}</span> に記録されます（
                <span className="font-mono">theme_id</span> + テーマ名）。
              </p>
            )}
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
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
              リンチ分類（ピーター・リンチ）
            </label>
            <select
              value={expectationCategory}
              onChange={(e) => setExpectationCategory(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
            >
              <option value="">— 未設定 —</option>
              {LYNCH_CATEGORY_KEYS.map((k) => (
                <option key={k} value={k}>
                  {LYNCH_CATEGORY_LABEL_JA[k]}（{k}）
                </option>
              ))}
            </select>
            <p className="text-[9px] text-slate-600 mt-1">
              一覧の「リンチ」列・フィルタと同じ値が保存されます。「未設定」で NULL に更新されます。
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
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
              取引の理由・反省（任意）
            </label>
            <textarea
              value={tradeReason}
              onChange={(e) => setTradeReason(e.target.value)}
              maxLength={4000}
              rows={4}
              placeholder="構造的な変化への対応、パニックへの逆行、テーマとの整合、次に活かすこと…"
              className="w-full resize-y rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 min-h-[5rem]"
            />
            <p className="text-[9px] text-slate-600 mt-1">
              ログの取引履歴で確認できます（最大 4000 文字）。
            </p>
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

          {side === "BUY" ? (
            <div className="rounded-xl border border-slate-700/80 bg-slate-950/50 p-3 space-y-3">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">短期トレード設定</h3>
              <label className="flex items-center gap-2 text-[11px] text-slate-300 select-none">
                <input
                  type="checkbox"
                  checked={exitRuleEnabled}
                  onChange={(e) => setExitRuleEnabled(e.target.checked)}
                  className="accent-cyan-500"
                />
                自己規律ルールを有効にする（損切・利確・期限・Alpha トレイリングはシグナル生成に使用）
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">損切り（%）</label>
                  <input
                    value={stopLossPctInput}
                    onChange={(e) => setStopLossPctInput(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 font-mono"
                    inputMode="decimal"
                    placeholder="例: 5（−5% で損切り）"
                    disabled={!exitRuleEnabled}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">利確（%）</label>
                  <input
                    value={targetProfitPctInput}
                    onChange={(e) => setTargetProfitPctInput(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 font-mono"
                    inputMode="decimal"
                    placeholder="例: 10"
                    disabled={!exitRuleEnabled}
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">賞味期限（任意）</label>
                <input
                  type="date"
                  value={tradeDeadlineInput}
                  onChange={(e) => setTradeDeadlineInput(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                  disabled={!exitRuleEnabled}
                />
                <p className="text-[9px] text-slate-600 mt-1">
                  期限超過で低優先度 WARN が生成されます（当日は含みません）。
                </p>
              </div>
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
