"use client";

import * as React from "react";
import Link from "next/link";
import { Archive, BookOpen, Flag, LineChart, Quote, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getAsset } from "@/lib/market/catalog";
import { MEMORY_KIND_LABEL, type DatedMemory, type MemoryKind } from "@/lib/memory/types";
import { cn } from "@/lib/utils";

const KIND_ICON: Record<MemoryKind, typeof Quote> = {
  observation: Quote,
  trade: LineChart,
  research: Search,
  behaviour: BookOpen,
  milestone: Flag,
};

function describeAge(days: number): string {
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  if (days < 365) return `${Math.round(days / 30)} months ago`;
  const years = days / 365;
  return years < 1.5 ? "A year ago" : `${Math.round(years)} years ago`;
}

/**
 * The Market Memories archive.
 *
 * Reads as a record, not a feed. Research entries are filtered out of the
 * default view — they are the highest-volume and lowest-value memories, and
 * letting them dominate would bury the handful of things the user actually
 * wrote, which are the whole point of keeping an archive.
 */
export function MarketMemories({
  memories,
  resurfaced,
  limit = 6,
}: {
  memories: DatedMemory[];
  /** An older observation worth being reminded of. */
  resurfaced?: DatedMemory | null;
  limit?: number;
}) {
  const [showAll, setShowAll] = React.useState(false);

  // Weight 1 is research activity — context, never the headline.
  const meaningful = React.useMemo(
    () => memories.filter((m) => m.weight >= 2),
    [memories],
  );

  const visible = showAll ? meaningful : meaningful.slice(0, limit);

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center gap-2.5">
        <Archive className="h-4 w-4 text-gold" />
        <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
          Market memories
        </h2>
        {meaningful.length > 0 && (
          <Badge variant="outline" className="ml-auto">
            {meaningful.length} recorded
          </Badge>
        )}
      </div>

      {resurfaced && (
        <div className="mt-5 rounded-2xl border border-gold/25 bg-gold/[0.06] p-4">
          <p className="text-xs font-medium uppercase tracking-widest text-gold">
            {describeAge(resurfaced.ageDays)} you wrote
          </p>
          <p className="mt-2 text-sm leading-relaxed">
            &ldquo;{resurfaced.body}&rdquo;
          </p>
          {resurfaced.symbol && (
            <Link
              href={`/analysis/${resurfaced.symbol}`}
              className="mt-2.5 inline-block text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Revisit {getAsset(resurfaced.symbol)?.name ?? resurfaced.symbol}
            </Link>
          )}
        </div>
      )}

      {meaningful.length === 0 ? (
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Nothing archived yet. Your notes, trades and the patterns behind them
          collect here automatically — you never have to file anything. In a few
          months this becomes the part of the platform you can&apos;t get
          anywhere else.
        </p>
      ) : (
        <>
          <ol className="mt-5 space-y-0">
            {visible.map((memory, index) => {
              const Icon = KIND_ICON[memory.kind];
              const isLast = index === visible.length - 1;

              return (
                <li key={memory.id} className="relative flex gap-3.5 pb-5">
                  {/* Timeline spine — dropped on the final row so the list
                      ends cleanly rather than trailing into nothing. */}
                  {!isLast && (
                    <span
                      className="absolute left-[13px] top-7 h-full w-px bg-border"
                      aria-hidden="true"
                    />
                  )}

                  <span
                    className={cn(
                      "relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full border",
                      memory.kind === "observation"
                        ? "border-gold/30 bg-gold/10 text-gold"
                        : "border-border bg-background text-muted-foreground",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <p className="text-sm font-medium leading-snug">
                        {memory.title}
                      </p>
                      <span className="text-[11px] text-muted-foreground">
                        {describeAge(memory.ageDays)} ·{" "}
                        {MEMORY_KIND_LABEL[memory.kind]}
                      </span>
                    </div>
                    {memory.body && (
                      <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                        {memory.body}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>

          {meaningful.length > limit && (
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2"
              onClick={() => setShowAll((value) => !value)}
            >
              {showAll
                ? "Show less"
                : `Show all ${meaningful.length} memories`}
            </Button>
          )}
        </>
      )}
    </Card>
  );
}
