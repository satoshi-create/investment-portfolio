# Story サイドパネル保存パイプライン

## 保有（holding）

- **クライアント**: `StorySidePanel` が `PATCH /api/holdings/story-hub` に **1 回**で `memo` / `earningsSummaryNote` / `lynchDriversNarrative` / `lynchStoryText` を送る（差分がない場合は DB 更新をスキップし、Notion キュー・`onAfterSave` は従来どおり）。
- **サーバー**: `updateHoldingStoryHub` が `holdings` を **1 文の UPDATE** で更新し、`invalidateDashboardCacheForUser` のみ実行（`revalidatePath` は行わない）。
- **互換**: `PATCH /api/holdings/earnings-summary-note` と `PATCH /api/holdings/lynch-story` は他呼び出し向けに残置。`patchHoldingMemo` も他用途で利用可。

## テーマウォッチ（themeMember）

- **クライアント**: `PATCH /api/theme-ecosystem/member` に 1 回（変更がない場合は早期クローズ）。
- **サーバー**: 既存のメンバー更新ロジック。

## タイムアウト

- 上記 PATCH は `fetchWithTimeout` で **25s**（`src/lib/fetch-utils`）。

## 保存後の UI 更新（楽観的更新）

- 保存成功直後、`patchStockStoryHubFields`（ダッシュ）または `applyThemeMemberStoryOptimistic`（テーマ行）で **メモ・決算・リンチ文をクライアント状態に即反映**する（`StoryHubPersistFields` / `src/lib/story-hub-optimistic.ts`）。
- 続けて `void onAfterSave?.()` で **`loadDashboard` / `refetchThemeDetailQuiet` をバックグラウンド実行**（パネルはすぐ閉じる。再取得完了を待たない）。
- テーマページ・構造テーマ・ブックマークはマウント時に `registerThemeMemberStoryOptimistic` で行更新ハンドラを登録する。
