import { SourceError } from "./types";

/**
 * Fetch JSON from an upstream source with a hard timeout.
 *
 * `fetch` has no total-request timeout of its own, and a market page must not
 * hang because a free-tier API is having a bad day — a slow source has to lose
 * its slot quickly so the composite can fall through to the next one.
 */
export async function fetchJson<T>(
  sourceId: string,
  url: string,
  { timeoutMs = 6000, headers = {} }: { timeoutMs?: number; headers?: Record<string, string> } = {},
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json", ...headers },
      // Upstream freshness is governed by our own cache layer, not Next's.
      cache: "no-store",
    });

    if (!response.ok) {
      throw new SourceError(
        sourceId,
        `HTTP ${response.status} for ${url}`,
        response.status,
      );
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof SourceError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new SourceError(sourceId, `timed out after ${timeoutMs}ms`);
    }
    throw new SourceError(
      sourceId,
      error instanceof Error ? error.message : "unknown error",
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fold a stream of (timestamp, price) ticks into OHLC bars.
 *
 * Several free sources expose a dense price series but no candles at the
 * granularity we want — CoinGecko returns hourly ticks for a 90-day window,
 * while its own OHLC endpoint would hand back four-day bars, far too coarse to
 * compute a 50-period average against. Aggregating here gives real highs and
 * lows derived from real ticks, rather than a candle faked from closes.
 */
export function aggregateToCandles(
  points: { t: number; price: number; volume?: number }[],
  intervalMs: number,
): { t: number; o: number; h: number; l: number; c: number; v: number }[] {
  if (points.length === 0) return [];

  const buckets = new Map<
    number,
    { t: number; o: number; h: number; l: number; c: number; v: number }
  >();

  for (const point of points) {
    if (!Number.isFinite(point.price) || point.price <= 0) continue;

    const bucketStart = Math.floor(point.t / intervalMs) * intervalMs;
    const existing = buckets.get(bucketStart);

    if (!existing) {
      buckets.set(bucketStart, {
        t: bucketStart,
        o: point.price,
        h: point.price,
        l: point.price,
        c: point.price,
        v: point.volume ?? 0,
      });
      continue;
    }

    existing.h = Math.max(existing.h, point.price);
    existing.l = Math.min(existing.l, point.price);
    existing.c = point.price;
    // Sources report a rolling 24h figure rather than per-bar turnover, so the
    // most recent reading in the bucket is the honest one to keep.
    if (point.volume !== undefined) existing.v = point.volume;
  }

  return [...buckets.values()].sort((a, b) => a.t - b.t);
}
