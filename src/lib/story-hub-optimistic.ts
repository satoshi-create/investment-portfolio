import type { LynchCategory } from "@/src/types/investment";

/** Story サイドパネル保存後の楽観的 UI 更新用（保有・テーマメンバー共通フィールド） */
export type StoryHubPersistFields = {
  memo: string | null;
  earningsSummaryNote: string | null;
  lynchDriversNarrative: string | null;
  lynchStoryText: string | null;
  /** フィールドがあればクライアント状態を更新（`undefined` はマージしない） */
  expectationCategory?: LynchCategory | null;
};
