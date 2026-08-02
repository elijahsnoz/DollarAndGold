"use client";

import * as React from "react";
import Link from "next/link";

import { MarketTimeline } from "@/components/analysis/market-timeline";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  composeTodayUpdate,
  composeWeeklyReview,
  type CadenceEvent,
} from "@/lib/briefing/cadence";
import { useWorkspace } from "@/lib/workspace/store";

type Cadence = "today" | "week";

/**
 * Watchlist Intelligence: the desk read at two cadences instead of a static
 * list. See `lib/briefing/cadence.ts` for why this is two surfaces rather
 * than the four originally proposed (Morning/Afternoon/EOD/Weekly) — Morning
 * already exists as the dashboard's daily briefing, and Afternoon/EOD would
 * show identical data with no real "market close" to distinguish them.
 */
export function WatchlistIntelligence({ symbols }: { symbols: string[] }) {
  const { profile } = useWorkspace();
  const [cadence, setCadence] = React.useState<Cadence>("today");
  const [eventsBySymbol, setEventsBySymbol] = React.useState<Record<string, CadenceEvent[]>>({});
  const [loading, setLoading] = React.useState(false);

  const symbolsKey = symbols.join(",");

  React.useEffect(() => {
    if (!symbolsKey) {
      setEventsBySymbol({});
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch("/api/desk/timeline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbols: symbolsKey.split(","), window: cadence }),
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled) setEventsBySymbol(data?.eventsBySymbol ?? {});
      })
      .catch(() => {
        if (!cancelled) setEventsBySymbol({});
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [symbolsKey, cadence]);

  if (symbols.length === 0) return null;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold tracking-tight">
          {cadence === "today" ? "Today" : "This week"}
        </h2>
        <Tabs value={cadence} onValueChange={(value) => setCadence(value as Cadence)}>
          <TabsList>
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="week">This week</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="mt-4">
        {loading ? (
          <Skeleton className="h-32 w-full rounded-[var(--radius)]" />
        ) : cadence === "today" ? (
          <MarketTimeline
            events={composeTodayUpdate({ eventsBySymbol }).events}
            emptyMessage="Nothing on your watchlist has moved enough today to be worth a look."
          />
        ) : (
          <MarketTimeline
            events={composeWeeklyReview({ eventsBySymbol, insights: profile.insights }).events}
            emptyMessage="Nothing on your watchlist cleared the bar for a notable move this week."
          />
        )}
      </div>

      {cadence === "week" && !loading && profile.insights.length > 0 && (
        <p className="mt-4 text-xs text-muted-foreground">
          {profile.insights.length} behavioural{" "}
          {profile.insights.length === 1 ? "pattern" : "patterns"} from your
          trading history{" "}
          {profile.insights.length === 1 ? "is" : "are"} also live in{" "}
          <Link
            href="/dashboard"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Learning Intelligence
          </Link>
          .
        </p>
      )}
    </div>
  );
}
