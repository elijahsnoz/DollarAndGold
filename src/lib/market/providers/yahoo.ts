import type { Candle, Quote, Series, Timeframe } from "@/lib/market/types";
import { CACHE_TTL, cached } from "./cache";
import { fetchJson } from "./http";
import { YAHOO_SYMBOLS } from "./symbol-map";
import { normaliseCandles, type MarketDataSource } from "./types";

const BASE = "https://query1.finance.yahoo.com/v8/finance/chart";

const RANGES: Record<Timeframe, { range: string; interval: string }> = {
  "1D": { range: "1d", interval: "15m" },
  "1W": { range: "5d", interval: "1h" },
  "1M": { range: "1mo", interval: "1d" },
  "3M": { range: "3mo", interval: "1d" },
  "1Y": { range: "1y", interval: "1d" },
};

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * Yahoo Finance — broad keyless coverage, deliberately ranked last.
 *
 * It covers the whole catalog and needs no key, which makes it a useful
 * gap-filler, but it is an undocumented endpoint with no SLA and it throttles
 * hard: during development it started returning 429 after sixteen rapid
 * requests and stayed there for minutes. So it sits below the licensed and
 * purpose-built sources, leans on the cache, and is expected to fail sometimes.
 *
 * Opt out entirely with `DISABLE_YAHOO_FALLBACK=true`.
 */
export class YahooFinanceSource implements MarketDataSource {
  readonly id = "yahoo";
  readonly label = "Yahoo Finance";

  isAvailable(): boolean {
    return process.env.DISABLE_YAHOO_FALLBACK !== "true";
  }

  covers(symbol: string): boolean {
    return symbol.toUpperCase() in YAHOO_SYMBOLS;
  }

  private async chart(symbol: string, timeframe: Timeframe) {
    const upstream = YAHOO_SYMBOLS[symbol.toUpperCase()];
    const { range, interval } = RANGES[timeframe];

    return fetchJson<{
      chart: {
        result?: {
          meta: {
            regularMarketPrice?: number;
            chartPreviousClose?: number;
            previousClose?: number;
            regularMarketTime?: number;
          };
          timestamp?: number[];
          indicators: {
            quote: {
              open?: (number | null)[];
              high?: (number | null)[];
              low?: (number | null)[];
              close?: (number | null)[];
              volume?: (number | null)[];
            }[];
          };
        }[];
        error?: { description?: string } | null;
      };
    }>(
      this.id,
      `${BASE}/${encodeURIComponent(upstream)}?range=${range}&interval=${interval}`,
      { headers: { "User-Agent": UA }, timeoutMs: 8000 },
    );
  }

  async getQuote(symbol: string): Promise<Quote | null> {
    const key = symbol.toUpperCase();
    if (!this.covers(key)) return null;

    return cached(`yf:quote:${key}`, CACHE_TTL.quote, async () => {
      const payload = await this.chart(key, "1D");
      const result = payload.chart?.result?.[0];
      if (!result) return null;

      const price = result.meta.regularMarketPrice;
      if (!Number.isFinite(price) || !price) return null;

      const previous =
        result.meta.chartPreviousClose ?? result.meta.previousClose ?? price;
      const change = price - previous;

      const q = result.indicators.quote[0] ?? {};
      const highs = (q.high ?? []).filter((v): v is number => v != null);
      const lows = (q.low ?? []).filter((v): v is number => v != null);
      const volumes = (q.volume ?? []).filter((v): v is number => v != null);

      return {
        symbol: key,
        price,
        change,
        changePercent: previous === 0 ? 0 : (change / previous) * 100,
        high24h: highs.length ? Math.max(...highs, price) : price,
        low24h: lows.length ? Math.min(...lows, price) : price,
        volume: volumes.reduce((a, b) => a + b, 0),
        updatedAt: result.meta.regularMarketTime
          ? result.meta.regularMarketTime * 1000
          : Date.now(),
        source: this.id,
      } satisfies Quote;
    });
  }

  async getSeries(symbol: string, timeframe: Timeframe): Promise<Series | null> {
    const key = symbol.toUpperCase();
    if (!this.covers(key)) return null;

    const ttl =
      timeframe === "1D" || timeframe === "1W"
        ? CACHE_TTL.intradaySeries
        : CACHE_TTL.dailySeries;

    return cached(`yf:series:${key}:${timeframe}`, ttl, async () => {
      const payload = await this.chart(key, timeframe);
      const result = payload.chart?.result?.[0];
      const timestamps = result?.timestamp;
      const q = result?.indicators.quote[0];
      if (!result || !timestamps || !q?.close) return null;

      const candles: Candle[] = [];
      for (let i = 0; i < timestamps.length; i++) {
        const close = q.close[i];
        // Yahoo pads the arrays with nulls for non-trading slots.
        if (close == null) continue;
        candles.push({
          t: timestamps[i] * 1000,
          o: q.open?.[i] ?? close,
          h: q.high?.[i] ?? close,
          l: q.low?.[i] ?? close,
          c: close,
          v: q.volume?.[i] ?? 0,
        });
      }

      const normalised = normaliseCandles(candles);
      if (normalised.length < 10) return null;

      return { symbol: key, timeframe, candles: normalised, source: this.id };
    });
  }
}
