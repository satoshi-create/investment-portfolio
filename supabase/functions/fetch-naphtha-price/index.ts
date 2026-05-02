/**
 * Supabase Edge Function（Postgres + Supabase ホスティング向け）。
 * Turso のみ運用の場合は `scripts/ingest-naphtha-price.ts` または `POST /api/cron/naphtha-ingest` を利用。
 *
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, optional NAPHTHA_YAHOO_SYMBOL (default CL=F)
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }), {
        status: 503,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const yahooSymbol = Deno.env.get("NAPHTHA_YAHOO_SYMBOL") ?? "CL=F";
    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=10d`;
    const quoteRes = await fetch(chartUrl);
    if (!quoteRes.ok) {
      return new Response(JSON.stringify({ error: `Yahoo HTTP ${quoteRes.status}` }), {
        status: 502,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const j = (await quoteRes.json()) as {
      chart?: { result?: Array<{ timestamp?: number[]; indicators?: { quote?: Array<{ close?: (number | null)[] }> } }> };
    };
    const result = j?.chart?.result?.[0];
    const timestamps = result?.timestamp;
    const closes = result?.indicators?.quote?.[0]?.close;
    const n = Array.isArray(timestamps) ? timestamps.length : 0;
    if (n < 1 || !closes?.[n - 1]) {
      return new Response(JSON.stringify({ error: "No Yahoo bars" }), {
        status: 502,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const lastIdx = n - 1;
    const close = closes[lastIdx] as number;
    const tsSec = timestamps![lastIdx]!;
    const dateIso = new Date(tsSec * 1000).toISOString();

    const supabase = createClient(supabaseUrl, serviceKey);
    const id = crypto.randomUUID();
    const { error } = await supabase.from("commodity_prices").insert({
      id,
      symbol: "NAPHTHA",
      price: close,
      timestamp: dateIso,
      source_url: `yahoo:${yahooSymbol}`,
    });
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        symbol: "NAPHTHA",
        proxy: yahooSymbol,
        price: close,
        timestamp: dateIso,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
