import type { EquityResearchSnapshot } from "@/src/lib/price-service";

export type LynchHoldingsResearchRow = {
  id: string;
  displayName: string;
  ticker: string;
  research: EquityResearchSnapshot | null;
};
