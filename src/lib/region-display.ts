/**
 * Yahoo `assetProfile.country` 由来の国名を、国旗・行背景トークンに正規化。
 */
export type RegionDisplay = {
  flag: string;
  rowBg: string;
  shortLabel: string;
};

const DEFAULT_REGION: RegionDisplay = {
  flag: "",
  rowBg: "",
  shortLabel: "",
};

export function regionDisplayFromYahooCountry(country: string | null | undefined): RegionDisplay {
  if (country == null || String(country).trim().length === 0) return DEFAULT_REGION;
  const c = String(country).toLowerCase();

  if (c.includes("japan") || c === "jp")
    return { flag: "🇯🇵", rowBg: "bg-sky-500/5", shortLabel: "日本" };
  if (c.includes("united state") || c === "usa" || c === "u.s.")
    return { flag: "🇺🇸", rowBg: "bg-slate-500/5", shortLabel: "米国" };
  if (c.includes("united king") || c === "uk" || c === "u.k." || c.includes("britain"))
    return { flag: "🇬🇧", rowBg: "bg-violet-500/6", shortLabel: "英" };
  if (c === "germany" || c === "de" || c.includes("german"))
    return { flag: "🇩🇪", rowBg: "bg-amber-500/5", shortLabel: "独" };
  if (c === "france" || c === "fr" || c.includes("french"))
    return { flag: "🇫🇷", rowBg: "bg-blue-500/5", shortLabel: "仏" };
  if (c === "switzerland" || c === "ch" || c.includes("swiss"))
    return { flag: "🇨🇭", rowBg: "bg-red-500/5", shortLabel: "瑞" };
  if (c.includes("taiwan")) return { flag: "🇹🇼", rowBg: "bg-emerald-500/5", shortLabel: "台" };
  if (c.includes("china") || c.includes("hong kong") || c === "cn" || c === "hk")
    return { flag: "🇨🇳", rowBg: "bg-orange-500/5", shortLabel: "中/HK" };
  if (c === "in" || c === "india" || c.includes("india"))
    return { flag: "🇮🇳", rowBg: "bg-amber-400/5", shortLabel: "印" };
  if (c.includes("brazil") || c === "br")
    return { flag: "🇧🇷", rowBg: "bg-lime-500/5", shortLabel: "BR" };
  if (c === "israel" || c === "il")
    return { flag: "🇮🇱", rowBg: "bg-cyan-500/5", shortLabel: "IL" };
  if (c === "korea" || c.includes("south korea") || c === "kr" || c.includes("korean"))
    return { flag: "🇰🇷", rowBg: "bg-fuchsia-500/5", shortLabel: "韓" };
  if (c === "australia" || c === "au" || c.includes("austral"))
    return { flag: "🇦🇺", rowBg: "bg-lime-400/5", shortLabel: "豪" };
  if (c.includes("europe") || c.includes("eu ") || c === "eu" || c.includes("european union"))
    return { flag: "🇪🇺", rowBg: "bg-indigo-500/6", shortLabel: "欧州" };
  if (c.includes("emerg") || c === "europe, middle east and africa" || c.includes("middle east"))
    return { flag: "🌏", rowBg: "bg-teal-500/5", shortLabel: "新興/中東" };
  return { flag: "🌐", rowBg: "bg-muted/20", shortLabel: country.length > 16 ? country.slice(0, 16) + "…" : country };
}
