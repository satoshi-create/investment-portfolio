"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { STORY_PANEL_INSET_VAR } from "@/src/lib/story-panel-inset";
import type { StoryHubPersistFields } from "@/src/lib/story-hub-optimistic";
import type { Stock, ThemeEcosystemWatchItem } from "@/src/types/investment";

type ThemeMemberStoryOptimisticHandler = (
  themeId: string,
  memberId: string,
  fields: StoryHubPersistFields,
) => void;

/** 右パネルに表示する対象（保有行 or テーマウォッチ行） */
export type StoryPanelOpen =
  | { variant: "holding"; stock: Stock }
  | {
      variant: "themeMember";
      themeId: string;
      member: ThemeEcosystemWatchItem;
      themeSlugForRevalidate: string | null;
    };

type StoryPanelContextValue = {
  /** 後方互換: 保有モードのときのみ Stock、それ以外は null */
  storyStock: Stock | null;
  storyOpen: StoryPanelOpen | null;
  panelWidth: number;
  setPanelWidth: (w: number) => void;
  openStory: (stock: Stock, onAfterSave?: () => void | Promise<void>) => void;
  openThemeMemberStory: (
    input: {
      themeId: string;
      member: ThemeEcosystemWatchItem;
      themeSlugForRevalidate: string | null;
    },
    onAfterSave?: () => void | Promise<void>,
  ) => void;
  closeStory: () => void;
  /** `StorySidePanel` 保存成功時 — `onAfterSave` を実行 */
  runAfterSave: () => Promise<void>;
  /** テーマページ等が登録: テーマメンバー行の Story フィールドを楽観的に更新 */
  registerThemeMemberStoryOptimistic: (handler: ThemeMemberStoryOptimisticHandler | null) => void;
  applyThemeMemberStoryOptimistic: (themeId: string, memberId: string, fields: StoryHubPersistFields) => void;
};

const StoryPanelContext = createContext<StoryPanelContextValue | null>(null);

export function StoryPanelProvider({ children }: { children: React.ReactNode }) {
  const [storyOpen, setStoryOpen] = useState<StoryPanelOpen | null>(null);
  const [panelWidth, setPanelWidth] = useState(400);
  const afterSaveRef = useRef<(() => void | Promise<void>) | undefined>(undefined);
  const themeMemberStoryOptimisticRef = useRef<ThemeMemberStoryOptimisticHandler | null>(null);

  const runAfterSave = useCallback(async () => {
    await afterSaveRef.current?.();
  }, []);

  const registerThemeMemberStoryOptimistic = useCallback((handler: ThemeMemberStoryOptimisticHandler | null) => {
    themeMemberStoryOptimisticRef.current = handler;
  }, []);

  const applyThemeMemberStoryOptimistic = useCallback(
    (tid: string, memberId: string, fields: StoryHubPersistFields) => {
      themeMemberStoryOptimisticRef.current?.(tid, memberId, fields);
    },
    [],
  );

  useEffect(() => {
    const inset = storyOpen != null ? `${panelWidth}px` : "0px";
    document.documentElement.style.setProperty(STORY_PANEL_INSET_VAR, inset);
    if (storyOpen != null) {
      document.documentElement.setAttribute("data-story-panel-open", "");
    } else {
      document.documentElement.removeAttribute("data-story-panel-open");
    }
    return () => {
      document.documentElement.style.removeProperty(STORY_PANEL_INSET_VAR);
      document.documentElement.removeAttribute("data-story-panel-open");
    };
  }, [storyOpen, panelWidth]);

  const openStory = useCallback((stock: Stock, onAfterSave?: () => void | Promise<void>) => {
    afterSaveRef.current = onAfterSave;
    setStoryOpen({ variant: "holding", stock });
  }, []);

  const openThemeMemberStory = useCallback(
    (
      input: {
        themeId: string;
        member: ThemeEcosystemWatchItem;
        themeSlugForRevalidate: string | null;
      },
      onAfterSave?: () => void | Promise<void>,
    ) => {
      afterSaveRef.current = onAfterSave;
      setStoryOpen({
        variant: "themeMember",
        themeId: input.themeId,
        member: input.member,
        themeSlugForRevalidate: input.themeSlugForRevalidate,
      });
    },
    [],
  );

  const closeStory = useCallback(() => {
    setStoryOpen(null);
    afterSaveRef.current = undefined;
  }, []);

  const storyStock = storyOpen?.variant === "holding" ? storyOpen.stock : null;

  const value = useMemo(
    () => ({
      storyStock,
      storyOpen,
      panelWidth,
      setPanelWidth,
      openStory,
      openThemeMemberStory,
      closeStory,
      runAfterSave,
      registerThemeMemberStoryOptimistic,
      applyThemeMemberStoryOptimistic,
    }),
    [
      storyStock,
      storyOpen,
      panelWidth,
      openStory,
      openThemeMemberStory,
      closeStory,
      runAfterSave,
      registerThemeMemberStoryOptimistic,
      applyThemeMemberStoryOptimistic,
    ],
  );

  return <StoryPanelContext.Provider value={value}>{children}</StoryPanelContext.Provider>;
}

export function useStoryPanel(): StoryPanelContextValue {
  const ctx = useContext(StoryPanelContext);
  if (!ctx) {
    throw new Error("useStoryPanel must be used within StoryPanelProvider");
  }
  return ctx;
}

/** Provider 外では null（テスト・ストーリー用） */
export function useStoryPanelOptional(): StoryPanelContextValue | null {
  return useContext(StoryPanelContext);
}
