This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Portfolio snapshot（ログの自動記録）

`portfolio_daily_snapshots` などへの日次書き込みは **`GET/POST /api/backfill`** が行います。Vercel では `vercel.json` の Cron が **米国株式の取引日（月〜金）UTC 21:30** にこのパスを叩きます（NY 16:00 ET 終了の直後を想定したバッファ）。

### Vercel で必要な環境変数

1. **`CRON_SECRET`**（必須・Cron 用）  
   Vercel がスケジュール実行時に `Authorization: Bearer <CRON_SECRET>` を付与します。`/api/signals/generate` と **`/api/backfill` の両方**でこのトークンを受け入れます。
2. **`TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN`**（既存どおり）
3. 手動で `curl` や GitHub Actions から `/api/backfill` を叩く場合は、次のいずれかを **Bearer と一致**させてください。  
   - **`BACKFILL_API_KEY`** または **`CRON_SNAPSHOT_SECRET`**（専用キー）  
   - または上記と同じ値に **`CRON_SECRET`** を使う（運用を一本化できる）

デプロイ後、Vercel の **Cron Jobs** に `/api/backfill`（`30 21 * * 1-5`）が出ていることを確認してください。週末は米国 RTH がないため Cron は動きません（月曜の実行で週末分の「翌営業日」記録が必要なら、別途スケジュールを検討してください）。

### ローカル・手動テスト

```bash
curl -sS -X POST "http://localhost:3000/api/backfill" \
  -H "Authorization: Bearer YOUR_CRON_SECRET_OR_BACKFILL_KEY" \
  -H "Accept: application/json"
```

本番でシークレットを一切設定していない場合、開発時のみ認証なしで通ります（`NODE_ENV !== "production"`）。
