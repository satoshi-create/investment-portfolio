import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { buildSemiconductorSupplyChainCatalog } from "../src/lib/semiconductor-supply-chain-catalog";

function esc(s: string): string {
  return String(s).replace(/'/g, "''");
}

const raw = readFileSync(
  join(process.cwd(), "src/lib/semiconducter-data_new.csv"),
  "utf8",
);
const rows = buildSemiconductorSupplyChainCatalog(raw);
const lines: string[] = [];
for (let i = 0; i < rows.length; i++) {
  const x = rows[i]!;
  const id = `eco-sc-${x.ticker.replace(/[^A-Za-z0-9]/g, "_")}`;
  const un = x.isUnlisted ? 1 : 0;
  const px = x.proxyTicker != null ? `'${esc(x.proxyTicker)}'` : "NULL";
  const note = x.resolutionNote != null ? `'${esc(x.resolutionNote)}'` : "NULL";
  const maj = x.isMajorPlayer ? 1 : 0;
  const sep = i === rows.length - 1 ? "" : ",";
  lines.push(
    `  ('${id}', 'theme-seed-semiconductor-equipment', '${esc(x.ticker)}', '${esc(x.companyNameJa)}', '${esc(x.field)}', '${esc(x.primaryRole)}', ${maj}, '2026-01-01', ${un}, ${px}, ${note})${sep}`,
  );
}
const out = `${lines.join("\n")}\n`;
const dest = process.argv[2];
if (dest) {
  writeFileSync(dest, out, "utf8");
  console.error(`Wrote ${rows.length} rows to ${dest}`);
} else {
  process.stdout.write(out);
}
