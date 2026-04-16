/**
 * 半導体製造装置ウォッチリスト（`src/lib/semiconducter-data.csv` 由来）。
 * CSV 後段のティッカー列は一部誤結合のため、公開ティッカーに正規化している。
 */
export const SEMICONDUCTOR_EQUIPMENT_THEME_NAME = "半導体製造装置" as const;

export type SemiconductorEquipmentCatalogRow = {
  companyNameJa: string;
  country: "JP" | "US" | string;
  field: string;
  primaryRole: string;
  /** Yahoo / アプリ内で解決するティッカー */
  ticker: string;
  isMajorPlayer: boolean;
  /** CSV からの補足（任意） */
  dataNote?: string;
};

/** 装置・検査・露光・後工程の主要ツール類（材料・ファブレスは除外） */
export const SEMICONDUCTOR_EQUIPMENT_CATALOG: readonly SemiconductorEquipmentCatalogRow[] =
  [
    {
      companyNameJa: "Applied Materials",
      country: "US",
      field: "前工程",
      primaryRole: "成膜・エッチング装置",
      ticker: "AMAT",
      isMajorPlayer: true,
    },
    {
      companyNameJa: "Lam Research",
      country: "US",
      field: "前工程",
      primaryRole: "エッチング装置",
      ticker: "LRCX",
      isMajorPlayer: true,
    },
    {
      companyNameJa: "KLA",
      country: "US",
      field: "前工程",
      primaryRole: "検査・計測装置",
      ticker: "KLAC",
      isMajorPlayer: true,
    },
    {
      companyNameJa: "Cohu",
      country: "US",
      field: "後工程寄り",
      primaryRole: "テストハンドラー・検査装置",
      ticker: "COHU",
      isMajorPlayer: false,
    },
    {
      companyNameJa: "Kulicke & Soffa",
      country: "US",
      field: "後工程",
      primaryRole: "ワイヤーボンダー",
      ticker: "KLIC",
      isMajorPlayer: false,
    },
    {
      companyNameJa: "DISCO",
      country: "JP",
      field: "後工程",
      primaryRole: "ダイシング・研磨装置",
      ticker: "6146",
      isMajorPlayer: true,
    },
    {
      companyNameJa: "KOKUSAI ELECTRIC",
      country: "JP",
      field: "前工程",
      primaryRole: "成膜装置（CVD/ALD）",
      ticker: "6525",
      isMajorPlayer: false,
    },
    {
      companyNameJa: "SCREEN HD",
      country: "JP",
      field: "前工程",
      primaryRole: "洗浄装置",
      ticker: "7735",
      isMajorPlayer: true,
    },
    {
      companyNameJa: "アドバンテスト",
      country: "JP",
      field: "前工程",
      primaryRole: "半導体テスター",
      ticker: "6857",
      isMajorPlayer: true,
    },
    {
      companyNameJa: "アルバック",
      country: "JP",
      field: "前工程",
      primaryRole: "真空・成膜装置",
      ticker: "6728",
      isMajorPlayer: false,
    },
    {
      companyNameJa: "キヤノン",
      country: "JP",
      field: "前工程（露光）",
      primaryRole: "半導体露光装置・NIL・検査装置",
      ticker: "7751",
      isMajorPlayer: false,
    },
    {
      companyNameJa: "フェローテック",
      country: "JP",
      field: "前工程",
      primaryRole: "装置部材・真空関連部品",
      ticker: "6890",
      isMajorPlayer: false,
    },
    {
      companyNameJa: "荏原（EBARA）",
      country: "JP",
      field: "前工程",
      primaryRole: "真空ポンプ・CMP装置",
      ticker: "6361",
      isMajorPlayer: false,
      dataNote: "CSV のティッカー誤結合を修正",
    },
    {
      companyNameJa: "東京エレクトロン（TEL）",
      country: "JP",
      field: "前工程",
      primaryRole: "成膜・エッチング装置",
      ticker: "8035",
      isMajorPlayer: true,
      dataNote: "CSV のティッカー誤結合を修正",
    },
    {
      companyNameJa: "東京精密（Accretech）",
      country: "JP",
      field: "後工程寄り",
      primaryRole: "計測装置・ダイサー",
      ticker: "7729",
      isMajorPlayer: false,
      dataNote: "CSV のティッカー誤結合を修正",
    },
    {
      companyNameJa: "レーザーテック",
      country: "JP",
      field: "前工程",
      primaryRole: "EUVマスク検査装置",
      ticker: "6920",
      isMajorPlayer: false,
      dataNote: "CSV のティッカー誤結合を修正",
    },
  ] as const;

export function equipmentFieldSummary(
  rows: readonly SemiconductorEquipmentCatalogRow[],
): { field: string; count: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const f = r.field.trim() || "その他";
    m.set(f, (m.get(f) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([field, count]) => ({ field, count }))
    .sort((a, b) => b.count - a.count || a.field.localeCompare(b.field, "ja"));
}
