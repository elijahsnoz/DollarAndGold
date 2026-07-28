"use client";

import type { MarketConditions } from "./types";

/**
 * Client-side context capture, with a hard deadline.
 *
 * The deadline is the point. Recording market context must never stand between
 * someone and saving their own trade or note — if the snapshot is slow or the
 * endpoint is down, the save proceeds without it. A missing snapshot is a
 * visible gap the learning layer can account for; a lost journal entry is not
 * recoverable, and is exactly the kind of friction that stops people writing
 * things down at all.
 */
export async function fetchConditions(
  symbol: string,
  { timeoutMs = 3000 }: { timeoutMs?: number } = {},
): Promise<MarketConditions | undefined> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`/api/context/${symbol}`, {
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) return undefined;

    const data = (await response.json()) as {
      conditions: MarketConditions | null;
    };
    return data.conditions ?? undefined;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}
