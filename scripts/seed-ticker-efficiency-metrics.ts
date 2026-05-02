import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";
import { getDb, isDbConfigured } from "@/src/lib/db";

type Row = {
  ticker: string;
  revenueGrowth: number | null;
  fcfMargin: number | null;
  fcfYield: number | null;
  fcf: number | null;
  ebitda: number | null;
  updatedAt: string | null;
};

function parseCsv(raw: string): string[][] {
  // Minimal CSV parser: commas + quotes, no multiline fields.
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0 && !l.trim().startsWith("#"));
  const rows: string[][] = [];
  for (const line of lines) {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!;
      if (ch === '"') {
        const next = line[i + 1];
        if (inQuotes && next === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (ch === "," && !inQuotes) {
        out.push(cur);
        cur = "";
        continue;
      }
      cur += ch;
    }
    out.push(cur);
    rows.push(out.map((x) => x.trim()));
  }
  return rows;
}

function numOrNull(raw: string | undefined): number | null {
  const s = (raw ?? "").trim();
  if (s.length === 0) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function strOrNull(raw: string | undefined): string | null {
  const s = (raw ?? "").trim();
  return s.length > 0 ? s : null;
}

function resolveCsvPath(): string {
  const arg = process.argv.slice(2).find((a) => !a.startsWith("--"));
  if (arg) return path.isAbsolute(arg) ? arg : path.join(process.cwd(), arg);
  return path.join(process.cwd(), "seed", "ticker-efficiency-metrics.csv");
}

async function main() {
  // Ensure `.env.local` works for CLI scripts too (matches `next dev`).
  dotenv.config({ path: path.join(process.cwd(), ".env.local") });

  if (!isDbConfigured()) {
    throw new Error("Database not configured (set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN)");
  }
  const csvPath = resolveCsvPath();
  const raw = fs.readFileSync(csvPath, "utf-8");
  const rows = parseCsv(raw);
  if (rows.length < 2) {
    console.log("No rows.");
    return;
  }

  const header = rows[0]!.map((h) => h.toLowerCase());
  const idx = (k: string) => header.indexOf(k);
  const iTicker = idx("ticker");
  if (iTicker < 0) throw new Error('CSV must include "ticker" header');

  const iRev = idx("revenue_growth");
  const iMargin = idx("fcf_margin");
  const iYield = idx("fcf_yield");
  const iFcf = idx("fcf");
  const iEbitda = idx("ebitda");
  const iUpdated = idx("updated_at");

  const parsed: Row[] = [];
  for (const r of rows.slice(1)) {
    const ticker = String(r[iTicker] ?? "").trim();
    if (ticker.length === 0) continue;
    parsed.push({
      ticker,
      revenueGrowth: iRev >= 0 ? numOrNull(r[iRev]) : null,
      fcfMargin: iMargin >= 0 ? numOrNull(r[iMargin]) : null,
      fcfYield: iYield >= 0 ? numOrNull(r[iYield]) : null,
      fcf: iFcf >= 0 ? numOrNull(r[iFcf]) : null,
      ebitda: iEbitda >= 0 ? numOrNull(r[iEbitda]) : null,
      updatedAt: iUpdated >= 0 ? strOrNull(r[iUpdated]) : null,
    });
  }

  if (parsed.length === 0) {
    console.log("No valid rows.");
    return;
  }

  const db = getDb();
  let ok = 0;
  for (const r of parsed) {
    const hasAny =
      r.revenueGrowth != null ||
      r.fcfMargin != null ||
      r.fcfYield != null ||
      r.fcf != null ||
      r.ebitda != null ||
      r.updatedAt != null;
    if (!hasAny) continue;
    await db.execute({
      sql: `INSERT INTO ticker_efficiency_metrics
              (ticker, revenue_growth, fcf_margin, fcf_yield, fcf, ebitda, updated_at)
            VALUES
              (?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))
            ON CONFLICT(ticker) DO UPDATE SET
              revenue_growth = COALESCE(excluded.revenue_growth, ticker_efficiency_metrics.revenue_growth),
              fcf_margin = COALESCE(excluded.fcf_margin, ticker_efficiency_metrics.fcf_margin),
              fcf_yield = COALESCE(excluded.fcf_yield, ticker_efficiency_metrics.fcf_yield),
              fcf = COALESCE(excluded.fcf, ticker_efficiency_metrics.fcf),
              ebitda = COALESCE(excluded.ebitda, ticker_efficiency_metrics.ebitda),
              updated_at = excluded.updated_at`,
      args: [
        r.ticker,
        r.revenueGrowth,
        r.fcfMargin,
        r.fcfYield,
        r.fcf,
        r.ebitda,
        r.updatedAt,
      ],
    });
    ok += 1;
  }

  console.log(`Upserted ${ok} rows into ticker_efficiency_metrics from ${path.relative(process.cwd(), csvPath)}.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});

