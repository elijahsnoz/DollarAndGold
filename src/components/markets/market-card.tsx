"use client";

import Link from "next/link";
import { Sparkles, Star } from "lucide-react";

import { Sparkline } from "@/components/charts/sparkline";
import { ChangePill } from "@/components/common/change-pill";
import { DataSourceBadge } from "@/components/common/data-source-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatCompact, formatPrice } from "@/lib/format";
import { ASSET_CLASS_LABEL } from "@/lib/market/catalog";
import { isLiveSource } from "@/lib/market/provenance";
import type { Asset, Quote } from "@/lib/market/types";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace/store";

/**
 * One market on the grid: price, 24h change, trend shape, and the way in to
 * the analysis. The whole card is a link; the watch toggle sits above it.
 */
export function MarketCard({
  asset,
  quote,
  spark,
}: {
  asset: Asset;
  quote: Quote;
  spark: number[];
}) {
  const { isWatched, toggleWatch } = useWorkspace();
  const watched = isWatched(asset.symbol);

  return (
    <Card interactive className="group relative overflow-hidden p-5">
      <Link
        href={`/analysis/${asset.symbol}`}
        className="absolute inset-0 z-0"
        aria-label={`Open market intelligence for ${asset.name}`}
      />

      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold leading-tight">
            {asset.name}
          </p>
          <p className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            {asset.ticker} · {ASSET_CLASS_LABEL[asset.assetClass]}
          </p>
        </div>

        {/* Only flagged when it is NOT live — the risk is mistaking a
            simulated price for a real one, never the reverse. */}
        {!isLiveSource(quote.source) && (
          <DataSourceBadge source={quote.source} size="sm" className="mt-0.5" />
        )}

        <button
          type="button"
          onClick={() => toggleWatch(asset.symbol)}
          aria-label={
            watched
              ? `Remove ${asset.name} from watchlist`
              : `Add ${asset.name} to watchlist`
          }
          aria-pressed={watched}
          className="relative z-20 -mr-1 -mt-1 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-gold"
        >
          <Star className={cn("h-4 w-4", watched && "fill-gold text-gold")} />
        </button>
      </div>

      <div className="relative z-10 mt-4 flex items-end justify-between gap-3">
        <p className="tabular text-2xl font-semibold leading-none tracking-tight">
          {formatPrice(quote.price, asset.precision)}
        </p>
        <ChangePill value={quote.changePercent} size="sm" />
      </div>

      <Sparkline
        data={spark}
        change={quote.change}
        height={48}
        className="relative z-10 mt-4"
      />

      <div className="relative z-10 mt-4 flex items-center justify-between border-t border-border/60 pt-3">
        <dl className="flex gap-4 text-[11px] text-muted-foreground">
          <div>
            <dt className="sr-only">24 hour high</dt>
            <dd className="tabular">
              H {formatPrice(quote.high24h, asset.precision)}
            </dd>
          </div>
          <div>
            <dt className="sr-only">24 hour low</dt>
            <dd className="tabular">
              L {formatPrice(quote.low24h, asset.precision)}
            </dd>
          </div>
          {/* Some sources publish rates but not turnover — the ECB is one.
              Omitting the stat is honest; "Vol 0" reads as a broken feed. */}
          {quote.volume > 0 && (
            <div className="hidden sm:block">
              <dt className="sr-only">24 hour volume</dt>
              <dd className="tabular">Vol {formatCompact(quote.volume)}</dd>
            </div>
          )}
        </dl>

        <Button
          asChild
          size="sm"
          variant="ghost"
          className="relative z-20 -mr-2 h-7 px-2.5 text-[12px] text-muted-foreground group-hover:text-gold"
        >
          <Link href={`/analysis/${asset.symbol}`}>
            <Sparkles className="h-3.5 w-3.5" />
            Intelligence
          </Link>
        </Button>
      </div>
    </Card>
  );
}
