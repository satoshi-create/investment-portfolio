import React from "react";

import { EdoThemeNarrativeCallout } from "@/src/components/dashboard/EdoThemeNarrativeCallout";
import { EDO_CIRCULAR_THEME_ID, EDO_CIRCULAR_THEME_NAME } from "@/src/lib/edo-theme-constants";
import type { InvestmentThemeRecord } from "@/src/types/investment";

export function ThemeMetaBlock({
  theme,
  themeName,
}: {
  theme: InvestmentThemeRecord | null;
  themeName: string;
}) {
  const isEdo =
    theme?.id === EDO_CIRCULAR_THEME_ID ||
    themeName.trim() === EDO_CIRCULAR_THEME_NAME;

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card/40 p-5 md:p-6">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-1">
          Investment thesis
        </p>
        {theme?.description ? (
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
            {theme.description}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            テーマ「{themeName}」の解説は未登録です。
            <span className="font-mono text-muted-foreground">investment_themes</span>{" "}
            に Notion から移行した{" "}
            <span className="font-mono">description</span>{" "}
            を投入すると表示されます。
          </p>
        )}
      </div>
      {theme?.goal ? (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-1">
            Goal & milestones
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {theme.goal}
          </p>
        </div>
      ) : null}
      {isEdo ? <EdoThemeNarrativeCallout /> : null}
    </div>
  );
}
