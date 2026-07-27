import type { Candle, Quote, Series, Timeframe } from "@/lib/market/types";
import { CACHE_TTL, cached } from "./cache";
import { fetchJson } from "./http";
import { TWELVE_DATA_SYMBOLS } from "./symbol-map";
import { SourceError, normaliseCandles, type MarketDataSource } from "./types";

const BASE = "https://api.twelvedata.com";

/** Timeframe → Twelve Data interval and bar count. */
const INTERVALS: Record<Timeframe, { interval: string; outputsize: number }> = {
  "1D": { interval: "15min", outputsize: 96 },
  "1W": { interval: "1h", outputsize: 168 },
  "1M": { interval: "1day", outputsize: 30 },
  "3M": { interval: "1day", outputsize: 90 },
  "1Y": { interval: "1day", outputsize: 365 },
};

interface TwelveDataError {
  status?: string;
  code?: number;
  message?: string;
}

/**
 * Twelve Data — the one source that covers the entire catalog: spot metals,
 * FX, crypto, indices and equities.
 *
 * Requires `TWELVE_DATA_API_KEY`. The free tier allows 800 requests/day and 8
 * per minute, which the cache layer above is sized around. This is the
 * recommended production source precisely because it is a single, licensed,
 * documented feed rather than several scraped ones.
 */
export class TwelveDataSource implements MarketDataSource {
  readonly id = "twelvedata";
  readonly label = "Twelve Data";

  isAvailable(): boolean {
    return Boolean(process.env.TWELVE_DATA_API_KEY);
  }

  covers(symbol: string): boolean {
    return symbol.toUpperCase() in TWELVE_DATA_SYMBOLS;
  }

  private key(): string {
    const key = process.env.TWELVE_DATA_API_KEY;
    if (!key) throw new SourceError(this.id, "TWELVE_DATA_API_KEY is not set");
    return key;
  }

  /** Twelve Data reports its own errors inside a 200 response. */
  private assertOk(payload: TwelveDataError) {
    if (payload?.status === "error") {
      throw new SourceError(
        this.id,
        payload.message ?? "upstream error",
        payload.code,
      );
    }
  }

  async getQuote(symbol: string): Promise<Quote | null> {
    const key = symbol.toUpperCase();
    const upstream = TWELVE_DATA_SYMBOLS[key];
    if (!upstream) return null;

    return cached(`td:quote:${key}`, CACHE_TTL.quote, async () => {
      const data = await fetchJson<
        TwelveDataError & {
          close?: string;
          previous_close?: string;
          high?: string;
          low?: string;
          volume?: string;
          change?: string;
          percent_change?: string;
          timestamp?: number;
        }
      >(
        this.id,
        `${BASE}/quote?symbol=${encodeURIComponent(upstream)}&apikey=${this.key()}`,
      );

      this.assertOk(data);

      const price = Number(data.close);
      if (!Number.isFinite(price) || price <= 0) return null;

      const previous = Number(data.previous_close);
      const change = Number(data.change);
      const changePercent = Number(data.percent_change);

      return {
        symbol: key,
        price,
        change: Number.isFinite(change) ? change : price - previous,
        changePercent: Number.isFinite(changePercent) ? changePercent : 0,
        high24h: Number.isFinite(Number(data.high)) ? Number(data.high) : price,
        low24h: Number.isFinite(Number(data.low)) ? Number(data.low) : price,
        volume: Number.isFinite(Number(data.volume)) ? Number(data.volume) : 0,
        updatedAt: data.timestamp ? data.timestamp * 1000 : Date.now(),
        source: this.id,
      } satisfies Quote;
    });
  }

  async getSeries(symbol: string, timeframe: Timeframe): Promise<Series | null> {
    const key = symbol.toUpperCase();
    const upstream = TWELVE_DATA_SYMBOLS[key];
    if (!upstream) return null;

    const { interval, outputsize } = INTERVALS[timeframe];
    const ttl =
      timeframe === "1D" || timeframe === "1W"
        ? CACHE_TTL.intradaySeries
        : CACHE_TTL.dailySeries;

    return cached(`td:series:${key}:${timeframe}`, ttl, async () => {
      const data = await fetchJson<
        TwelveDataError & {
          values?: {
            datetime: string;
            open: string;
            high: string;
            low: string;
            close: string;
            volume?: string;
          }[];
        }
      >(
        this.id,
        `${BASE}/time_series?symbol=${encodeURIComponent(upstream)}&interval=${interval}&outputsize=${outputsize}&apikey=${this.key()}`,
        { timeoutMs: 9000 },
      );

      this.assertOk(data);
      if (!Array.isArray(data.values) || data.values.length === 0) return null;

      // Twelve Data returns newest-first; `normaliseCandles` sorts ascending.
      const candles: Candle[] = data.values.map((row) => ({
        t: Date.parse(
          row.datetime.includes(" ")
            ? `${row.datetime.replace(" ", "T")}Z`
            : `${row.datetime}T00:00:00Z`,
        ),
        o: Number(row.open),
        h: Number(row.high),
        l: Number(row.low),
        c: Number(row.close),
        v: Number(row.volume ?? 0),
      }));

      const normalised = normaliseCandles(candles);
      if (normalised.length < 10) return null;

      return { symbol: key, timeframe, candles: normalised, source: this.id };
    });
  }
}
