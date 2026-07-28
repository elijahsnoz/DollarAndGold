import { analyseAsset } from "@/lib/ai/analysis";
import { getMarketDataProvider } from "@/lib/market/provider";
import { conditionsFromAnalysis } from "./derive";
import type { MarketConditions } from "./types";

/**
 * Server-side context capture.
 *
 * Used when a user acts on a market without an analysis already on screen —
 * recording a trade from the dashboard, for instance. The pure derivation lives
 * in `derive.ts` so client components can use it without pulling the analysis
 * engine into the browser bundle.
 */
export async function captureConditions(
  symbol: string,
): Promise<MarketConditions | null> {
  try {
    const [analysis, series] = await Promise.all([
      analyseAsset(symbol, "1M"),
      getMarketDataProvider().getSeries(symbol, "1M"),
    ]);

    return conditionsFromAnalysis(analysis, series.source);
  } catch {
    // A snapshot that cannot be taken is simply absent. Never substitute a
    // guess — a fabricated data point is indistinguishable from a real one
    // later, and would corrupt every conclusion drawn from the set.
    return null;
  }
}

export { conditionsFromAnalysis };
