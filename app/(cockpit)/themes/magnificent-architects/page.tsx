import { ThemePageClient } from "@/src/components/dashboard/ThemeStructuralPageClient";
import { MAGNIFICENT_ARCHITECTS_THEME_SLUG } from "@/src/lib/magnificent-architects-theme";

export const dynamic = "force-dynamic";

/** 固定 URL `/themes/magnificent-architects` → DB の Magnificent Architects テーマ */
export default function MagnificentArchitectsThemePage() {
  return <ThemePageClient themeLabel={MAGNIFICENT_ARCHITECTS_THEME_SLUG} />;
}
