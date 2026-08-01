import { SimulatedProvider } from "@/lib/market/simulated-provider";
import type {
  MarketDataProvider,
  Quote,
  Series,
  Timeframe,
} from "@/lib/market/types";
import { CACHE_TTL } from "./cache";
import { CoinGeckoSource } from "./coingecko";
import { FrankfurterSource } from "./frankfurter";
import { TwelveDataSource } from "./twelve-data";
import { YahooFinanceSource } from "./yahoo";
import type { MarketDataSource } from "./types";

/**
 * Routes each symbol through the available sources in priority order and
 * guarantees a result.
 *
 * The ordering is deliberate: a licensed feed that covers everything first,
 * then purpose-built keyless sources for the classes they genuinely own, then
 * a broad best-effort scraper, then the simulation. A source that throws is
 * benched for a cooldown rather than retried on every request — without that,
 * one rate-limited upstream turns every page load into a slow cascade of
 * doomed calls.
 *
 * The simulation is not a bug to be removed. It is what makes the product
 * explorable with zero configuration and what keeps a market page useful when
 * an upstream is down. What matters is that the UI never claims a simulated
 * figure is a real one, which is why every quote and series carries `source`.
 */
export class CompositeProvider implements MarketDataProvider {
  readonly id = "composite";

  private readonly sources: MarketDataSource[];
  private readonly fallback = new SimulatedProvider();
  /** sourceId → timestamp until which it stays benched. */
  private readonly benchedUntil = new Map<string, number>();

  constructor(sources?: MarketDataSource[]) {
    this.sources = sources ?? [
      new TwelveDataSource(),
      new CoinGeckoSource(),
      new FrankfurterSource(),
      new YahooFinanceSource(),
    ];
  }

  /** Sources that are configured, cover this symbol, and aren't benched. */
  private eligible(symbol: string): MarketDataSource[] {
    const now = Date.now();
    return this.sources.filter((source) => {
      if (!source.isAvailable() || !source.covers(symbol)) return false;
      const until = this.benchedUntil.get(source.id) ?? 0;
      return until <= now;
    });
  }

  private bench(source: MarketDataSource, error: unknown) {
    this.benchedUntil.set(source.id, Date.now() + CACHE_TTL.sourceCooldown);
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[market] ${source.id} benched for ${CACHE_TTL.sourceCooldown / 1000}s:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  async getQuote(symbol: string): Promise<Quote> {
    for (const source of this.eligible(symbol)) {
      try {
        const quote = await source.getQuote(symbol);
        if (quote) return quote;
      } catch (error) {
        this.bench(source, error);
      }
    }

    const simulated = await this.fallback.getQuote(symbol);
    return { ...simulated, source: "simulated" };
  }

  /**
   * Groups symbols by each one's top eligible source and batches through
   * `source.getQuotes` where the source supports it, rather than firing one
   * concurrent `getQuote` per symbol regardless of how many were asked for.
   * Anything a source doesn't support batching for — or doesn't return —
   * falls back to the normal per-symbol chain, so correctness is unchanged
   * for every source that doesn't opt in.
   */
  async getQuotes(symbols: string[]): Promise<Quote[]> {
    const resolved = new Map<string, Quote>();
    const remaining: string[] = [];

    const groups = new Map<MarketDataSource, string[]>();
    for (const symbol of symbols) {
      const [top] = this.eligible(symbol);
      if (top?.getQuotes) {
        const group = groups.get(top) ?? [];
        group.push(symbol);
        groups.set(top, group);
      } else {
        remaining.push(symbol);
      }
    }

    await Promise.all(
      [...groups].map(async ([source, batchSymbols]) => {
        try {
          const batch = await source.getQuotes!(batchSymbols);
          for (const symbol of batchSymbols) {
            const hit = batch.get(symbol.toUpperCase());
            if (hit) resolved.set(symbol, hit);
            else remaining.push(symbol);
          }
        } catch (error) {
          this.bench(source, error);
          remaining.push(...batchSymbols);
        }
      }),
    );

    const singles = await Promise.all(
      remaining.map((symbol) => this.getQuote(symbol)),
    );
    remaining.forEach((symbol, i) => resolved.set(symbol, singles[i]));

    return symbols.map((symbol) => resolved.get(symbol)!);
  }

  async getSeries(symbol: string, timeframe: Timeframe): Promise<Series> {
    for (const source of this.eligible(symbol)) {
      try {
        const series = await source.getSeries(symbol, timeframe);
        // A source may cover a symbol but not a timeframe — ECB daily fixings
        // have nothing to say about a 1D chart. Null means "try the next one".
        if (series && series.candles.length > 0) return series;
      } catch (error) {
        this.bench(source, error);
      }
    }

    const simulated = await this.fallback.getSeries(symbol, timeframe);
    return this.anchorToLivePrice(simulated);
  }

  /**
   * Rescale a simulated series so it ends at the live price.
   *
   * Without this, an asset whose quote is live but whose chart fell back to the
   * simulation contradicts itself: ECB publishes one EUR/USD fixing a day, so
   * the 3M chart is real while the 1D chart is simulated, and the two showed
   * 1.1389 and 1.0839 for the same pair minutes apart. Mixing real and
   * simulated figures for one asset is worse than either alone.
   *
   * Scaling preserves the simulation's shape while putting it on the correct
   * axis, so the fallback is at least coherent with everything else on screen.
   * It is still simulated, and still labelled as such — this fixes the
   * contradiction, not the underlying gap.
   */
  private async anchorToLivePrice(series: Series): Promise<Series> {
    const lastClose = series.candles.at(-1)?.c;
    if (!lastClose || lastClose <= 0) {
      return { ...series, source: "simulated" };
    }

    let livePrice: number | undefined;
    try {
      const quote = await this.getQuote(series.symbol);
      if (quote.source && quote.source !== "simulated") livePrice = quote.price;
    } catch {
      // No live quote to anchor to — the unscaled simulation stands.
    }

    if (!livePrice || livePrice <= 0) {
      return { ...series, source: "simulated" };
    }

    const scale = livePrice / lastClose;
    return {
      ...series,
      source: "simulated-anchored",
      candles: series.candles.map((candle) => ({
        ...candle,
        o: candle.o * scale,
        h: candle.h * scale,
        l: candle.l * scale,
        c: candle.c * scale,
      })),
    };
  }

  /** Which sources are wired up right now. Drives the provenance UI. */
  describeSources(): { id: string; label: string; available: boolean }[] {
    return this.sources.map((source) => ({
      id: source.id,
      label: source.label,
      available: source.isAvailable(),
    }));
  }
}
