/**
 * 観測 Ecosystem 表の「リンチレンズ」: Inventory のプリセットから、
 * 本テーブルに存在する列 ID のみを残す（bookmark / position / netCash 等は観測表に無い）。
 */
import type { EcosystemWatchlistColId } from "@/src/lib/ecosystem-watchlist-column-order";
import { ECOSYSTEM_WATCHLIST_COLUMN_IDS } from "@/src/lib/ecosystem-watchlist-column-order";
import {
  INVENTORY_LYNCH_LENS_COLUMNS,
  type InventoryLynchLensKey,
} from "@/src/lib/inventory-lynch-lens-columns";
import type { InventoryColId } from "@/src/lib/inventory-column-order";

const ECO_COL_SET = new Set<string>(ECOSYSTEM_WATCHLIST_COLUMN_IDS);

function filterToEco(cols: readonly InventoryColId[]): EcosystemWatchlistColId[] {
  const out: EcosystemWatchlistColId[] = [];
  for (const id of cols) {
    if (ECO_COL_SET.has(id)) out.push(id as EcosystemWatchlistColId);
  }
  return out;
}

export const ECOSYSTEM_LYNCH_LENS_COLUMNS: Record<
  InventoryLynchLensKey,
  readonly EcosystemWatchlistColId[]
> = (Object.fromEntries(
  (Object.keys(INVENTORY_LYNCH_LENS_COLUMNS) as InventoryLynchLensKey[]).map((k) => [
    k,
    filterToEco(INVENTORY_LYNCH_LENS_COLUMNS[k]),
  ]),
) as unknown as Record<InventoryLynchLensKey, readonly EcosystemWatchlistColId[]>);

export { inventoryLynchLensKeyFromFilter as ecosystemLynchLensKeyFromFilter } from "@/src/lib/inventory-lynch-lens-columns";
export type { InventoryLynchLensKey as EcosystemLynchLensKey } from "@/src/lib/inventory-lynch-lens-columns";
