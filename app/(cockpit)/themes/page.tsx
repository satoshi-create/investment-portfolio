"use client";

import { ThemesNavigationSection } from "@/src/components/dashboard/ThemesNavigationSection";
import { useDashboardData } from "@/src/components/dashboard/DashboardDataContext";

export default function CockpitThemesHubPage() {
  const { data, portfolioThemeSet, structuralSparklineByThemeId } = useDashboardData();
  const allThemes = data?.allThemes ?? [];

  return (
    <div className="mx-auto w-full max-w-6xl lg:max-w-7xl 2xl:max-w-[104rem]">
      <ThemesNavigationSection
        themes={allThemes}
        inPortfolioThemeNames={portfolioThemeSet}
        structuralSparklineByThemeId={structuralSparklineByThemeId}
      />
    </div>
  );
}
