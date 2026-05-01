# 原油マクロ対照（非石油文明 / 石油文明）

## 対象テーマ

`investment_themes.name` が **「非石油文明」** または **「石油文明」** と一致する場合のみ（`isOilStructuralTheme`）。`/api/theme-detail` の `fast=1` では **常に `oilMacroContext: null`**（追加 Yahoo 呼び出しを避ける）。

## スポット指標（`indicators`）

`OIL_THEME_SPOT_MACRO_DEFS`（`src/lib/market-glance-macros.ts`）に定義:

| ラベル | Yahoo シンボル |
|--------|----------------|
| WTI 近月 (CL) | `CL=F` |
| Brent 近月 (BZ) | `BZ=F` |
| Crude (USO) | `USO`（`MARKET_GLANCE_MACRO_DEFS` の USO 行と同一ラベル） |

取得は `fetchOilThemeMacroSpotIndicators`（`price-service.ts`）→ 既存の `fetchHybridCloseAndChangeForYahooSymbol` と同じ経路。

## 並置チャート（`chart`）

- **青線（テーマ構造トレンド）**: `themeStructuralTrendSeries` の `cumulative`（%）。定義は `computeThemeStructuralTrendCumulativeFromWeightedDailyAlphas`（年輪チャートと同一系列）。
- **橙線（WTI 正規化累積）**: Yahoo `CL=F` の終値を、**構造トレンド系列の先頭日の WTI 終値で割った比率から算出した累積騰落率（%）**。先頭日を 0% とする。

## Pearson 相関（`wtiVsThemeTrendCorrelation`）

隣接する構造トレンドの観測日 `(d_{i-1}, d_i)` について:

1. **WTI 日次リターン**: `dailyReturnPercent(close(d_{i-1}), close(d_i))`（`CL=F` 終値、`alpha-logic` と同一定義）。
2. **テーマ日次加重 Alpha**: `cumulative(d_i) - cumulative(d_{i-1})`（累積系列の差分 = その日の加重日次 Alpha）。

双方が有限なペアのみ採用。**ペア数が `OIL_THEME_CORRELATION_MIN_PAIRS`（12）未満のときは相関は `null`**。母標本の Pearson 積率相関（`src/lib/oil-theme-macro-chart.ts` の `pearsonCorrelation`）。

## メタ

- `correlationWindowDays`: `THEME_STRUCTURAL_TREND_LOOKBACK_DAYS`（90）と同値（表示用）。
- `asOf`: `CL=F` 日足の最終バー日付（ベストエフォート、YYYY-MM-DD）。
