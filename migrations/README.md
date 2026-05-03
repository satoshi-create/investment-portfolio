# マイグレーション運用メモ

アプリが参照する **Turso（またはローカル SQLite）と同じデータベース** に対して実行してください。`.env` の接続先と一致していることを確認します。本番相当の DB を変更する前は、Turso のスナップショットまたは DB ファイルのコピーを取得してください。

## 062 / 065（ストーリー正本 `ticker_story_hub`）

| ファイル | 用途 |
|----------|------|
| `062_ticker_story_hub.sql` | `ticker_story_hub` テーブル作成と初期投入。 |
| `065_ticker_story_hub_canonical.sql` | 正本へのマージ（空列を holdings → テーマの順で補完）のあと、`holdings` / `theme_ecosystem_members` の重複ストーリー列を NULL 化。**062 適用後**に実行。ロールバックは手動復元が必要。 |

---

## 042 / 043（銘柄メタ: `listing_date`, `market_cap` など）

| ファイル | 用途 |
|----------|------|
| `042_investment_instrument_meta.sql` | **新規に列を追加**（`listing_date`, `market_cap`, `listing_price`, `next_earnings_date`, `memo`, `is_bookmarked`, `instrument_meta_synced_at`）。`holdings` と `theme_ecosystem_members` の両方。 |
| `043_listing_date_and_meta_sync.sql` | **既存 DB の `founded_date` を `listing_date` にリネーム**し、`instrument_meta_synced_at` を追加。 |

- **043** は、すでに `listing_date` がある DB では `RENAME` が失敗するため **流さない**。
- **042** は、すでに同名列があると `ADD COLUMN` が失敗するため **未適用の列だけが必要な場合**は、下記 PRAGMA の結果に応じて **必要な `ALTER` だけ**を手で実行する方が安全です。

---

## 手順: PRAGMA で確認 → 適切なマイグレーションだけ実行

### 1. シェルで DB に接続

Turso の例（データベース名はダッシュボードまたは CLI で確認）:

```bash
turso db shell <database-name>
```

ローカルファイルの例:

```bash
sqlite3 ./path/to/local.db
```

### 2. 列の有無を確認

```sql
PRAGMA table_info(holdings);
PRAGMA table_info(theme_ecosystem_members);
```

確認ポイント（名前の列）:

- `listing_date`
- `founded_date`（旧名）
- `instrument_meta_synced_at`
- （042 一式を使う場合）`market_cap`, `listing_price`, `next_earnings_date`, `memo`, `is_bookmarked`

SQLite の CLI では、長い出力を絞るとき:

```sql
SELECT name FROM pragma_table_info('holdings')
WHERE name IN (
  'listing_date', 'founded_date', 'instrument_meta_synced_at',
  'market_cap', 'listing_price', 'next_earnings_date', 'memo', 'is_bookmarked'
);
```

`theme_ecosystem_members` も同様に `pragma_table_info('theme_ecosystem_members')` で確認します。

### 3. 分岐（どれを実行するか）

| `holdings` の状態 | 実行するもの |
|-------------------|----------------|
| `listing_date` があり、アプリが要求する列も揃っている | **何もしない**（または欠けている列だけ `ALTER TABLE ... ADD COLUMN`） |
| `founded_date` だけあり、`listing_date` がない | **`043_listing_date_and_meta_sync.sql`**（`theme_ecosystem_members` も同様に `founded_date` がある前提） |
| メタ列がなく、`founded_date` もない | **`042_investment_instrument_meta.sql`** |

**注意:** `holdings` と `theme_ecosystem_members` で列の状態が違う（片方だけ旧スキーマ）場合は、**テーブルごとに** `PRAGMA` したうえで、リネームか `ADD COLUMN` をそれぞれ合わせます。

### 4. SQL ファイルの流し込み（非対話）

プロジェクトルートから、対象 DB にリダイレクト:

```bash
turso db shell <database-name> < migrations/043_listing_date_and_meta_sync.sql
```

または対話シェル内で `.read`（ローカル sqlite3）:

```text
.read migrations/042_investment_instrument_meta.sql
```

### 5. 再確認

もう一度 `PRAGMA table_info(holdings);` 等で `listing_date` が存在することを確認してから、アプリを再起動して `/api/dashboard` などを叩きます。

---

## よくあるエラー

- **`no such column: listing_date`**  
  上記マイグレーションが **この DB に未適用**か、**別の DB URL** を参照しているときに発生します。

- **043 実行時に `no such column: founded_date`**  
  すでに `listing_date` にリネーム済み、または最初から `founded_date` が無かった可能性があります。`PRAGMA` で列名を確認し、**043 は使わず**不足列だけを補います。

- **042 実行時に `duplicate column name`**  
  その列は既に存在します。ファイル全体ではなく、**未追加の列用の `ALTER TABLE ... ADD COLUMN` だけ**を実行します。
