import { requireAsset } from "./catalog";
import { DAY, HOUR, TIMEFRAMES, generateCandles, getModel, priceAt } from "./simulation";
import type { MarketDataProvider, Quote, Series, Timeframe } from "./types";

/**
 * The deterministic simulated provider.
 *
 * Extracted from `provider.ts` so the composite can depend on it without a
 * circular import. Behaviour is unchanged — it remains the always-succeeds
 * floor beneath the live sources, and the reason the product is fully
 * explorable with no credentials at all.
 */
export class SimulatedProvider implements MarketDataProvider {
  readonly id = "simulated";

  /**
   * Quotes are bucketed to 5s so a page hydrating on the client sees the same
   * number the server rendered, while still visibly ticking as the user watches.
   */
  private now(): number {
    return Math.floor(Date.now() / 5000) * 5000;
  }

  async getQuote(symbol: string): Promise<Quote> {
    const asset = requireAsset(symbol);
    const model = getModel(asset.symbol);
    const now = this.now();

    const price = priceAt(asset.symbol, now);
    const prev = priceAt(asset.symbol, now - DAY);
    const change = price - prev;

    // Sample the last 24h hourly for the session range.
    let high = price;
    let low = price;
    for (let i = 0; i <= 24; i++) {
      const p = priceAt(asset.symbol, now - i * HOUR);
      if (p > high) high = p;
      if (p < low) low = p;
    }

    // Volume responds to how much the market actually moved today.
    const moveFactor = 1 + Math.min(Math.abs(change / prev) * 12, 1.8);

    return {
      symbol: asset.symbol,
      price,
      change,
      changePercent: prev === 0 ? 0 : (change / prev) * 100,
      high24h: high,
      low24h: low,
      volume: model.volume * moveFactor,
      updatedAt: now,
      source: this.id,
    };
  }

  async getQuotes(symbols: string[]): Promise<Quote[]> {
    return Promise.all(symbols.map((s) => this.getQuote(s)));
  }

  async getSeries(symbol: string, timeframe: Timeframe): Promise<Series> {
    const asset = requireAsset(symbol);
    // Series snap to their own bar grid, so they only change when a bar closes.
    const spec = TIMEFRAMES[timeframe];
    const now = Math.floor(Date.now() / spec.interval) * spec.interval;

    return {
      symbol: asset.symbol,
      timeframe,
      candles: generateCandles(asset.symbol, timeframe, now),
      source: this.id,
    };
  }
}
