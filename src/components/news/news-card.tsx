"use client";

import * as React from "react";
import { ChevronDown, Clock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatRelativeTime } from "@/lib/format";
import { getAsset } from "@/lib/market/catalog";
import type { NewsArticle } from "@/lib/news/types";
import { cn } from "@/lib/utils";

const IMPACT_VARIANT = {
  bullish: "bull",
  bearish: "bear",
  mixed: "neutral",
} as const;

/**
 * A story with its AI read attached.
 *
 * The 30-second summary is always visible because it is the point of the feed;
 * "why it matters" and the market-impact call expand on demand so a long feed
 * stays scannable.
 */
export function NewsCard({
  article,
  defaultOpen = false,
  compact = false,
}: {
  article: NewsArticle;
  defaultOpen?: boolean;
  compact?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const detailId = React.useId();

  // Rendered on the client so relative times don't mismatch the server clock.
  const [relative, setRelative] = React.useState<string | null>(null);
  React.useEffect(() => {
    setRelative(formatRelativeTime(article.publishedAt));
  }, [article.publishedAt]);

  return (
    <Card id={article.id} className={cn("p-5", compact && "p-4")}>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground/70">{article.source}</span>
        <span aria-hidden="true">·</span>
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <time dateTime={new Date(article.publishedAt).toISOString()}>
            {relative ?? "recently"}
          </time>
        </span>
        <Badge
          variant={IMPACT_VARIANT[article.impact.direction]}
          className="ml-auto capitalize"
        >
          {article.impact.direction} · {article.impact.magnitude} impact
        </Badge>
      </div>

      <h3
        className={cn(
          "mt-3 font-semibold leading-snug tracking-tight",
          compact ? "text-sm" : "text-base sm:text-lg",
        )}
      >
        {article.headline}
      </h3>

      <div className="mt-3">
        <p className="text-xs font-medium uppercase tracking-widest text-gold">
          30-second summary
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {article.summary}
        </p>
      </div>

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={detailId}
        className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        {open ? "Show less" : "Why it matters & likely impact"}
        <ChevronDown
          className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div id={detailId} className="animate-fade-up mt-4 space-y-4 border-t border-border/60 pt-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Why it matters
            </p>
            <p className="mt-1.5 text-sm leading-relaxed">{article.whyItMatters}</p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Possible market impact
            </p>
            <p className="mt-1.5 text-sm leading-relaxed">{article.impact.note}</p>
          </div>

          {article.symbols.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {article.symbols.slice(0, 6).map((symbol) => {
                const asset = getAsset(symbol);
                if (!asset) return null;
                return (
                  <Badge key={symbol} variant="outline">
                    {asset.ticker}
                  </Badge>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
