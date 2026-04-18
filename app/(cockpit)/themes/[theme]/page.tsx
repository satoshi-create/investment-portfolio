/**
 * テーマ詳細（累積 Structural Alpha を含むチャート群）は `ThemePageClient` に集約。
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ThemePageClient } from "@/src/components/dashboard/ThemePageClient";
import {
  buildSemiconductorSupplyChainCatalog,
  SEMICONDUCTOR_SUPPLY_CHAIN_THEME_NAME,
} from "@/src/lib/semiconductor-supply-chain-catalog";

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

  let supplyChainCatalogRows = null;
  if (
    themeLabel === SEMICONDUCTOR_SUPPLY_CHAIN_THEME_NAME ||
    themeLabel === "半導体製造装置"
  ) {
    try {
      const csvPath = join(process.cwd(), "src/lib/semiconducter-data_new.csv");
      const raw = readFileSync(csvPath, "utf8");
      supplyChainCatalogRows = buildSemiconductorSupplyChainCatalog(raw);
    } catch {
      supplyChainCatalogRows = [];
    }
  }

  return (
    <ThemePageClient
      themeLabel={themeLabel}
      supplyChainCatalogRows={supplyChainCatalogRows}
    />
  );
}
