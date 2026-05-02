import type { ThemeEcosystemWatchItem } from "@/src/types/investment";

/** エコウォッチリスト検索: ティッカー・会社名・分野タグ・メモ類を対象にする */
export function ecosystemWatchlistItemMatchesQuery(e: ThemeEcosystemWatchItem, raw: string): boolean {
  const n = raw.trim().toLowerCase();
  if (n.length === 0) return true;
  const hay = [
    e.companyName,
    e.ticker,
    e.field,
    e.role,
    e.observationNotes ?? "",
    e.chasm ?? "",
    e.moat ?? "",
    e.memo ?? "",
    e.adoptionStageRationale ?? "",
  ];
  return hay.some((s) => String(s).toLowerCase().includes(n));
}
