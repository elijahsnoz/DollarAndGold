"use client";

import * as React from "react";
import Link from "next/link";

import { useLiveQuotes } from "@/lib/hooks/use-live-quotes";
import { formatPrice, formatSignedPercent } from "@/lib/format";
import type { MarketQuote } from "@/lib/market/snapshot";
import { cn } from "@/lib/utils";

/**
 * The scrolling strip under the hero.
 *
 * The track is duplicated so the marquee loops seamlessly at -50%; the copy is
 * hidden from assistive tech, and the animation is disabled entirely under
 * `prefers-reduced-motion` (handled globally in `globals.css`).
 */
export function TickerTape({ snapshots }: { snapshots: MarketQuote[] }) {
  const initialQuotes = React.useMemo(
    () => snapshots.map((s) => s.quote),
    [snapshots],
  );
  const quotes = useLiveQuotes(initialQuotes, { intervalMs: 8000 });

  const items = React.useMemo(
    () =>
      snapshots.map((snapshot, index) => ({
        asset: snapshot.asset,
        quote: quotes[index] ?? snapshot.quote,
      })),
    [snapshots, quotes],
  );

  return (
    <div className="mask-fade-x relative w-full overflow-hidden border-y border-border/60 py-3">
      <div className="animate-marquee flex w-max gap-8 pr-8">
        {[0, 1].map((copy) => (
          <div
            key={copy}
            className="flex gap-8"
            aria-hidden={copy === 1 ? "true" : undefined}
          >
            {items.map(({ asset, quote }) => (
              <Link
                key={`${copy}-${asset.symbol}`}
                href={`/analysis/${asset.symbol}`}
                className="flex shrink-0 items-baseline gap-2 text-sm transition-opacity hover:opacity-80"
              >
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  {asset.ticker}
                </span>
                <span className="tabular font-medium">
                  {formatPrice(quote.price, asset.precision)}
                </span>
                <span
                  className={cn(
                    "tabular text-xs font-medium",
                    quote.changePercent > 0 && "text-bull",
                    quote.changePercent < 0 && "text-bear",
                    quote.changePercent === 0 && "text-muted-foreground",
                  )}
                >
                  {formatSignedPercent(quote.changePercent)}
                </span>
              </Link>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
