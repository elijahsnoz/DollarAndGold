import { TIMEFRAMES } from "@/lib/market/simulation";
import type { Quote, Series, Timeframe } from "@/lib/market/types";
import { CACHE_TTL, cached } from "./cache";
import { aggregateToCandles, fetchJson } from "./http";
import { COINGECKO_IDS } from "./symbol-map";
import { normaliseCandles, type MarketDataSource } from "./types";

const BASE = "https://api.coingecko.com/api/v3";

/**
 * CoinGecko — crypto, no API key required.
 *
 * Uses `market_chart` rather than the `ohlc` endpoint: for a 90-day window
 * `ohlc` returns four-day candles, which is far too coarse for a 50-period
 * moving average. `market_chart` returns hourly ticks over the same window,
 * which we fold into bars ourselves at whatever granularity the timeframe
 * actually needs.
 *
 * A demo key (`COINGECKO_API_KEY`) is optional and simply raises the rate limit.
 */
export class CoinGeckoSource implements MarketDataSource {
  readonly id = "coingecko";
  readonly label = "CoinGecko";

  isAvailable(): boolean {
    return true; // Keyless.
  }

  covers(symbol: string): boolean {
    return symbol.toUpperCase() in COINGECKO_IDS;
  }

  private headers(): Record<string, string> {
    const key = process.env.COINGECKO_API_KEY;
    return key ? { "x-cg-demo-api-key": key } : {};
  }

  private toQuote(
    symbol: string,
    row: {
      usd: number;
      usd_24h_change?: number;
      usd_24h_vol?: number;
      last_updated_at?: number;
    },
  ): Quote {
    const price = row.usd;
    const changePercent = row.usd_24h_change ?? 0;
    // CoinGecko gives the percentage; recover the absolute move from it.
    const previous = price / (1 + changePercent / 100);

    return {
      symbol,
      price,
      change: price - previous,
      changePercent,
      // `simple/price` carries no session range. The composite fills these
      // from the series when it has one; until then, price is the honest
      // answer rather than an invented spread.
      high24h: Math.max(price, previous),
      low24h: Math.min(price, previous),
      volume: row.usd_24h_vol ?? 0,
      updatedAt: row.last_updated_at ? row.last_updated_at * 1000 : Date.now(),
      source: this.id,
    };
  }

  async getQuote(symbol: string): Promise<Quote | null> {
    const id = COINGECKO_IDS[symbol.toUpperCase()];
    if (!id) return null;

    return cached(`cg:quote:${id}`, CACHE_TTL.quote, async () => {
      const data = await fetchJson<
        Record<
          string,
          {
            usd: number;
            usd_24h_change?: number;
            usd_24h_vol?: number;
            last_updated_at?: number;
          }
        >
      >(
        this.id,
        `${BASE}/simple/price?ids=${id}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_last_updated_at=true`,
        { headers: this.headers() },
      );

      const row = data[id];
      if (!row || !Number.isFinite(row.usd)) return null;
      return this.toQuote(symbol.toUpperCase(), row);
    });
  }

  /**
   * Batches every requested symbol into one `simple/price` call instead of
   * one request per coin — the difference between a ticker of two dozen
   * crypto markets making two dozen concurrent requests against an anonymous
   * rate limit, or one.
   */
  async getQuotes(symbols: string[]): Promise<Map<string, Quote>> {
    const idToSymbol = new Map<string, string>();
    for (const raw of symbols) {
      const symbol = raw.toUpperCase();
      const id = COINGECKO_IDS[symbol];
      if (id) idToSymbol.set(id, symbol);
    }
    if (idToSymbol.size === 0) return new Map();

    const ids = [...idToSymbol.keys()].sort();

    return cached(`cg:quotes:${ids.join(",")}`, CACHE_TTL.quote, async () => {
      const data = await fetchJson<
        Record<
          string,
          {
            usd: number;
            usd_24h_change?: number;
            usd_24h_vol?: number;
            last_updated_at?: number;
          }
        >
      >(
        this.id,
        `${BASE}/simple/price?ids=${ids.join(",")}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_last_updated_at=true`,
        { headers: this.headers() },
      );

      const map = new Map<string, Quote>();
      for (const id of ids) {
        const row = data[id];
        if (!row || !Number.isFinite(row.usd)) continue;
        map.set(idToSymbol.get(id)!, this.toQuote(idToSymbol.get(id)!, row));
      }
      return map;
    });
  }

  async getSeries(symbol: string, timeframe: Timeframe): Promise<Series | null> {
    const id = COINGECKO_IDS[symbol.toUpperCase()];
    if (!id) return null;

    const spec = TIMEFRAMES[timeframe];
    const days = { "1D": 1, "1W": 7, "1M": 30, "3M": 90, "1Y": 365 }[timeframe];
    const ttl =
      timeframe === "1D" || timeframe === "1W"
        ? CACHE_TTL.intradaySeries
        : CACHE_TTL.dailySeries;

    return cached(`cg:series:${id}:${timeframe}`, ttl, async () => {
      const data = await fetchJson<{
        prices: [number, number][];
        total_volumes: [number, number][];
      }>(
        this.id,
        `${BASE}/coins/${id}/market_chart?vs_currency=usd&days=${days}`,
        { headers: this.headers(), timeoutMs: 8000 },
      );

      if (!Array.isArray(data.prices) || data.prices.length === 0) return null;

      const volumeByTime = new Map(data.total_volumes ?? []);
      const points = data.prices.map(([t, price]) => ({
        t,
        price,
        volume: volumeByTime.get(t),
      }));

      const candles = normaliseCandles(
        aggregateToCandles(points, spec.interval),
      ).slice(-spec.bars);

      if (candles.length < 10) return null;

      return { symbol: symbol.toUpperCase(), timeframe, candles, source: this.id };
    });
  }
}
