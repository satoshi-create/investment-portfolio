/**
 * 保有（Inventory）とエコシステム・ウォッチリスト表の列ヘッダー用。
 * 文言は実装（alpha-logic・dashboard-data・Yahoo 連携）と矛盾しないよう保守する。
 */

export const METRIC_HEADER_TIP = {
  ruleOf40:
    "成長と収益性のバランス指標。売上成長率% ＋ FCFマージン%（40 近辺超は「成長と現金収益の両立」が期待される帯の目安）。【式】R40 = 売上成長% + FCFマージン%（Yahoo / FMP 由来の値を集約）",
  alpha:
    "日次の相対超過（確定系列は DB `alpha_history` の日次）。ライブ表示時は当日の暫定: 銘柄の日中リターン% − ベンチマークの日中リターン%。米株ライブは ^GSPC、日本株は ^TPX（`computeLiveAlphaDayPercent` / `LIVE_ALPHA_*`）。FX はレンズに入れない。【式】日次α% ≈ 銘柄日次リターン% − ベンチ日次リターン%",
  alphaCumulative:
    "累積 Alpha: 観測起点から日次超過を積み上げた %（銘柄ごと・テーマ加重系列は別計算）。ウォッチ表の数値は `alphaHistory` の最新点。【式】累積α_t = Σ_{s≤t} 日次α_s（実装は `calculateCumulativeAlpha` 系の積算）",
  alphaDeviationZ:
    "σ（Z スコア）: 直近の日次 Alpha が、直前窓（既定最大30営業日・当日除く）の平均・標本標準偏差から何σ外れているか（`computeAlphaDeviationZScore`）。系列不足や分散0は算出不可。【式】Z = (α_当日 − mean(α_過去窓)) / std(α_過去窓)",
  fiveDay:
    "5D Pulse: 過去4営業日の確定日次 Alpha ＋ ライブ quote があるとき本日の暫定（`buildFiveDayPulseDailyAlpha`）。【式】ミニチャートは最大5点の系列（末尾−先頭の差は並び替え `trend5dSortValue` で使用）",
  fcfYield:
    "フリーキャッシュ利回り: 株価に対する年 FCF。再投資と配当の余力の土台を銘柄間で比較。【式】FCF Yield% = 年間FCF / 企業価値（または簡易に時価）× 100（Yahoo / FMP 連携）",
  drawdown:
    "90 日高値比: 現在価が直近90本の終値高値からどれだけ下にあるか（`computePriceDrawdownFromHighPercent`）。【式】落ち率% = (現値 − 90日高) / 90日高 × 100",
  peg: "成長性を価格に折り込んだ鋭さ。低いほど「成長の割安」だが前提の質は別途確認。【式】PEG ≈ PER ÷ (予想EPS成長率の小数 × 100)。自前算出不可時は Yahoo `pegRatio`（`resolveStockPegRatio`）",
  divAdjPeg:
    "配当を成長分母に加えた鋭さ。高配当ディフェンシブの重みづけに。【式】DA-PEG = PER / (予想成長% + 配当利回り%)（`computeDividendAdjustedPeg`）",
  trr:
    "トータル・リターン・レシオ: 予想EPS成長と配当利回りを PER で割った「収益フロー対バリュエーション」。高いほど割安な高還元・高成長に近い目安（前提の質は別途）。【式】TRR = (予想成長% + 配当利回り%) ÷ PER（Forward PER 優先・`computeTotalReturnYieldRatio`）",
  volumeRatio:
    "本セッション出来高 ÷ 直近10日平均出来高（Yahoo quote / 日次）。【式】本日出来高 / 10日平均出来高",
  asset:
    "銘柄識別子・地域バッジ・（テーマ時）エコキープ。Asset 行頭の★で `holdings.is_bookmarked` をトグル。ティッカーは `classifyTickerInstrument` に基づき表示用整形。",
  lynch:
    "ピーター・リンチ6分類（保有 Inventory・観測 Ecosystem はルールベース自動分類。DB の expectation_category は本列では参照しません。取引フォーム等では従来どおり手動値を利用）。",
  listing:
    "上場（初回取引）日の年で並べ替え。値は DB / Yahoo first trade の近似で、公式 IPO 日とは限りません。",
  mktCap:
    "時価総額。参照は Yahoo Finance 等の同期時点。手入力スケールがあればそれを優先する行があります。",
  perfListed:
    "長期騰落率（%）: 日足系列の最古〜最新（調整後ペア優先）。取得不能時のみ 現在価÷listing_price の近似。",
  earnings:
    "次回決算予定日までの日数（昇順ソート時は「近い」ほど上）。Yahoo 由来・未取得は末尾扱い。",
  research:
    "配当利回り・配当日・連続配当年・自社株買い（Yahoo）。ソートは決算まで→配当落ち→利回りの優先（実装参照）。",
  netCash:
    "ネットキャッシュ（現地通貨）。FMP 年次 BS: 流動性資産 − totalDebt。`ticker_efficiency_metrics`（`npm run fetch:fmp`）。",
  netCps:
    "1株当たりネットキャッシュ = ネットC ÷ 希薄化株数（FMP quote）。",
  netCashYield:
    "ネットキャッシュ ÷ 時価総額 × 100（%）。BS ベースのネットCを企業価値で割ったウェイト的指標（観測行は `market_cap` 基準）。",
  judgment:
    "投資優先度（ELITE / ACCUMULATE / WATCH / DANGER）。`computeInvestmentJudgment` とナラティブの集約。",
  position:
    "数量・評価額（円ベース推定）・ポートフォリオ内ウエイト%。`marketValue`・`weight`（dashboard-data）。",
  pe: "株価収益率。Trailing EPS 優先、なければ Forward（Yahoo）。",
  pbr: "株価純資産倍率（PBR）。Yahoo `defaultKeyStatistics.priceToBook`。簿価ネガ・投信等では未取得になりやすい。",
  egrowth: "予想 EPS 成長率（年率イメージ）。Yahoo の expectedGrowth を % 表示（内部は小数）。",
  eps: "1株当たり利益。Trailing EPS 優先、なければ Forward（Yahoo）。",
  forwardEps: "予想 EPS（Forward）。Yahoo `defaultKeyStatistics.forwardEps`。未上場・未取得は —。",
  price:
    "現在値（現地通貨・ビュー通貨で換算表示）と平均取得単価・含み損益%。ライブ時は Yahoo quote、確定は日次終値系列（`priceSource`）。",
  cumTrend:
    "累積 Alpha の日内スパーク（`alphaHistory`）。観測起点は `observation_started_at` 優先・系列メタで補正。",
  volRatioEco:
    "ウォッチ行の出来高比（保有表と同定義）: 本日出来高 / 10 日平均。",
  priceLast:
    "最新価（現地通貨）。ライブ quote または日次終値。テーマ表示は通貨切替に追従。",
  dividend:
    "配当イベント近接度でソート（権利落ちまでの日数）。ディフェンシブ・配当重視ビュー向け。",
  payout:
    "配当性向（%）: 年間 DPS ÷ TTM EPS × 100（Yahoo）。算出不可は末尾。",
  holder:
    "ディフェンシブ配当銘柄の保有主体タグ（スライス表示と連動）。",
  defensiveRole:
    "ディフェンシブ銘柄の役割ラベル（ポートフォリオ内の守りの位置づけ）。",
  role: "江戸循環テーマ向けの産業上の役割（`theme_ecosystem_members.role`）。",
  viScore:
    "垂直統合スコア 0–100（地政学・供給鎖の「厚み」目安。スコア算出はテーマ用メタ）。",
} as const;

export type MetricHeaderTipKey = keyof typeof METRIC_HEADER_TIP;
