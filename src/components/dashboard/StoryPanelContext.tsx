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
import type { Stock } from "@/src/types/investment";

type StoryPanelContextValue = {
  storyStock: Stock | null;
  panelWidth: number;
  setPanelWidth: (w: number) => void;
  openStory: (stock: Stock, onAfterSave?: () => void | Promise<void>) => void;
  closeStory: () => void;
  /** `StorySidePanel` 保存成功時 — `onEarningsNoteSaved` を実行 */
  runAfterSave: () => Promise<void>;
};

const StoryPanelContext = createContext<StoryPanelContextValue | null>(null);

export function StoryPanelProvider({ children }: { children: React.ReactNode }) {
  const [storyStock, setStoryStock] = useState<Stock | null>(null);
  const [panelWidth, setPanelWidth] = useState(400);
  const afterSaveRef = useRef<(() => void | Promise<void>) | undefined>(undefined);

  const runAfterSave = useCallback(async () => {
    await afterSaveRef.current?.();
  }, []);

  useEffect(() => {
    const inset = storyStock != null ? `${panelWidth}px` : "0px";
    document.documentElement.style.setProperty(STORY_PANEL_INSET_VAR, inset);
    if (storyStock != null) {
      document.documentElement.setAttribute("data-story-panel-open", "");
    } else {
      document.documentElement.removeAttribute("data-story-panel-open");
    }
    return () => {
      document.documentElement.style.removeProperty(STORY_PANEL_INSET_VAR);
      document.documentElement.removeAttribute("data-story-panel-open");
    };
  }, [storyStock, panelWidth]);

  const openStory = useCallback((stock: Stock, onAfterSave?: () => void | Promise<void>) => {
    afterSaveRef.current = onAfterSave;
    setStoryStock(stock);
  }, []);

  const closeStory = useCallback(() => {
    setStoryStock(null);
    afterSaveRef.current = undefined;
  }, []);

  const value = useMemo(
    () => ({
      storyStock,
      panelWidth,
      setPanelWidth,
      openStory,
      closeStory,
      runAfterSave,
    }),
    [storyStock, panelWidth, openStory, closeStory, runAfterSave],
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
