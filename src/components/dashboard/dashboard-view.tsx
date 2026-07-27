"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Bell, Sparkles, Star, Sunrise } from "lucide-react";

import { PerformanceInsights } from "@/components/dashboard/insights";
import { MarketMemories } from "@/components/intelligence/market-memories";
import { UnderstandingPanel } from "@/components/intelligence/understanding-panel";
import { TradingJournal } from "@/components/dashboard/journal";
import { PersonalNotes } from "@/components/dashboard/notes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { DailyBriefing } from "@/lib/ai/briefing";
import { formatRelativeTime, formatSignedPercent } from "@/lib/format";
import { getAsset } from "@/lib/market/catalog";
import { resurface } from "@/lib/memory/derive";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace/store";

/**
 * The signed-in workspace.
 *
 * The briefing is server-rendered (it is the same for everyone); everything
 * else comes from the workspace store, which is why this is a client component.
 */
export function DashboardView({ briefing }: { briefing: DailyBriefing }) {
  const { state, ready, demoMode, user, profile, memories } = useWorkspace();

  const alerts = React.useMemo(
    () =>
      state.watchlist.filter(
        (item) => item.alertAbove !== undefined || item.alertBelow !== undefined,
      ),
    [state.watchlist],
  );

  // An older observation worth being reminded of, if there is one.
  const resurfaced = React.useMemo(() => resurface(state), [state]);

  return (
    <div className="space-y-6">
      {demoMode && !user && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gold/25 bg-gold/[0.07] px-4 py-3 text-sm">
          <Badge variant="gold">Demo mode</Badge>
          <p className="text-muted-foreground">
            Supabase isn&apos;t configured, so your workspace is saved in this
            browser. Add credentials to sync it to an account.
          </p>
        </div>
      )}

      {/* --- Daily briefing --- */}
      <Card className="p-6">
        <div className="flex items-center gap-2.5">
          <Sunrise className="h-4 w-4 text-gold" />
          <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            Daily AI briefing
          </h2>
          <span className="ml-auto text-xs text-muted-foreground">
            {formatRelativeTime(briefing.generatedAt)}
          </span>
        </div>

        <p className="mt-4 text-lg font-semibold tracking-tight">
          {briefing.headline}
        </p>

        <div className="mt-3 space-y-3">
          {briefing.paragraphs.map((paragraph, index) => (
            <p
              key={index}
              className="text-sm leading-relaxed text-muted-foreground"
            >
              {paragraph}
            </p>
          ))}
        </div>

        <div className="mt-6 grid gap-4 border-t border-border/60 pt-5 sm:grid-cols-2">
          <MoverList title="Leading" movers={briefing.gainers} tone="bull" />
          <MoverList title="Lagging" movers={briefing.losers} tone="bear" />
        </div>
      </Card>

      {/* --- Personalisation + archive ---
          Placed directly under the briefing: these are what make the platform
          worth more this month than last, and burying them under the market
          widgets would say the opposite. */}
      <UnderstandingPanel profile={profile} />

      <MarketMemories memories={memories} resurfaced={resurfaced} />

      {/* --- Recent analyses + saved markets --- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-6">
          <div className="flex items-center gap-2.5">
            <Sparkles className="h-4 w-4 text-gold" />
            <h2 className="text-base font-semibold tracking-tight">
              Recent analyses
            </h2>
          </div>

          {!ready ? (
            <Skeleton className="mt-5 h-24 w-full" />
          ) : state.recentAnalyses.length === 0 ? (
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Nothing yet. Every market you analyse shows up here so you can pick
              up where you left off.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {state.recentAnalyses.slice(0, 6).map((analysis) => (
                <li key={analysis.symbol}>
                  <Link
                    href={`/analysis/${analysis.symbol}`}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-foreground/[0.04]"
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full",
                        analysis.trend === "bullish" && "bg-bull",
                        analysis.trend === "bearish" && "bg-bear",
                        analysis.trend === "neutral" && "bg-muted-foreground",
                      )}
                    />
                    <span className="text-sm font-medium">
                      {analysis.assetName}
                    </span>
                    <span className="text-xs capitalize text-muted-foreground">
                      {analysis.trend}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {analysis.confidence}/100
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2.5">
            <Star className="h-4 w-4 text-gold" />
            <h2 className="text-base font-semibold tracking-tight">
              Saved markets
            </h2>
            <Button asChild variant="ghost" size="sm" className="ml-auto -mr-2">
              <Link href="/watchlist">
                Open
                <ArrowRight />
              </Link>
            </Button>
          </div>

          {!ready ? (
            <Skeleton className="mt-5 h-24 w-full" />
          ) : state.watchlist.length === 0 ? (
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Star a market anywhere in the app and it lands here.
            </p>
          ) : (
            <ul className="mt-4 flex flex-wrap gap-2">
              {state.watchlist.map((item) => {
                const asset = getAsset(item.symbol);
                if (!asset) return null;
                return (
                  <li key={item.symbol}>
                    <Link href={`/analysis/${item.symbol}`}>
                      <Badge
                        variant={item.pinned ? "gold" : "outline"}
                        className="hover:border-foreground/25"
                      >
                        {asset.ticker}
                      </Badge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* --- Alert centre --- */}
      <Card className="p-6">
        <div className="flex items-center gap-2.5">
          <Bell className="h-4 w-4 text-gold" />
          <h2 className="text-base font-semibold tracking-tight">Alert centre</h2>
          <Badge variant="outline" className="ml-auto">
            {alerts.length} active
          </Badge>
        </div>

        {alerts.length === 0 ? (
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            No alerts set. Add one from the watchlist on any level you would
            actually act on — not every round number.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {alerts.map((item) => {
              const asset = getAsset(item.symbol);
              if (!asset) return null;
              return (
                <li
                  key={item.symbol}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 px-3 py-2.5 text-sm"
                >
                  <span className="font-medium">{asset.name}</span>
                  <span className="tabular text-xs text-muted-foreground">
                    {item.alertAbove !== undefined && `Above ${item.alertAbove}`}
                    {item.alertAbove !== undefined &&
                      item.alertBelow !== undefined &&
                      " · "}
                    {item.alertBelow !== undefined && `Below ${item.alertBelow}`}
                  </span>
                  <Button asChild variant="ghost" size="sm" className="ml-auto">
                    <Link href="/watchlist">Manage</Link>
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <PerformanceInsights />

      <div className="grid gap-4 lg:grid-cols-2">
        <TradingJournal />
        <PersonalNotes />
      </div>
    </div>
  );
}

function MoverList({
  title,
  movers,
  tone,
}: {
  title: string;
  movers: DailyBriefing["gainers"];
  tone: "bull" | "bear";
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {title}
      </p>
      {movers.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">None today.</p>
      ) : (
        <ul className="mt-2.5 space-y-1.5">
          {movers.map((mover) => (
            <li key={mover.symbol}>
              <Link
                href={`/analysis/${mover.symbol}`}
                className="flex items-center gap-2 text-sm transition-opacity hover:opacity-80"
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    tone === "bull" ? "bg-bull" : "bg-bear",
                  )}
                />
                {mover.name}
                <span
                  className={cn(
                    "tabular ml-auto font-medium",
                    tone === "bull" ? "text-bull" : "text-bear",
                  )}
                >
                  {formatSignedPercent(mover.changePercent)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
