/**
 * Live Yahoo Finance check: latest daily Alpha vs VOO for NVDA and JP fund code 06311181.
 * Run: npm run verify:prices
 */
import { fetchLatestAlphaSnapshot } from "../src/lib/price-service";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const jpProvider = process.env.VERIFY_JP_PROVIDER_SYMBOL?.trim();

  const cases = [
    { holdingId: "verify-nvda", ticker: "NVDA" as const, providerSymbol: null as string | null },
    {
      holdingId: "verify-jp-fund",
      ticker: "06311181" as const,
      providerSymbol: jpProvider && jpProvider.length > 0 ? jpProvider : null,
    },
  ] as const;

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i]!;
    const row = await fetchLatestAlphaSnapshot({
      holdingId: c.holdingId,
      ticker: c.ticker,
      providerSymbol: c.providerSymbol,
    });
    console.log(JSON.stringify({ input: c, row }, null, 2));
    if (i < cases.length - 1) await sleep(600);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
