/** 表セル用の短い抜粋（Markdown 可・改行は空白化） */
export function snippetFromPlainNote(text: string | null | undefined, maxChars: number): string | null {
  if (text == null) return null;
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length === 0) return null;
  return t.length > maxChars ? `${t.slice(0, maxChars)}…` : t;
}

/** 決算要約（Markdown）を一覧用に軽くプレーン化してから切り詰める */
export function snippetFromEarningsMarkdown(text: string | null | undefined, maxChars: number): string | null {
  if (text == null) return null;
  let s = text.replace(/```[\s\S]*?```/g, " ");
  s = s.replace(/`([^`]*)`/g, "$1");
  s = s.replace(/!\[[^\]]*]\([^)]*\)/g, " ");
  s = s.replace(/\[([^\]]*)]\([^)]*\)/g, "$1");
  s = s.replace(/^[#>\s\-*+]+/gm, " ");
  s = s.replace(/[#*_|`]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  if (s.length === 0) return null;
  return s.length > maxChars ? `${s.slice(0, maxChars)}…` : s;
}
