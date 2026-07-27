/**
 * In-memory TTL cache with in-flight de-duplication.
 *
 * Both halves matter and they solve different problems:
 *
 *  - **TTL** keeps us inside free-tier rate limits. Nine market cards do not
 *    need nine upstream calls per poll.
 *  - **In-flight de-duplication** handles the burst that TTL cannot: on a cold
 *    cache, nine concurrent renders all miss simultaneously and would each
 *    launch their own request. Sharing the pending promise collapses them into
 *    one. During development Yahoo rate-limited this project after sixteen
 *    rapid requests, so this is a measured constraint, not a theoretical one.
 *
 * Deliberately process-local. A serverless deployment gets one cache per warm
 * instance, which is the right trade for an MVP; swap in Redis here if a fleet
 * ever needs to share it.
 */

interface Entry<T> {
  value: T;
  expiresAt: number;
}

const entries = new Map<string, Entry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

/** Cap the map so a long-lived process can't grow it without bound. */
const MAX_ENTRIES = 500;

function evictIfNeeded() {
  if (entries.size <= MAX_ENTRIES) return;
  const now = Date.now();
  for (const [key, entry] of entries) {
    if (entry.expiresAt <= now) entries.delete(key);
  }
  // Still oversized after dropping expired entries: drop oldest-inserted.
  while (entries.size > MAX_ENTRIES) {
    const oldest = entries.keys().next();
    if (oldest.done) break;
    entries.delete(oldest.value);
  }
}

/**
 * Return the cached value for `key`, or produce it with `fetcher`.
 *
 * A rejected fetch is never cached — the next caller retries. That is what
 * lets a transient rate limit resolve itself instead of being pinned for the
 * whole TTL.
 */
export async function cached<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const now = Date.now();

  const hit = entries.get(key);
  if (hit && hit.expiresAt > now) return hit.value as T;

  const pending = inFlight.get(key);
  if (pending) return pending as Promise<T>;

  const promise = fetcher()
    .then((value) => {
      entries.set(key, { value, expiresAt: Date.now() + ttlMs });
      evictIfNeeded();
      return value;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, promise);
  return promise;
}

/** Read a still-valid entry without triggering a fetch. */
export function peek<T>(key: string): T | undefined {
  const hit = entries.get(key);
  return hit && hit.expiresAt > Date.now() ? (hit.value as T) : undefined;
}

export function clearCache() {
  entries.clear();
  inFlight.clear();
}

export const CACHE_TTL = {
  /** Quotes: fresh enough to feel live, slow enough to stay inside quotas. */
  quote: 30_000,
  /** Intraday bars only change when a bar closes. */
  intradaySeries: 5 * 60_000,
  /** Daily bars change once a day; an hour is plenty. */
  dailySeries: 60 * 60_000,
  /** How long a failing source stays benched. */
  sourceCooldown: 2 * 60_000,
} as const;
