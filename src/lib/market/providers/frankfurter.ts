import { DAY, TIMEFRAMES } from "@/lib/market/simulation";
import type { Candle, Quote, Series, Timeframe } from "@/lib/market/types";
import { CACHE_TTL, cached } from "./cache";
import { fetchJson } from "./http";
import { FRANKFURTER_PAIRS } from "./symbol-map";
import { normaliseCandles, quoteFromCandles, type MarketDataSource } from "./types";

const BASE = "https://api.frankfurter.dev/v1";

/**
 * Frankfurter — ECB reference rates for major FX pairs, no API key.
 *
 * The trade-off is granularity: the ECB publishes once per business day, so
 * this source is authoritative for daily timeframes and has nothing useful to
 * say about intraday. It declines `1D` and `1W` rather than fabricating bars,
 * and the composite routes those elsewhere.
 *
 * ECB rates are close-only, so each bar's open is the previous close and the
 * high/low bound the two. That is stated in the UI rather than dressed up as a
 * real session range.
 */
export class FrankfurterSource implements MarketDataSource {
  readonly id = "frankfurter";
  readonly label = "ECB via Frankfurter";

  isAvailable(): boolean {
    return true; // Keyless.
  }

  covers(symbol: string): boolean {
    return symbol.toUpperCase() in FRANKFURTER_PAIRS;
  }

  /** Daily-close data cannot honestly answer an intraday question. */
  private supportsTimeframe(timeframe: Timeframe): boolean {
    return timeframe === "1M" || timeframe === "3M" || timeframe === "1Y";
  }

  async getQuote(symbol: string): Promise<Quote | null> {
    const series = await this.getSeries(symbol, "1M");
    if (!series) return null;
    return quoteFromCandles(symbol.toUpperCase(), series.candles, this.id);
  }

  async getSeries(symbol: string, timeframe: Timeframe): Promise<Series | null> {
    const key = symbol.toUpperCase();
    const pair = FRANKFURTER_PAIRS[key];
    if (!pair || !this.supportsTimeframe(timeframe)) return null;

    const spec = TIMEFRAMES[timeframe];

    return cached(
      `fx:series:${key}:${timeframe}`,
      CACHE_TTL.dailySeries,
      async () => {
        // Over-fetch: weekends and holidays have no ECB fixing, so calendar
        // days are always more than trading days.
        const lookbackDays = Math.ceil(spec.bars * 1.6) + 10;
        const from = new Date(Date.now() - lookbackDays * DAY)
          .toISOString()
          .slice(0, 10);

        const data = await fetchJson<{
          rates: Record<string, Record<string, number>>;
        }>(
          this.id,
          `${BASE}/${from}..?base=${pair.base}&symbols=${pair.quote}`,
          { timeoutMs: 8000 },
        );

        const rows = Object.entries(data.rates ?? {})
          .map(([date, rates]) => ({
            t: Date.parse(`${date}T00:00:00Z`),
            rate: rates[pair.quote],
          }))
          .filter((row) => Number.isFinite(row.t) && Number.isFinite(row.rate))
          .sort((a, b) => a.t - b.t);

        if (rows.length < 10) return null;

        const candles: Candle[] = rows.map((row, index) => {
          const open = index > 0 ? rows[index - 1].rate : row.rate;
          return {
            t: row.t,
            o: open,
            h: Math.max(open, row.rate),
            l: Math.min(open, row.rate),
            c: row.rate,
            // The ECB publishes rates, not turnover. Zero is the honest value;
            // the volume indicator reads it as "no participation data".
            v: 0,
          };
        });

        return {
          symbol: key,
          timeframe,
          candles: normaliseCandles(candles).slice(-spec.bars),
          source: this.id,
        };
      },
    );
  }
}
