"use client";

import * as React from "react";

import type { Quote } from "@/lib/market/types";

/**
 * Keep quotes ticking after hydration.
 *
 * Seeded with the server-rendered quotes so the first client render is
 * byte-identical to the server's — the poll only ever replaces them. Polling
 * pauses while the tab is hidden, which is the difference between a page that
 * idles quietly in a background tab and one that hammers the API all day.
 */
export function useLiveQuotes(
  initial: Quote[],
  { intervalMs = 5000 }: { intervalMs?: number } = {},
): Quote[] {
  const [quotes, setQuotes] = React.useState(initial);

  const symbols = React.useMemo(
    () => initial.map((q) => q.symbol).join(","),
    [initial],
  );

  React.useEffect(() => {
    if (!symbols) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      if (document.visibilityState === "visible") {
        try {
          const response = await fetch(`/api/markets?symbols=${symbols}`, {
            cache: "no-store",
          });
          if (response.ok) {
            const data = (await response.json()) as { quotes: Quote[] };
            if (!cancelled) setQuotes(data.quotes);
          }
        } catch {
          // Transient failure — keep the last good quotes and try again.
        }
      }
      if (!cancelled) timer = setTimeout(poll, intervalMs);
    };

    timer = setTimeout(poll, intervalMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [symbols, intervalMs]);

  return quotes;
}
