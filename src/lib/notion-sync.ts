import type { LynchCategory } from "@/src/types/investment";

/** 将来 `notion-sync` 実装へ渡すスナップショット（DB には保存しない） */
export type StoryNotionPayload = {
  source: "inventory_story_modal";
  holdingId: string;
  ticker: string;
  companyName: string | null;
  /** `getLynchCategory` の自動算出結果（未分類は null） */
  lynchCategory: LynchCategory | null;
  /** モーダルで実際に使ったテンプレのキー（未分類時はユーザー選択のレンズ） */
  selectedLensCategory: LynchCategory;
  selectedDrivers: string[];
  /** 主な収益向上要因の自由記述 */
  driversNarrative: string;
  storyText: string;
  memoPlain: string | null;
  earningsSummaryNoteMarkdown: string | null;
  queuedAtIso: string;
  /** 案 A: `getLynchCategory === null` で診断モードを開いたとき true */
  diagnosticMode: boolean;
  /** 鑑定ラジオの値（診断モード以外は ""） */
  growthQualityAnswer: string;
  /** 汎用 5 パッチ ID（将来 monitoring_log の起点として利用） */
  universalPatches: string[];
};

/**
 * Notion 連携のプレースホルダ。本番 API 呼び出しは別タスク。
 * `InventoryTable` の行は `holdings.id` ベース（テーマ詳細の `stocks` も同一）。
 */
export function queueStoryForNotionSync(payload: StoryNotionPayload): void {
  if (process.env.NODE_ENV !== "production") {
    console.debug("[notion-sync stub] queueStoryForNotionSync", payload);
  }
}
