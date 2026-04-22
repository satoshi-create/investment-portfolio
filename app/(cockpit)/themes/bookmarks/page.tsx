import { EcosystemBookmarksClient } from "@/src/components/dashboard/EcosystemBookmarksClient";
import { defaultProfileUserId } from "@/src/lib/authorize-signals";
import { getEcosystemCrossThemeBookmarks } from "@/src/lib/dashboard-data";
import { getDb, isDbConfigured } from "@/src/lib/db";

export const dynamic = "force-dynamic";

export default async function EcosystemBookmarksPage() {
  if (!isDbConfigured()) {
    return (
      <div className="mx-auto w-full max-w-3xl rounded-2xl border border-border bg-card/60 p-6 text-sm text-muted-foreground">
        データベースが未設定です（<code className="font-mono text-foreground/90">TURSO_DATABASE_URL</code> 等）。
      </div>
    );
  }

  const userId = defaultProfileUserId();
  const initialItems = await getEcosystemCrossThemeBookmarks(getDb(), userId, { fast: false });

  return <EcosystemBookmarksClient initialItems={initialItems} />;
}
