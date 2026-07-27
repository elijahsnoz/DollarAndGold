/**
 * Catalog symbol → upstream symbol, per source.
 *
 * Kept out of `catalog.ts` on purpose: the catalog describes the *product's*
 * universe and should not accumulate a column every time a data source is
 * added. A symbol absent from a map means that source doesn't cover the asset,
 * which the composite provider reads as "route elsewhere".
 */

/** CoinGecko coin ids. */
export const COINGECKO_IDS: Record<string, string> = {
  BTCUSD: "bitcoin",
  ETHUSD: "ethereum",
  SOLUSD: "solana",
};

/**
 * Frankfurter quotes ECB reference rates as base→quote.
 * `invert` marks pairs the ECB publishes the other way round.
 */
export const FRANKFURTER_PAIRS: Record<
  string,
  { base: string; quote: string }
> = {
  EURUSD: { base: "EUR", quote: "USD" },
  GBPUSD: { base: "GBP", quote: "USD" },
  USDJPY: { base: "USD", quote: "JPY" },
  AUDUSD: { base: "AUD", quote: "USD" },
};

/** Twelve Data symbols — the one source covering the whole catalog. */
export const TWELVE_DATA_SYMBOLS: Record<string, string> = {
  XAUUSD: "XAU/USD",
  XAGUSD: "XAG/USD",
  WTIUSD: "WTI/USD",
  BTCUSD: "BTC/USD",
  ETHUSD: "ETH/USD",
  SOLUSD: "SOL/USD",
  EURUSD: "EUR/USD",
  GBPUSD: "GBP/USD",
  USDJPY: "USD/JPY",
  AUDUSD: "AUD/USD",
  NDX: "NDX",
  SPX: "SPX",
  DXY: "DXY",
  AAPL: "AAPL",
  NVDA: "NVDA",
  TSLA: "TSLA",
};

/** Yahoo Finance tickers. Futures for the commodities, `=X` for FX. */
export const YAHOO_SYMBOLS: Record<string, string> = {
  XAUUSD: "GC=F",
  XAGUSD: "SI=F",
  WTIUSD: "CL=F",
  BTCUSD: "BTC-USD",
  ETHUSD: "ETH-USD",
  SOLUSD: "SOL-USD",
  EURUSD: "EURUSD=X",
  GBPUSD: "GBPUSD=X",
  USDJPY: "USDJPY=X",
  AUDUSD: "AUDUSD=X",
  NDX: "^NDX",
  SPX: "^GSPC",
  DXY: "DX-Y.NYB",
  AAPL: "AAPL",
  NVDA: "NVDA",
  TSLA: "TSLA",
};
