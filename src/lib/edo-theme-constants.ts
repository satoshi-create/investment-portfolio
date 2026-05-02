/** 新しいテーマ定義 */
export const EDO_CIRCULAR_THEME_ID = "edo-circular" as const;
export const EDO_CIRCULAR_THEME_NAME = "江戸循環ネットワーク" as const;
/** DB / URL で残る旧ラベル（`049_split_edo_and_mining.sql` 移行前のテーマ名） */
export const EDO_CIRCULAR_THEME_NAME_LEGACY = "江戸循環ネットワーク文明" as const;

/** ナフサ相関パネル等、江戸循環テーマ専用 UI の判定 */
export function isEdoCircularThemeName(themeName: string): boolean {
  const t = themeName.trim();
  return t === EDO_CIRCULAR_THEME_NAME || t === EDO_CIRCULAR_THEME_NAME_LEGACY;
}

export const URBAN_MINING_THEME_ID = "urban-mining-treasure" as const;
export const URBAN_MINING_THEME_NAME = "都市鉱山×お宝銘柄" as const;

/** エコシステム「role」欄のヒント（共通で使用可能） */
export const EDO_ECOSYSTEM_ROLE_PLACEHOLDER =
  "役割を定義（例: 貴金属回収、二次還流プロトコル、通い袋師 など）";
