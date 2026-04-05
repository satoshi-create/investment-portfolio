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
