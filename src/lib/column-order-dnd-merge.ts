import { arrayMove } from "@dnd-kit/sortable";

/**
 * テーブルが「表示列のサブセット」（リンチレンズ等）のとき、dnd-kit の active/over はその順序に従うが、
 * 永続 `columnOrder` は別順序を保持し得る。フル順序に対する indexOf だけでは視覚と不一致になるため、
 * 表示順での arrayMove 結果をフル順へマージする。
 */
export function mergeSubsetReorderIntoFullOrder<T extends string>(
  fullOrder: readonly T[],
  visibleOrdered: readonly T[],
  activeId: T,
  overId: T,
): T[] {
  const oldI = visibleOrdered.indexOf(activeId);
  const newI = visibleOrdered.indexOf(overId);
  if (oldI < 0 || newI < 0) return [...fullOrder];
  const reorderedVisible = arrayMove([...visibleOrdered], oldI, newI);
  const visSet = new Set(reorderedVisible);
  let injected = false;
  const out: T[] = [];
  for (const id of fullOrder) {
    if (!visSet.has(id)) {
      out.push(id);
    } else if (!injected) {
      out.push(...reorderedVisible);
      injected = true;
    }
  }
  if (!injected) out.push(...reorderedVisible);
  return out;
}
