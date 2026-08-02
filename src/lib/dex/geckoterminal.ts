import { cached } from "@/lib/market/providers/cache";

/**
 * GeckoTerminal — on-chain DEX pool data.
 *
 * Deliberately separate from `lib/market/`: these are not catalog assets.
 * A pool here can be minutes old, near-zero liquidity, or an outright scam —
 * none of the deterministic analysis engine's assumptions (enough candle
 * history for RSI/MACD/support-resistance to mean anything) hold. This
 * module exists to report what GeckoTerminal actually knows — liquidity,
 * volume, pool age — never to force these tokens into the same
 * technical-analysis shape as the curated catalog.
 *
 * Keyless, same vendor family as the existing CoinGecko integration.
 */

const BASE = "https://api.geckoterminal.com/api/v2";
const CACHE_TTL_MS = 60_000;

export interface TrendingToken {
  id: string;
  poolAddress: string;
  network: string;
  dex: string;
  baseSymbol: string;
  quoteSymbol: string;
  priceUsd: number;
  priceChangePercent24h: number;
  volumeUsd24h: number;
  liquidityUsd: number;
  fdvUsd: number | null;
  /** Unix ms. 0 when GeckoTerminal doesn't report it for this pool. */
  poolCreatedAt: number;
  buys24h: number;
  sells24h: number;
}

interface GeckoTerminalPool {
  id: string;
  attributes: {
    address: string;
    name: string;
    base_token_price_usd: string;
    pool_created_at: string | null;
    fdv_usd: string | null;
    price_change_percentage?: { h24?: string };
    volume_usd?: { h24?: string };
    reserve_in_usd?: string;
    transactions?: { h24?: { buys?: number; sells?: number } };
  };
  relationships?: {
    dex?: { data?: { id?: string } };
  };
}

function toTrendingToken(pool: GeckoTerminalPool, network: string): TrendingToken {
  const attrs = pool.attributes;
  const [baseSymbol, quoteSymbol] = (attrs.name ?? "? / ?").split("/").map((s) => s.trim());

  return {
    id: pool.id,
    poolAddress: attrs.address,
    network,
    dex: pool.relationships?.dex?.data?.id ?? "unknown",
    baseSymbol: baseSymbol || "?",
    quoteSymbol: quoteSymbol || "?",
    priceUsd: Number(attrs.base_token_price_usd) || 0,
    priceChangePercent24h: Number(attrs.price_change_percentage?.h24) || 0,
    volumeUsd24h: Number(attrs.volume_usd?.h24) || 0,
    liquidityUsd: Number(attrs.reserve_in_usd) || 0,
    fdvUsd: attrs.fdv_usd ? Number(attrs.fdv_usd) : null,
    poolCreatedAt: attrs.pool_created_at ? new Date(attrs.pool_created_at).getTime() : 0,
    buys24h: attrs.transactions?.h24?.buys ?? 0,
    sells24h: attrs.transactions?.h24?.sells ?? 0,
  };
}

/**
 * Trending pools on a network, per GeckoTerminal's own ranking — not a
 * DollarAndGold judgement of quality. Defaults to Solana, the chain most
 * associated with "just launched" DEX activity.
 */
export async function getTrendingTokens(
  network = "solana",
  limit = 18,
): Promise<TrendingToken[]> {
  return cached(`geckoterminal:trending:${network}`, CACHE_TTL_MS, async () => {
    const response = await fetch(`${BASE}/networks/${network}/trending_pools?page=1`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(`GeckoTerminal request failed (${response.status}).`);
    }

    const data = (await response.json()) as { data: GeckoTerminalPool[] };
    return (data.data ?? []).slice(0, limit).map((pool) => toTrendingToken(pool, network));
  });
}
