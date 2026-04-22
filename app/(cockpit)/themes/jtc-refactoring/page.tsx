import { ThemePageClient } from "@/src/components/dashboard/ThemeStructuralPageClient";

export const dynamic = "force-dynamic";

/** 固定URL: DB の `investment_themes.name`（JTCリファクタリング）へ `mapThemeLabelForQuery` で解決 */
export default async function JtcRefactoringThemePage() {
  return <ThemePageClient themeLabel="jtc-refactoring" />;
}
