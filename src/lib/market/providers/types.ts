import type { Candle, Quote, Series, Timeframe } from "@/lib/market/types";

/**
 * A single upstream market data source.
 *
 * Deliberately narrower than `MarketDataProvider`: a source is allowed to not
 * cover a symbol, and is allowed to fail. The composite provider above it is
 * what turns "several partial, fallible sources" into the total, always-succeeds
 * contract the rest of the app already depends on.
 *
 * Returning `null` means "I don't have this" — it is not an error and must not
 * be logged as one. Throwing means the source was expected to work and didn't
 * (network, rate limit, malformed payload), which is what demotes it.
 */
export interface MarketDataSource {
  readonly id: string;
  /** Human-readable attribution shown in the UI. */
  readonly label: string;
  /** False when the source needs credentials that aren't configured. */
  isAvailable(): boolean;
  /** True if this source claims coverage of the catalog symbol. */
  covers(symbol: string): boolean;
  getQuote(symbol: string): Promise<Quote | null>;
  getSeries(symbol: string, timeframe: Timeframe): Promise<Series | null>;
}

/** Where a given figure actually came from. Surfaced in the UI. */
export interface DataProvenance {
  sourceId: string;
  label: string;
  live: boolean;
}

export class SourceError extends Error {
  constructor(
    readonly sourceId: string,
    message: string,
    readonly status?: number,
  ) {
    super(`[${sourceId}] ${message}`);
    this.name = "SourceError";
  }
}

/** Sort ascending by time and drop bars with holes — indicators assume both. */
export function normaliseCandles(candles: Candle[]): Candle[] {
  return candles
    .filter(
      (c) =>
        Number.isFinite(c.t) &&
        Number.isFinite(c.o) &&
        Number.isFinite(c.h) &&
        Number.isFinite(c.l) &&
        Number.isFinite(c.c) &&
        c.c > 0,
    )
    .map((c) => ({
      ...c,
      // Some feeds report a high/low that doesn't actually bound open/close.
      h: Math.max(c.h, c.o, c.c),
      l: Math.min(c.l, c.o, c.c),
      v: Number.isFinite(c.v) && c.v > 0 ? c.v : 0,
    }))
    .sort((a, b) => a.t - b.t);
}

/** Derive a quote from a candle series when a source has no quote endpoint. */
export function quoteFromCandles(
  symbol: string,
  candles: Candle[],
  sourceId: string,
): Quote | null {
  if (candles.length === 0) return null;

  const last = candles[candles.length - 1];
  // Compare against the previous session's close, which is what "24h change"
  // means for anything that doesn't trade continuously.
  const previous = candles.length > 1 ? candles[candles.length - 2] : last;
  const change = last.c - previous.c;

  return {
    symbol,
    price: last.c,
    change,
    changePercent: previous.c === 0 ? 0 : (change / previous.c) * 100,
    high24h: Math.max(last.h, last.c),
    low24h: Math.min(last.l, last.c),
    volume: last.v,
    updatedAt: last.t,
    source: sourceId,
  };
}
