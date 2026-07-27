import { requireAsset } from "./catalog";
import { getMarketDataProvider } from "./provider";
import type { Asset, Quote } from "./types";

export interface MarketSnapshot {
  asset: Asset;
  quote: Quote;
  /** 24h close prices for the card sparkline, oldest first. */
  spark: number[];
}

/**
 * Server-side snapshot used to render market grids and tickers.
 *
 * Quotes and the sparkline series are fetched together so the first paint is
 * complete — the client then polls quotes alone, since the sparkline only moves
 * when a 15-minute bar closes.
 */
export async function getMarketSnapshots(
  symbols: readonly string[],
): Promise<MarketSnapshot[]> {
  const provider = getMarketDataProvider();

  return Promise.all(
    symbols.map(async (symbol) => {
      const asset = requireAsset(symbol);
      const [quote, series] = await Promise.all([
        provider.getQuote(asset.symbol),
        provider.getSeries(asset.symbol, "1D"),
      ]);

      return {
        asset,
        quote,
        // Every third bar is plenty of resolution at card size and keeps the
        // payload small across nine markets.
        spark: series.candles.filter((_, i) => i % 3 === 0).map((c) => c.c),
      };
    }),
  );
}
