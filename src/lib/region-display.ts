/**
 * Yahoo `assetProfile.country` 由来の国名を、国旗・行背景・バッジ用コードに正規化。
 */
export type RegionDisplay = {
  flag: string;
  rowBg: string;
  shortLabel: string;
  /** バッジ右側の英字コード（US / JP / EU など） */
  regionCode: string;
  /** JudgmentBadge に近いトーンのラップ用クラス */
  badgeWrap: string;
};

const DEFAULT_REGION: RegionDisplay = {
  flag: "",
  rowBg: "",
  shortLabel: "",
  regionCode: "",
  badgeWrap: "",
};

export function regionDisplayFromYahooCountry(country: string | null | undefined): RegionDisplay {
  if (country == null || String(country).trim().length === 0) return DEFAULT_REGION;
  const c = String(country).toLowerCase();

  if (c.includes("japan") || c === "jp")
    return {
      flag: "🇯🇵",
      rowBg: "bg-sky-500/5",
      shortLabel: "日本",
      regionCode: "JP",
      badgeWrap: "border-sky-500/45 bg-sky-500/12 text-sky-100",
    };
  if (c.includes("united state") || c === "usa" || c === "u.s.")
    return {
      flag: "🇺🇸",
      rowBg: "bg-slate-500/5",
      shortLabel: "米国",
      regionCode: "US",
      badgeWrap: "border-slate-500/45 bg-slate-500/12 text-slate-100",
    };
  if (c.includes("united king") || c === "uk" || c === "u.k." || c.includes("britain"))
    return {
      flag: "🇬🇧",
      rowBg: "bg-violet-500/6",
      shortLabel: "英",
      regionCode: "GB",
      badgeWrap: "border-violet-500/45 bg-violet-500/12 text-violet-100",
    };
  if (c === "germany" || c === "de" || c.includes("german"))
    return {
      flag: "🇩🇪",
      rowBg: "bg-amber-500/5",
      shortLabel: "独",
      regionCode: "DE",
      badgeWrap: "border-amber-500/45 bg-amber-500/12 text-amber-100",
    };
  if (c === "france" || c === "fr" || c.includes("french"))
    return {
      flag: "🇫🇷",
      rowBg: "bg-blue-500/5",
      shortLabel: "仏",
      regionCode: "FR",
      badgeWrap: "border-blue-500/45 bg-blue-500/12 text-blue-100",
    };
  if (c === "switzerland" || c === "ch" || c.includes("swiss"))
    return {
      flag: "🇨🇭",
      rowBg: "bg-red-500/5",
      shortLabel: "瑞",
      regionCode: "CH",
      badgeWrap: "border-red-500/45 bg-red-950/35 text-red-100",
    };
  if (c.includes("taiwan"))
    return {
      flag: "🇹🇼",
      rowBg: "bg-emerald-500/5",
      shortLabel: "台",
      regionCode: "TW",
      badgeWrap: "border-emerald-500/45 bg-emerald-500/12 text-emerald-100",
    };
  if (c.includes("hong kong") || c === "hk")
    return {
      flag: "🇭🇰",
      rowBg: "bg-orange-500/5",
      shortLabel: "香港",
      regionCode: "HK",
      badgeWrap: "border-orange-500/45 bg-orange-500/12 text-orange-100",
    };
  if (c.includes("china") || c === "cn")
    return {
      flag: "🇨🇳",
      rowBg: "bg-orange-500/5",
      shortLabel: "中国",
      regionCode: "CN",
      badgeWrap: "border-orange-500/45 bg-orange-500/12 text-orange-100",
    };
  if (c === "in" || c === "india" || c.includes("india"))
    return {
      flag: "🇮🇳",
      rowBg: "bg-amber-400/5",
      shortLabel: "印",
      regionCode: "IN",
      badgeWrap: "border-amber-400/45 bg-amber-400/12 text-amber-100",
    };
  if (c.includes("brazil") || c === "br")
    return {
      flag: "🇧🇷",
      rowBg: "bg-lime-500/5",
      shortLabel: "BR",
      regionCode: "BR",
      badgeWrap: "border-lime-500/45 bg-lime-500/12 text-lime-100",
    };
  if (c === "israel" || c === "il")
    return {
      flag: "🇮🇱",
      rowBg: "bg-cyan-500/5",
      shortLabel: "IL",
      regionCode: "IL",
      badgeWrap: "border-cyan-500/45 bg-cyan-500/12 text-cyan-100",
    };
  if (c === "korea" || c.includes("south korea") || c === "kr" || c.includes("korean"))
    return {
      flag: "🇰🇷",
      rowBg: "bg-fuchsia-500/5",
      shortLabel: "韓",
      regionCode: "KR",
      badgeWrap: "border-fuchsia-500/45 bg-fuchsia-500/12 text-fuchsia-100",
    };
  if (c === "australia" || c === "au" || c.includes("austral"))
    return {
      flag: "🇦🇺",
      rowBg: "bg-lime-400/5",
      shortLabel: "豪",
      regionCode: "AU",
      badgeWrap: "border-lime-400/45 bg-lime-400/12 text-lime-100",
    };
  if (c.includes("europe") || c.includes("eu ") || c === "eu" || c.includes("european union"))
    return {
      flag: "🇪🇺",
      rowBg: "bg-indigo-500/6",
      shortLabel: "欧州",
      regionCode: "EU",
      badgeWrap: "border-indigo-500/45 bg-indigo-500/12 text-indigo-100",
    };
  if (c.includes("emerg") || c === "europe, middle east and africa" || c.includes("middle east"))
    return {
      flag: "🌏",
      rowBg: "bg-teal-500/5",
      shortLabel: "新興/中東",
      regionCode: "EM",
      badgeWrap: "border-teal-500/45 bg-teal-500/12 text-teal-100",
    };
  const raw = String(country).trim();
  const short = raw.length > 16 ? raw.slice(0, 16) + "…" : raw;
  const code =
    raw.length <= 4 && /^[a-zA-Z]{2,4}$/.test(raw) ? raw.toUpperCase() : raw.length === 2 ? raw.toUpperCase() : "INT";
  return {
    flag: "🌐",
    rowBg: "bg-muted/20",
    shortLabel: short,
    regionCode: code,
    badgeWrap: "border-border bg-muted/50 text-muted-foreground",
  };
}
