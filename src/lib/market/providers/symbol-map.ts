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
  BNBUSD: "binancecoin",
  XRPUSD: "ripple",
  TRXUSD: "tron",
  DOGEUSD: "dogecoin",
  ZECUSD: "zcash",
  XMRUSD: "monero",
  ADAUSD: "cardano",
  LINKUSD: "chainlink",
  XLMUSD: "stellar",
  BCHUSD: "bitcoin-cash",
  LTCUSD: "litecoin",
  HBARUSD: "hedera-hashgraph",
  SHIBUSD: "shiba-inu",
  SUIUSD: "sui",
  AVAXUSD: "avalanche-2",
  UNIUSD: "uniswap",
  NEARUSD: "near",
  TAOUSD: "bittensor",
  AAVEUSD: "aave",
  DOTUSD: "polkadot",
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
  USDCAD: { base: "USD", quote: "CAD" },
  USDCHF: { base: "USD", quote: "CHF" },
  NZDUSD: { base: "NZD", quote: "USD" },
  EURGBP: { base: "EUR", quote: "GBP" },
  EURJPY: { base: "EUR", quote: "JPY" },
  GBPJPY: { base: "GBP", quote: "JPY" },
  EURCHF: { base: "EUR", quote: "CHF" },
  EURAUD: { base: "EUR", quote: "AUD" },
  EURCAD: { base: "EUR", quote: "CAD" },
  EURNZD: { base: "EUR", quote: "NZD" },
  GBPAUD: { base: "GBP", quote: "AUD" },
  GBPCAD: { base: "GBP", quote: "CAD" },
  GBPCHF: { base: "GBP", quote: "CHF" },
  GBPNZD: { base: "GBP", quote: "NZD" },
  AUDJPY: { base: "AUD", quote: "JPY" },
  AUDCAD: { base: "AUD", quote: "CAD" },
  AUDCHF: { base: "AUD", quote: "CHF" },
  AUDNZD: { base: "AUD", quote: "NZD" },
  CADJPY: { base: "CAD", quote: "JPY" },
  CHFJPY: { base: "CHF", quote: "JPY" },
  NZDJPY: { base: "NZD", quote: "JPY" },
  USDSEK: { base: "USD", quote: "SEK" },
  USDNOK: { base: "USD", quote: "NOK" },
  USDZAR: { base: "USD", quote: "ZAR" },
  USDMXN: { base: "USD", quote: "MXN" },
  USDSGD: { base: "USD", quote: "SGD" },
  USDHKD: { base: "USD", quote: "HKD" },
  USDCNY: { base: "USD", quote: "CNY" },
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
