import { ThemePageClient } from "@/src/components/dashboard/ThemeStructuralPageClient";
import { OKEYA_FLOW_THEME_SLUG } from "@/src/lib/okeya-flow-theme";

export const dynamic = "force-dynamic";

/** 固定 URL `/themes/okeya-flow` → DB の「風が吹けば桶屋が儲かる（テンバーガー候補研究）」テーマ */
export default function OkeyaFlowThemePage() {
  return <ThemePageClient themeLabel={OKEYA_FLOW_THEME_SLUG} />;
}
