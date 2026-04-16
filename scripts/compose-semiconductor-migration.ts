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
const values = lines.join("\n");

const header = `-- 構造投資テーマ: 半導体サプライチェーン（src/lib/semiconducter-data_new.csv 由来・${rows.length}銘柄）
-- Apply: turso db shell <db> < migrations/023_semiconductor_equipment_theme.sql

PRAGMA foreign_keys = ON;

INSERT INTO investment_themes (id, user_id, name, description, goal, created_at)
SELECT
  'theme-seed-semiconductor-equipment',
  'user-satoshi',
  '半導体サプライチェーン',
  '材料・装置・設計（ファブレス）・IDM・後工程まで、半導体バリューチェーン全体を一枚の地図で観測する。CSV の各プレイヤーをエコシステムに載せ、VOO 対 Alpha と決算・地政イベントで分解する。',
  'SOX/NDX とファウンドリ設備投資・メモリ価格を併読し、テーマ加重累積 Alpha と銘柄別 Z・落率で「全体β」と「チェーン内相対」を切り分ける。',
  datetime('now')
WHERE NOT EXISTS (
  SELECT 1 FROM investment_themes t
  WHERE t.id = 'theme-seed-semiconductor-equipment'
);

UPDATE investment_themes
SET
  name = '半導体サプライチェーン',
  description = '材料・装置・設計（ファブレス）・IDM・後工程まで、半導体バリューチェーン全体を一枚の地図で観測する。CSV の各プレイヤーをエコシステムに載せ、VOO 対 Alpha と決算・地政イベントで分解する。',
  goal = 'SOX/NDX とファウンドリ設備投資・メモリ価格を併読し、テーマ加重累積 Alpha と銘柄別 Z・落率で「全体β」と「チェーン内相対」を切り分ける。'
WHERE id = 'theme-seed-semiconductor-equipment';

DELETE FROM theme_ecosystem_members WHERE theme_id = 'theme-seed-semiconductor-equipment';

INSERT OR REPLACE INTO theme_ecosystem_members
  (id, theme_id, ticker, company_name, field, role, is_major_player, observation_started_at, is_unlisted, proxy_ticker, observation_notes)
VALUES
`;

writeFileSync(
  join(process.cwd(), "migrations/023_semiconductor_equipment_theme.sql"),
  `${header}${values};\n`,
  "utf8",
);
console.log(`Wrote migrations/023_semiconductor_equipment_theme.sql (${rows.length} members)`);
