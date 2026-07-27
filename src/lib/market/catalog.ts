import type { Asset, AssetClass } from "./types";

/**
 * The tradeable universe. The first nine are the MVP's featured markets and
 * render on the Markets grid in this order; the rest exist so global search
 * and the watchlist have somewhere to grow.
 */
export const ASSETS: Asset[] = [
  {
    symbol: "XAUUSD",
    name: "Gold",
    ticker: "GOLD",
    assetClass: "commodity",
    currency: "USD",
    precision: 2,
    description: "Spot gold priced in US dollars per troy ounce.",
    drivers: [
      "real yields",
      "US dollar strength",
      "central bank buying",
      "safe-haven demand",
    ],
  },
  {
    symbol: "BTCUSD",
    name: "Bitcoin",
    ticker: "BTC",
    assetClass: "crypto",
    currency: "USD",
    precision: 2,
    description: "Bitcoin priced against the US dollar.",
    drivers: [
      "ETF flows",
      "global liquidity",
      "risk appetite",
      "halving supply dynamics",
    ],
  },
  {
    symbol: "ETHUSD",
    name: "Ethereum",
    ticker: "ETH",
    assetClass: "crypto",
    currency: "USD",
    precision: 2,
    description: "Ether priced against the US dollar.",
    drivers: [
      "network activity",
      "staking flows",
      "layer-2 adoption",
      "correlation to Bitcoin",
    ],
  },
  {
    symbol: "EURUSD",
    name: "Euro / US Dollar",
    ticker: "EUR/USD",
    assetClass: "forex",
    currency: "USD",
    precision: 5,
    description: "The world's most traded currency pair.",
    drivers: [
      "ECB vs Fed rate differentials",
      "eurozone growth data",
      "energy prices",
    ],
  },
  {
    symbol: "GBPUSD",
    name: "British Pound / US Dollar",
    ticker: "GBP/USD",
    assetClass: "forex",
    currency: "USD",
    precision: 5,
    description: "Sterling against the US dollar, known as cable.",
    drivers: ["Bank of England policy", "UK inflation prints", "risk sentiment"],
  },
  {
    symbol: "USDJPY",
    name: "US Dollar / Japanese Yen",
    ticker: "USD/JPY",
    assetClass: "forex",
    currency: "JPY",
    precision: 3,
    description: "The dollar against the yen — a classic rate-differential pair.",
    drivers: [
      "US Treasury yields",
      "Bank of Japan policy",
      "carry trade positioning",
      "intervention risk",
    ],
  },
  {
    symbol: "NDX",
    name: "NASDAQ 100",
    ticker: "NASDAQ",
    assetClass: "index",
    currency: "USD",
    precision: 2,
    description: "The 100 largest non-financial companies on the NASDAQ.",
    drivers: [
      "megacap earnings",
      "AI capex expectations",
      "long-duration rate sensitivity",
    ],
  },
  {
    symbol: "SPX",
    name: "S&P 500",
    ticker: "S&P 500",
    assetClass: "index",
    currency: "USD",
    precision: 2,
    description: "The benchmark index of US large-cap equities.",
    drivers: ["earnings breadth", "Fed policy path", "credit conditions"],
  },
  {
    symbol: "WTIUSD",
    name: "Crude Oil (WTI)",
    ticker: "OIL",
    assetClass: "energy",
    currency: "USD",
    precision: 2,
    description: "West Texas Intermediate crude oil, per barrel.",
    drivers: [
      "OPEC+ supply policy",
      "inventory builds",
      "geopolitical risk premium",
      "Chinese demand",
    ],
  },

  // --- Extended universe (search + watchlist) ---
  {
    symbol: "XAGUSD",
    name: "Silver",
    ticker: "SILVER",
    assetClass: "commodity",
    currency: "USD",
    precision: 3,
    description: "Spot silver in US dollars per troy ounce.",
    drivers: ["industrial demand", "gold ratio", "solar manufacturing"],
  },
  {
    symbol: "SOLUSD",
    name: "Solana",
    ticker: "SOL",
    assetClass: "crypto",
    currency: "USD",
    precision: 2,
    description: "Solana priced against the US dollar.",
    drivers: ["network throughput", "DeFi activity", "crypto beta"],
  },
  {
    symbol: "DXY",
    name: "US Dollar Index",
    ticker: "DXY",
    assetClass: "index",
    currency: "USD",
    precision: 3,
    description: "The dollar measured against a basket of major currencies.",
    drivers: ["Fed policy", "global growth spreads", "haven flows"],
  },
  {
    symbol: "AUDUSD",
    name: "Australian Dollar / US Dollar",
    ticker: "AUD/USD",
    assetClass: "forex",
    currency: "USD",
    precision: 5,
    description: "The Aussie dollar, a common proxy for global growth.",
    drivers: ["iron ore prices", "China data", "RBA policy"],
  },
  {
    symbol: "AAPL",
    name: "Apple Inc.",
    ticker: "AAPL",
    assetClass: "stock",
    currency: "USD",
    precision: 2,
    description: "Apple Inc. common stock, listed on NASDAQ.",
    drivers: ["iPhone cycle", "services margin", "China exposure"],
  },
  {
    symbol: "NVDA",
    name: "NVIDIA Corporation",
    ticker: "NVDA",
    assetClass: "stock",
    currency: "USD",
    precision: 2,
    description: "NVIDIA common stock, the bellwether for AI hardware demand.",
    drivers: ["data-centre orders", "export controls", "hyperscaler capex"],
  },
  {
    symbol: "TSLA",
    name: "Tesla, Inc.",
    ticker: "TSLA",
    assetClass: "stock",
    currency: "USD",
    precision: 2,
    description: "Tesla common stock.",
    drivers: ["delivery numbers", "margin per vehicle", "autonomy narrative"],
  },
];

/** The nine markets shown on the Markets grid and the landing ticker. */
export const FEATURED_SYMBOLS = [
  "XAUUSD",
  "BTCUSD",
  "ETHUSD",
  "EURUSD",
  "GBPUSD",
  "USDJPY",
  "NDX",
  "SPX",
  "WTIUSD",
] as const;

const BY_SYMBOL = new Map(ASSETS.map((a) => [a.symbol, a]));

export function getAsset(symbol: string): Asset | undefined {
  return BY_SYMBOL.get(symbol.toUpperCase());
}

/** Throws for unknown symbols — use in routes that already validated input. */
export function requireAsset(symbol: string): Asset {
  const asset = getAsset(symbol);
  if (!asset) throw new Error(`Unknown symbol: ${symbol}`);
  return asset;
}

export function getFeaturedAssets(): Asset[] {
  return FEATURED_SYMBOLS.map((s) => requireAsset(s));
}

export const ASSET_CLASS_LABEL: Record<AssetClass, string> = {
  commodity: "Commodities",
  crypto: "Crypto",
  forex: "Forex",
  index: "Indices",
  stock: "Stocks",
  energy: "Energy",
};

/** Simple fuzzy-ish search across symbol, name and ticker. */
export function searchAssets(query: string, limit = 8): Asset[] {
  const q = query.trim().toLowerCase();
  if (!q) return getFeaturedAssets().slice(0, limit);

  return ASSETS.map((asset) => {
    const symbol = asset.symbol.toLowerCase();
    const name = asset.name.toLowerCase();
    const ticker = asset.ticker.toLowerCase();

    let score = 0;
    if (symbol === q || ticker === q) score = 100;
    else if (symbol.startsWith(q) || ticker.startsWith(q)) score = 80;
    else if (name.toLowerCase().startsWith(q)) score = 70;
    else if (name.includes(q)) score = 50;
    else if (symbol.includes(q) || ticker.includes(q)) score = 40;

    return { asset, score };
  })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.asset);
}
