# Story パネル段階 B（テーマウォッチ）

## ギャップ表（StorySidePanel が触るフィールド）

| UI / 保存 | holdings 列 | theme_ecosystem_members（058 適用後） | テーマ PATCH |
|-----------|-------------|----------------------------------------|--------------|
| 銘柄メモ | `memo` | `memo` | はい |
| 決算要約 | `earnings_summary_note` | `earnings_summary_note` | はい |
| リンチ叙述（persist 同梱） | `lynch_drivers_narrative` | `lynch_drivers_narrative`（058 追加） | はい |
| 2 分間の物語 | `lynch_story_text` | `lynch_story_text`（058 追加） | はい |
| Notion キュー | 保有 ID 前提 | **送信しない**（ウォッチのみ） | — |

## 採用方針

**A + リンチ列追加（058）**: `StorySidePanel` に `variant: "holding" | "themeMember"`。保存先のみ分岐。ウォッチでも Inventory と同一タブ構成を維持。

## データ整合（買付後）

テーマメンバー行の `memo` / `earnings_summary_note` / `lynch_*` と、新規 `holdings` 行は **別レコード**。自動マージはしない。買った後は **保有行の Story パネル**が正（段階 A の解決経路）。テーマ側に残したウォッチ用メモは参照用として併存し得る。

## 実装メモ

- `StoryPanelContext`: `openThemeMemberStory` + `storyOpen` 判別、`storyStock` は後方互換で導出。
- `migrations/058_theme_ecosystem_lynch_story.sql` を適用してから本番利用。
