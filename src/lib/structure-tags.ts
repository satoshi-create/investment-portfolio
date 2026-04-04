/** Parse holdings.structure_tags JSON array; first tag for display, or fallback. */
export function primaryStructureTag(structureTagsJson: string, fallback = "—"): string {
  try {
    const parsed: unknown = JSON.parse(structureTagsJson);
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "string") {
      return parsed[0];
    }
  } catch {
    /* ignore */
  }
  return fallback;
}
