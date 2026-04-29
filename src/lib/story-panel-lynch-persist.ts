/**
 * ストーリーパネル: チェック・診断選択を `holdings.lynch_drivers_narrative` 先頭の 1 行 JSON に埋め込み、
 * 本文とまとめて永続化する（専用列を増やさず API 互換を維持）。
 */
export const STORY_PANEL_LYNCH_META_PREFIX = "__STORY_PANEL_META_JSON__:";

export type StoryPanelLynchPersistMetaV1 = {
  v: 1;
  drivers: string[];
  growthQuality: string;
  universalPatches: string[];
};

function emptyMeta(): StoryPanelLynchPersistMetaV1 {
  return { v: 1, drivers: [], growthQuality: "", universalPatches: [] };
}

/** DB に書き込む `lynch_drivers_narrative` 全文（メタ行 + 本文） */
export function encodeStoryPanelLynchPersist(
  meta: Omit<StoryPanelLynchPersistMetaV1, "v">,
  narrativeBody: string,
): string {
  const payload: StoryPanelLynchPersistMetaV1 = {
    v: 1,
    drivers: [...(meta.drivers ?? [])],
    growthQuality: meta.growthQuality ?? "",
    universalPatches: [...(meta.universalPatches ?? [])],
  };
  const line = STORY_PANEL_LYNCH_META_PREFIX + JSON.stringify(payload);
  const body = narrativeBody ?? "";
  if (body.trim().length === 0) return line;
  return `${line}\n${body}`;
}

/** メタとユーザーが編集する本文に分離 */
export function decodeStoryPanelLynchPersist(raw: string | null | undefined): {
  meta: StoryPanelLynchPersistMetaV1;
  narrative: string;
} {
  if (raw == null || String(raw).trim().length === 0) {
    return { meta: emptyMeta(), narrative: "" };
  }
  const text = String(raw);
  const trimmedStart = text.trimStart();
  if (!trimmedStart.startsWith(STORY_PANEL_LYNCH_META_PREFIX)) {
    return { meta: emptyMeta(), narrative: text };
  }
  const afterPrefix = trimmedStart.slice(STORY_PANEL_LYNCH_META_PREFIX.length);
  const nl = afterPrefix.indexOf("\n");
  const jsonLine = nl === -1 ? afterPrefix : afterPrefix.slice(0, nl);
  const narrative = nl === -1 ? "" : afterPrefix.slice(nl + 1);
  try {
    const parsed = JSON.parse(jsonLine) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return { meta: emptyMeta(), narrative: text };
    }
    const o = parsed as Record<string, unknown>;
    if (o.v !== 1) {
      return { meta: emptyMeta(), narrative: text };
    }
    const drivers = Array.isArray(o.drivers)
      ? o.drivers.filter((x): x is string => typeof x === "string")
      : [];
    const growthQuality = typeof o.growthQuality === "string" ? o.growthQuality : "";
    const universalPatches = Array.isArray(o.universalPatches)
      ? o.universalPatches.filter((x): x is string => typeof x === "string")
      : [];
    return {
      meta: { v: 1, drivers, growthQuality, universalPatches },
      narrative,
    };
  } catch {
    return { meta: emptyMeta(), narrative: text };
  }
}
