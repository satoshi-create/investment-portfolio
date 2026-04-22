/**
 * 構造投資「JTCリファクタリング」: `investment_themes.name` / テーマ詳細 API の `theme` クエリと一致。
 * URL スラッグ `.../themes/jtc-refactoring` は `mapThemeLabelForQuery` で解決。
 */
export const JTC_REFACTORING_THEME_QUERY_NAME = "JTCリファクタリング";
export const JTC_REFACTORING_THEME_SLUG = "jtc-refactoring";

/** `theme_ecosystem_members.observation_notes` の1行1キー。 */
export const JTC_OBS_KEY_PHASE = "refactor_phase";
export const JTC_OBS_KEY_BOTTLENECK = "bottleneck_virtual";
export const JTC_OBS_KEY_TECH_DEBT = "tech_debt_score";
export const JTC_OBS_KEY_ACTIVIST = "activist";
export const JTC_OBS_KEY_STRUCTURAL = "structural";

export type JtcRefactoringPhase = "Legacy" | "Patched" | "Compiling" | "Deployed";

const PHASE_ORDER: JtcRefactoringPhase[] = [
  "Legacy",
  "Patched",
  "Compiling",
  "Deployed",
];

const PHASE_LABEL_JA: Record<JtcRefactoringPhase, string> = {
  Legacy: "レガシー",
  Patched: "パッチ当て",
  Compiling: "ビルド中",
  Deployed: "本番",
};

const PHASES = new Set<string>(PHASE_ORDER);

function parsePhase(s: string): JtcRefactoringPhase | null {
  const t = s.trim();
  if (PHASES.has(t)) return t as JtcRefactoringPhase;
  return null;
}

function parseInt0to100(s: string): number | null {
  const n = parseInt(s.trim(), 10);
  if (!Number.isFinite(n)) return null;
  return Math.min(100, Math.max(0, n));
}

/**
 * テーマ用 `observation_notes`（複数行 `key: value`）をパース。
 */
export function parseJtcRefactoringNotes(raw: string | null | undefined): {
  phase: JtcRefactoringPhase;
  bottleneckVirtual: number | null;
  techDebtScore: number | null;
  activistLine: string | null;
  structuralLine: string | null;
} {
  const out = {
    phase: "Legacy" as JtcRefactoringPhase,
    bottleneckVirtual: null as number | null,
    techDebtScore: null as number | null,
    activistLine: null as string | null,
    structuralLine: null as string | null,
  };
  if (raw == null || String(raw).trim().length === 0) return out;
  for (const line of String(raw).split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim();
    if (k === JTC_OBS_KEY_PHASE) {
      const p = parsePhase(v);
      if (p) out.phase = p;
    } else if (k === JTC_OBS_KEY_BOTTLENECK) {
      out.bottleneckVirtual = parseInt0to100(v);
    } else if (k === JTC_OBS_KEY_TECH_DEBT) {
      out.techDebtScore = parseInt0to100(v);
    } else if (k === JTC_OBS_KEY_ACTIVIST) {
      out.activistLine = v.length > 0 ? v : null;
    } else if (k === JTC_OBS_KEY_STRUCTURAL) {
      out.structuralLine = v.length > 0 ? v : null;
    }
  }
  return out;
}

export function jtcRefactoringPhaseLabelJa(phase: JtcRefactoringPhase): string {
  return PHASE_LABEL_JA[phase];
}

export function jtcRefactoringPhaseIndex(phase: JtcRefactoringPhase): number {
  return PHASE_ORDER.indexOf(phase);
}

export { PHASE_ORDER as JTC_REFACTORING_PHASE_ORDER };
