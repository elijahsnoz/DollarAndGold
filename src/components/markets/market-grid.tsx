"use client";

import * as React from "react";

import { MarketCard } from "@/components/markets/market-card";
import { useLiveQuotes } from "@/lib/hooks/use-live-quotes";
import type { MarketSnapshot } from "@/lib/market/snapshot";

/**
 * The Markets grid. Server-rendered snapshots hydrate straight into live
 * quotes, so there is no loading state on first paint.
 */
export function MarketGrid({ snapshots }: { snapshots: MarketSnapshot[] }) {
  const initialQuotes = React.useMemo(
    () => snapshots.map((s) => s.quote),
    [snapshots],
  );
  const quotes = useLiveQuotes(initialQuotes);

  const bySymbol = React.useMemo(
    () => new Map(quotes.map((q) => [q.symbol, q])),
    [quotes],
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {snapshots.map((snapshot) => (
        <MarketCard
          key={snapshot.asset.symbol}
          asset={snapshot.asset}
          quote={bySymbol.get(snapshot.asset.symbol) ?? snapshot.quote}
          spark={snapshot.spark}
        />
      ))}
    </div>
  );
}
