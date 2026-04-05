/**
 * テーマ詳細（累積 Structural Alpha を含むチャート群）は `ThemePageClient` に集約。
 */
import { ThemePageClient } from "@/src/components/dashboard/ThemePageClient";

type PageProps = {
  params: Promise<{ theme: string }>;
};

function decodeThemeParam(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export default async function ThemeRoutePage({ params }: PageProps) {
  const { theme: themeParam } = await params;
  const themeLabel = decodeThemeParam(themeParam);
  return <ThemePageClient themeLabel={themeLabel} />;
}
