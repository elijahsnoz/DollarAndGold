import { analyseAsset } from "@/lib/ai/analysis";
import { getAsset } from "@/lib/market/catalog";
import type { TrendDirection } from "@/lib/market/types";
import type { MarketCardData, TradeSignal } from "../../types";

/** Assets shown on the Market Dashboard, mapped to catalog symbols. */
export const AI_TRADER_SYMBOLS = [
  "BTCUSD",
  "ETHUSD",
  "XAUUSD",
  "EURUSD",
  "NDX",
  "SPX",
  "WTIUSD",
] as const;

export function signalFromTrend(direction: TrendDirection): TradeSignal {
  if (direction === "bullish") return "buy";
  if (direction === "bearish") return "sell";
  return "hold";
}

/**
 * Market Agent: the Market Dashboard's data source.
 *
 * "Signal" is a direct, honest relabelling of the existing trend verdict
 * (bullish → buy, bearish → sell, neutral → hold) — the same deterministic
 * engine the rest of the app runs on, not a separately invented prediction.
 */
export async function loadMarketCards(): Promise<MarketCardData[]> {
  const results = await Promise.all(
    AI_TRADER_SYMBOLS.map(async (symbol) => {
      const asset = getAsset(symbol);
      if (!asset) return null;

      try {
        const analysis = await analyseAsset(symbol, "3M");
        return {
          symbol: asset.symbol,
          name: asset.name,
          ticker: asset.ticker,
          precision: asset.precision,
          price: analysis.price,
          changePercent: analysis.changePercent,
          trend: analysis.trend.direction,
          confidence: analysis.trend.confidence,
          signal: signalFromTrend(analysis.trend.direction),
        } satisfies MarketCardData;
      } catch {
        // A market that can't be loaded is simply absent from the dashboard.
        return null;
      }
    }),
  );

  return results.filter((card): card is MarketCardData => card !== null);
}
