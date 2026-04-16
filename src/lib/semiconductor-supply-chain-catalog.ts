/**
 * 半導体サプライチェーン（`semiconducter-data_new.csv`）。
 * ティッカー列が空・誤結合・N/A の行は公開ティッカー／未上場+プロキシに正規化する。
 */
export const SEMICONDUCTOR_SUPPLY_CHAIN_THEME_NAME = "半導体サプライチェーン" as const;

export const SEMICONDUCTOR_SUPPLY_CHAIN_CSV_FILENAME =
  "semiconducter-data_new.csv" as const;

export type SemiconductorSupplyChainCatalogRow = {
  companyNameJa: string;
  companyNameEn: string | null;
  country: string;
  field: string;
  primaryRole: string;
  ticker: string;
  isMajorPlayer: boolean;
  isUnlisted: boolean;
  proxyTicker: string | null;
  /** CSV と異なる解決をしたときのメモ */
  resolutionNote: string | null;
};

/** 企業名（CSV 先頭列の trim）→ 強制ティッカー（CSV の誤り修正・欠損補完） */
const TICKER_OVERRIDE_BY_COMPANY: Readonly<Record<string, string>> = {
  ADEKA: "4401",
  AGC: "5201",
  AMD: "AMD",
  Amkor: "AMKR",
  "Apple（設計）": "AAPL",
  "Applied Materials": "AMAT",
  Broadcom: "AVGO",
  Cohu: "COHU",
  DISCO: "6146",
  "Google（TPU）": "GOOGL",
  HOYA: "7741",
  "IBM（International Business Machines）": "IBM",
  Intel: "INTC",
  JSR: "4185",
  JテックC: "6316",
  KLA: "KLAC",
  "KOKUSAI ELECTRIC": "6525",
  "Kulicke & Soffa": "KLIC",
  "Lam Research": "LRCX",
  "Meta（AIチップ）": "META",
  NVIDIA: "NVDA",
  Qualcomm: "QCOM",
  "RS Tech": "3445",
  "SCREEN HD": "7735",
  SUMCO: "3436",
  "Tesla（自社AIチップ）": "TSLA",
  "Texas Instruments": "TXN",
  アドバンテスト: "6857",
  アルバック: "6728",
  イビデン: "4062",
  キオクシア: "N/A:KIOXIA",
  "キヤノン（Canon Inc.）": "7751",
  ノリタケ: "5334",
  フェローテック: "6890",
  ラピダス: "N/A:RAPIDUS",
  ルネサス: "6723",
  レーザーテック: "6920",
  ローム: "6963",
  "荏原（EBARA）": "6361",
  関東電化工業: "4047",
  三井ハイテック: "6965",
  住友化学: "4005",
  信越化学工業: "4063",
  "東京エレクトロン（TEL）": "8035",
  "東京応化工業（TOK）": "4186",
  "東京精密（Accretech）": "7729",
  日産化学: "4023",
  日本酸素HD: "4091",
  富士フイルムHD: "4901",
};

const UNLISTED_PROXY: Readonly<Record<string, string>> = {
  "N/A:KIOXIA": "MU",
  /** TEL(8035) とティッカー重複しないようファウンドリ代表として TSMC を代理にする */
  "N/A:RAPIDUS": "TSM",
};

const MAJOR_TICKERS = new Set(
  [
    "NVDA",
    "AMD",
    "INTC",
    "AVGO",
    "AAPL",
    "GOOGL",
    "META",
    "TSLA",
    "TXN",
    "AMAT",
    "LRCX",
    "KLAC",
    "8035",
    "6857",
    "MU",
    "6146",
    "3436",
  ].map((s) => s.toUpperCase()),
);

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  const pushCell = () => {
    row.push(cur);
    cur = "";
  };
  const pushRow = () => {
    if (row.length > 0 && row.some((c) => c.trim().length > 0)) {
      rows.push(row);
    }
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      pushCell();
    } else if (c === "\n") {
      pushCell();
      pushRow();
    } else if (c === "\r") {
      /* ignore CR; \n follows */
    } else {
      cur += c;
    }
  }
  pushCell();
  pushRow();
  return rows;
}

function normalizeTickerCell(raw: string): string {
  return raw.trim().replace(/\.T$/i, "");
}

function resolutionNoteFor(
  company: string,
  rawTicker: string,
  resolved: string,
): string | null {
  const raw = normalizeTickerCell(rawTicker);
  if (raw === resolved) return null;
  const o = TICKER_OVERRIDE_BY_COMPANY[company.trim()];
  if (raw.length === 0 && o != null) {
    return "CSV 欠損ティッカーを補完";
  }
  if (o != null) {
    return "CSV のティッカー列を公開コードに合わせて補正";
  }
  return null;
}

/**
 * `semiconducter-data_new.csv` の全文からウォッチ行を生成。
 * 信越化学工業の 2 行は 4063 に統合する。
 */
export function buildSemiconductorSupplyChainCatalog(
  csvText: string,
): SemiconductorSupplyChainCatalogRow[] {
  const matrix = parseCsv(csvText.trim());
  if (matrix.length < 2) return [];
  const header = matrix[0]!.map((h) => h.trim().toLowerCase());
  const iCompany = header.findIndex((h) => h.includes("company") && !h.includes("_en"));
  const iEn = header.findIndex((h) => h.includes("company") && h.includes("_en"));
  const iCountry = header.findIndex((h) => h === "country");
  const iField = header.findIndex((h) => h === "field");
  const iRole = header.findIndex((h) => h.includes("primary") || h === "primary role");
  const iTicker = header.findIndex((h) => h === "ticker");
  if (iCompany < 0 || iField < 0 || iRole < 0 || iTicker < 0) return [];

  type Raw = {
    company: string;
    en: string;
    country: string;
    field: string;
    role: string;
    tickerCell: string;
  };
  const raws: Raw[] = [];
  for (let r = 1; r < matrix.length; r++) {
    const line = matrix[r]!;
    if (line.every((c) => c.trim().length === 0)) continue;
    const company = (line[iCompany] ?? "").trim();
    if (!company) continue;
    raws.push({
      company,
      en: iEn >= 0 ? (line[iEn] ?? "").trim() || "" : "",
      country: iCountry >= 0 ? (line[iCountry] ?? "").trim() || "" : "",
      field: (line[iField] ?? "").trim(),
      role: (line[iRole] ?? "").trim(),
      tickerCell: (line[iTicker] ?? "").trim(),
    });
  }

  const byShinetsu = raws.filter((x) => x.company.startsWith("信越化学工業"));
  const nonShinetsu = raws.filter((x) => !x.company.startsWith("信越化学工業"));

  const out: SemiconductorSupplyChainCatalogRow[] = [];

  for (const x of nonShinetsu) {
    const override = TICKER_OVERRIDE_BY_COMPANY[x.company];
    const normalizedRaw = normalizeTickerCell(x.tickerCell);
    const resolved =
      override ??
      (normalizedRaw.length > 0 && !/^n\/?a$/i.test(normalizedRaw)
        ? normalizedRaw
        : "");
    if (!resolved) continue;
    const isUnlisted = resolved.startsWith("N/A:");
    const proxyTicker = isUnlisted ? (UNLISTED_PROXY[resolved] ?? null) : null;
    const note = resolutionNoteFor(x.company, x.tickerCell, resolved);
    out.push({
      companyNameJa: x.company,
      companyNameEn: x.en.length > 0 ? x.en : null,
      country: x.country,
      field: x.field,
      primaryRole: x.role,
      ticker: resolved,
      isMajorPlayer: MAJOR_TICKERS.has(resolved.toUpperCase()),
      isUnlisted,
      proxyTicker,
      resolutionNote: note,
    });
  }

  if (byShinetsu.length > 0) {
    const roles = byShinetsu.map((s) => s.role).filter(Boolean);
    const fields = byShinetsu.map((s) => s.field).filter(Boolean);
    const field = fields.includes("前工程（CMP）")
      ? "前工程（CMP）"
      : fields[0] ?? "材料";
    out.push({
      companyNameJa: "信越化学工業",
      companyNameEn: null,
      country: byShinetsu[0]!.country,
      field,
      primaryRole: roles.join(" / "),
      ticker: "4063",
      isMajorPlayer: MAJOR_TICKERS.has("4063"),
      isUnlisted: false,
      proxyTicker: null,
      resolutionNote:
        byShinetsu.length > 1
          ? "CSV 2 行（ウェハー・レジスト / CMP）を 4063 に統合"
          : resolutionNoteFor(
              "信越化学工業",
              byShinetsu[0]!.tickerCell,
              "4063",
            ),
    });
  }

  return out;
}

export function supplyChainFieldSummary(
  rows: readonly SemiconductorSupplyChainCatalogRow[],
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
