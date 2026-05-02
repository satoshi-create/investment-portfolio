import type { LynchCategory } from "@/src/types/investment";

/** 将来 `notion-sync` 実装へ渡すスナップショット（DB には保存しない） */
export type StoryNotionPayload = {
  source: "inventory_story_modal";
  holdingId: string;
  ticker: string;
  companyName: string | null;
  /** `getLynchCategory` の自動算出結果（未分類は null） */
  lynchCategory: LynchCategory | null;
  /** モーダルで実際に使ったテンプレのキー（未分類時はユーザー選択のレンズ） */
  selectedLensCategory: LynchCategory;
  selectedDrivers: string[];
  /** 主な収益向上要因の自由記述 */
  driversNarrative: string;
  storyText: string;
  memoPlain: string | null;
  earningsSummaryNoteMarkdown: string | null;
  queuedAtIso: string;
  /** 案 A: `getLynchCategory === null` で診断モードを開いたとき true */
  diagnosticMode: boolean;
  /** 鑑定ラジオの値（診断モード以外は ""） */
  growthQualityAnswer: string;
  /** 汎用 5 パッチ ID（将来 monitoring_log の起点として利用） */
  universalPatches: string[];
};

/**
 * Notion 連携のプレースホルダ。本番 API 呼び出しは別タスク。
 * `InventoryTable` の行は `holdings.id` ベース（テーマ詳細の `stocks` も同一）。
 */
export function queueStoryForNotionSync(payload: StoryNotionPayload): void {
  if (process.env.NODE_ENV !== "production") {
    console.debug("[notion-sync stub] queueStoryForNotionSync", payload);
  }
}

/** ナフサ Pearson ρ を Notion の Number 列へ同期（ストーリー系キューとは独立）。 */
export type NaphthaNotionSyncRow = {
  ticker: string;
  naphthaCorrelationScore: number | null;
};

function notionHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28",
  };
}

/**
 * `Correlation (Naphtha)` 相当の Number プロパティへスコアを書き込む。
 * Env: `NOTION_API_TOKEN`, `NOTION_INVESTMENT_DATABASE_ID`,
 * optional `NOTION_TICKER_PROPERTY_NAME` (default `Ticker`),
 * `NOTION_NAPHTHA_CORRELATION_PROPERTY` (default `Correlation (Naphtha)`),
 * `NOTION_TICKER_PROPERTY_KIND` = `title` | `rich_text`（既定 title）。
 */
export async function syncNaphthaCorrelationToNotion(rows: NaphthaNotionSyncRow[]): Promise<{ patched: number }> {
  const token = process.env.NOTION_API_TOKEN?.trim();
  const dbId = process.env.NOTION_INVESTMENT_DATABASE_ID?.trim();
  const tickerProp = process.env.NOTION_TICKER_PROPERTY_NAME?.trim() || "Ticker";
  const corrProp = process.env.NOTION_NAPHTHA_CORRELATION_PROPERTY?.trim() || "Correlation (Naphtha)";
  const kind = process.env.NOTION_TICKER_PROPERTY_KIND?.trim() === "rich_text" ? "rich_text" : "title";

  if (!token || !dbId || rows.length === 0) {
    if (process.env.NODE_ENV !== "production") {
      console.debug("[notion-sync] syncNaphthaCorrelationToNotion skipped (missing NOTION_* env or empty rows)");
    }
    return { patched: 0 };
  }

  const prioritized = [...rows].sort((a, b) => {
    const order = (t: string) => {
      const prefs = ["4063.T", "4118.T", "3863.T"];
      const i = prefs.indexOf(t.trim().toUpperCase());
      return i === -1 ? 999 : i;
    };
    return order(a.ticker) - order(b.ticker);
  });

  let patched = 0;
  for (const row of prioritized) {
    const score = row.naphthaCorrelationScore;
    if (score == null || !Number.isFinite(score)) continue;
    try {
      const filter =
        kind === "title"
          ? { property: tickerProp, title: { equals: row.ticker } }
          : { property: tickerProp, rich_text: { equals: row.ticker } };

      const queryRes = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
        method: "POST",
        headers: notionHeaders(token),
        body: JSON.stringify({ filter, page_size: 2 }),
      });
      if (!queryRes.ok) continue;
      const qJson = (await queryRes.json()) as { results?: { id: string }[] };
      const pageId = qJson.results?.[0]?.id;
      if (pageId == null) continue;

      const patchRes = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
        method: "PATCH",
        headers: notionHeaders(token),
        body: JSON.stringify({
          properties: {
            [corrProp]: { number: score },
          },
        }),
      });
      if (patchRes.ok) patched++;
    } catch {
      /* Never throw — メインアプリを落とさない */
    }
  }

  return { patched };
}
