/** `theme_ecosystem_members.field` の最大文字数（API・UI で共通） */
export const ECOSYSTEM_MEMBER_FIELD_MAX_LEN = 200;

export function normalizeEcosystemMemberField(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = String(raw).trim();
  if (t.length === 0) return null;
  return t.slice(0, ECOSYSTEM_MEMBER_FIELD_MAX_LEN);
}
