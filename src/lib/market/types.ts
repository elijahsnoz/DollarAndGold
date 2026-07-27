/**
 * Core market domain types.
 *
 * Everything downstream (charts, indicators, AI analysis, watchlists) speaks
 * these shapes, so swapping the data provider never ripples into the UI.
 */

export type AssetClass =
  | "commodity"
  | "crypto"
  | "forex"
  | "index"
  | "stock"
  | "energy";

export type Timeframe = "1D" | "1W" | "1M" | "3M" | "1Y";

export interface Asset {
  /** Canonical, URL-safe identifier. e.g. "XAUUSD", "BTCUSD". */
  symbol: string;
  name: string;
  /** Short label for dense surfaces (cards, tickers, tables). */
  ticker: string;
  assetClass: AssetClass;
  /** ISO 4217 code of the quote currency, or "USD" for index points. */
  currency: string;
  /** Decimal places used for every display of this asset's price. */
  precision: number;
  /** One-line plain-English description shown in search and analysis headers. */
  description: string;
  /** Drives the simulated series and the AI's context about what moves it. */
  drivers: string[];
}

export interface Candle {
  /** Unix ms at the open of the bar. */
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  /** Notional volume — relative, not a real exchange figure. */
  v: number;
}

export interface Quote {
  symbol: string;
  price: number;
  /** Absolute change over the trailing 24h. */
  change: number;
  /** Percentage change over the trailing 24h. */
  changePercent: number;
  high24h: number;
  low24h: number;
  /** Rolling 24h notional volume. */
  volume: number;
  /** Unix ms the quote was produced. */
  updatedAt: number;
  /**
   * Id of the source that produced this figure. Optional so existing callers
   * are unaffected, but the UI uses it to state plainly whether the number is
   * live or simulated — this product does not get to blur that line.
   */
  source?: string;
}

export interface Series {
  symbol: string;
  timeframe: Timeframe;
  candles: Candle[];
  /** Id of the source that produced these candles. See `Quote.source`. */
  source?: string;
}

export type TrendDirection = "bullish" | "bearish" | "neutral";

export type IndicatorSignal = "bullish" | "bearish" | "neutral";

export interface IndicatorReading {
  key: string;
  label: string;
  /** Pre-formatted for display — the engine owns rounding, not the UI. */
  value: string;
  signal: IndicatorSignal;
  /** Plain-English reading of what this number means right now. */
  interpretation: string;
}

export interface MarketDataProvider {
  readonly id: string;
  getQuote(symbol: string): Promise<Quote>;
  getQuotes(symbols: string[]): Promise<Quote[]>;
  getSeries(symbol: string, timeframe: Timeframe): Promise<Series>;
}
