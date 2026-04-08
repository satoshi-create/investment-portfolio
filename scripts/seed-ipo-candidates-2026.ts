/**
 * Seed 2026 IPO candidates into `theme_ecosystem_members` using proxy tickers.
 * Run: npx tsx scripts/seed-ipo-candidates-2026.ts
 */
import { config } from "dotenv";
import { randomUUID } from "crypto";

import { getDb, isDbConfigured } from "../src/lib/db";

config({ path: ".env.local" });
config();

const DEFAULT_USER_ID =
  typeof process.env.NEXT_PUBLIC_DEFAULT_PROFILE_USER_ID === "string" &&
  process.env.NEXT_PUBLIC_DEFAULT_PROFILE_USER_ID.length > 0
    ? process.env.NEXT_PUBLIC_DEFAULT_PROFILE_USER_ID
    : "user-satoshi";

type SeedRow = {
  companyName: string;
  ticker: string;
  proxyTicker: string;
  notes: string;
  estimatedIpoDate: string;
  estimatedValuation: string;
  field: string;
  role: string;
  isMajorPlayer: boolean;
};

const CANDIDATES: SeedRow[] = [
  {
    companyName: "Anthropic",
    ticker: "N/A:ANTHROPIC",
    proxyTicker: "MSFT",
    notes: "Google・Amazon出資。安全性重視。",
    estimatedIpoDate: "2026-Q4",
    estimatedValuation: "—",
    field: "Foundation Models",
    role: "Safety-first frontier model lab",
    isMajorPlayer: true,
  },
  {
    companyName: "OpenAI",
    ticker: "N/A:OPENAI",
    proxyTicker: "MSFT",
    notes: "絶対的王者。MSとの関係性を注視。",
    estimatedIpoDate: "2026-Q4",
    estimatedValuation: "—",
    field: "Foundation Models",
    role: "Frontier model + platform",
    isMajorPlayer: true,
  },
  {
    companyName: "xAI",
    ticker: "N/A:XAI",
    proxyTicker: "TSLA",
    notes: "イーロン・マスク氏率いる。Grok開発。",
    estimatedIpoDate: "2026-Q4",
    estimatedValuation: "—",
    field: "Foundation Models",
    role: "Consumer-facing frontier model",
    isMajorPlayer: true,
  },
  {
    companyName: "Databricks",
    ticker: "N/A:DATABRICKS",
    proxyTicker: "SNOW",
    notes: "データレイクハウスの旗手。",
    estimatedIpoDate: "2026-Q4",
    estimatedValuation: "—",
    field: "Data Platforms",
    role: "Lakehouse + AI data plane",
    isMajorPlayer: true,
  },
  {
    companyName: "Cerebras Systems",
    ticker: "N/A:CEREBRAS",
    proxyTicker: "NVDA",
    notes: "AI特化型チップ。NVIDIAの対抗馬。",
    estimatedIpoDate: "2026-Q4",
    estimatedValuation: "—",
    field: "AI Chips",
    role: "Wafer-scale accelerator",
    isMajorPlayer: false,
  },
  {
    companyName: "CoreWeave",
    ticker: "N/A:COREWEAVE",
    proxyTicker: "NVDA",
    notes: "GPUクラウド。インフラの要。",
    estimatedIpoDate: "2026-Q4",
    estimatedValuation: "—",
    field: "Compute / GPU Cloud",
    role: "GPU capacity aggregator",
    isMajorPlayer: true,
  },
  {
    companyName: "Canva",
    ticker: "N/A:CANVA",
    proxyTicker: "ADBE",
    notes: "デザインの民主化。Adobe競合。",
    estimatedIpoDate: "2026-Q4",
    estimatedValuation: "—",
    field: "Creative Software",
    role: "Design platform",
    isMajorPlayer: true,
  },
  {
    companyName: "Cohere",
    ticker: "N/A:COHERE",
    proxyTicker: "MSFT",
    notes: "企業特化型LLM。",
    estimatedIpoDate: "2026-Q4",
    estimatedValuation: "—",
    field: "Enterprise LLM",
    role: "Enterprise model & tooling",
    isMajorPlayer: false,
  },
  {
    companyName: "Anduril",
    ticker: "N/A:ANDURIL",
    proxyTicker: "PLTR",
    notes: "防衛AI。自律型兵器。",
    estimatedIpoDate: "2026-Q4",
    estimatedValuation: "—",
    field: "Defense AI",
    role: "Autonomous defense systems",
    isMajorPlayer: true,
  },
  {
    companyName: "Entire",
    ticker: "N/A:ENTIRE",
    proxyTicker: "MSFT",
    notes: "AIエージェント基盤。意図の管理。",
    estimatedIpoDate: "2026-Q4",
    estimatedValuation: "—",
    field: "Agent Infrastructure",
    role: "Intent + agent orchestration",
    isMajorPlayer: false,
  },
];

async function ensureTheme(db: ReturnType<typeof getDb>, userId: string): Promise<{ id: string; name: string }> {
  const preferred = ["AIデータセンター", "AI・エージェント基盤"];
  for (const name of preferred) {
    const rs = await db.execute({
      sql: `SELECT id, name FROM investment_themes WHERE user_id = ? AND name = ? LIMIT 1`,
      args: [userId, name],
    });
    const row = rs.rows[0];
    if (row) return { id: String(row.id), name: String(row.name) };
  }

  const name = preferred[0]!;
  const id = randomUUID();
  await db.execute({
    sql: `INSERT INTO investment_themes (id, user_id, name, description, goal) VALUES (?, ?, ?, ?, ?)`,
    args: [id, userId, name, "AIインフラ/基盤・周辺エコシステムの観測（上場前プロキシ含む）", "IPO候補の代理熱量を追跡"],
  });
  return { id, name };
}

async function main() {
  if (!isDbConfigured()) {
    console.error("Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN (e.g. .env.local).");
    process.exit(1);
  }
  const db = getDb();

  // Ensure columns exist (best-effort; ignore if already migrated)
  const migrate = await import("./migrate-theme-ecosystem-unlisted");
  void migrate;

  const { id: themeId, name: themeName } = await ensureTheme(db, DEFAULT_USER_ID);
  console.log(`Theme OK: ${themeName} (${themeId})`);

  for (const c of CANDIDATES) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO theme_ecosystem_members (
              id, theme_id, ticker,
              is_unlisted, proxy_ticker, estimated_ipo_date, estimated_valuation, observation_notes,
              company_name, field, role, is_major_player, observation_started_at
            ) VALUES (
              ?, ?, ?,
              1, ?, ?, ?, ?,
              ?, ?, ?, ?, NULL
            )`,
      args: [
        randomUUID(),
        themeId,
        c.ticker,
        c.proxyTicker,
        c.estimatedIpoDate,
        c.estimatedValuation,
        c.notes,
        c.companyName,
        c.field,
        c.role,
        c.isMajorPlayer ? 1 : 0,
      ],
    });
    console.log(`Seed OK: ${c.companyName} (${c.ticker}) via ${c.proxyTicker}`);
  }

  console.log("Seed complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

