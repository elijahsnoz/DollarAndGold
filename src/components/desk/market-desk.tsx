"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Quote,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { ChangePill } from "@/components/common/change-pill";
import { DataSourceBadge } from "@/components/common/data-source-badge";
import { Disclaimer } from "@/components/common/disclaimer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  composeBriefing,
  deskSymbolsFor,
  type MarketContext,
} from "@/lib/briefing/compose";
import { nothingToday } from "@/lib/briefing/nothing-new";
import type { BriefingItem, PersonalBriefing } from "@/lib/briefing/types";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import { isLiveSource } from "@/lib/market/provenance";
import { useWorkspace } from "@/lib/workspace/store";

const CATEGORY_ICON: Record<BriefingItem["category"], typeof TrendingUp> = {
  "market-move": TrendingUp,
  level: TrendingDown,
  volatility: ShieldCheck,
  event: Sparkles,
  behaviour: BookOpen,
  archive: Quote,
};

/**
 * The Market Desk — the surface this product exists to be opened at.
 *
 * Market context comes from the server; everything personal is folded in here,
 * so notes and journal history never leave the browser. The layout is ordered
 * by what a person actually needs at 7am: what deserves attention, then their
 * markets, then their own past words, then risk.
 */
export function MarketDesk() {
  const { state, profile, ready, markBriefingSeen } = useWorkspace();
  const [contexts, setContexts] = React.useState<MarketContext[] | null>(null);
  const [failed, setFailed] = React.useState(false);

  const desk = React.useMemo(() => deskSymbolsFor(profile), [profile]);
  const symbolKey = desk.symbols.map((s) => s.symbol).join(",");

  React.useEffect(() => {
    if (!ready) return;

    let cancelled = false;
    setFailed(false);

    (async () => {
      try {
        const response = await fetch("/api/desk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbols: desk.symbols }),
        });
        if (!response.ok) throw new Error("desk request failed");
        const data = (await response.json()) as { contexts: MarketContext[] };
        if (!cancelled) setContexts(data.contexts);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Keyed on the symbol list rather than the profile object, which changes
    // identity on every workspace edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, symbolKey]);

  const briefing: PersonalBriefing | null = React.useMemo(() => {
    if (!contexts) return null;
    return composeBriefing({
      contexts,
      workspace: state,
      profile,
      ritual: state.ritual,
      usingDefaults: desk.usingDefaults,
    });
  }, [contexts, state, profile, desk.usingDefaults]);

  // Record the visit once the briefing has actually been shown.
  React.useEffect(() => {
    if (briefing) markBriefingSeen(briefing.ritual.day);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [briefing?.ritual.day, Boolean(briefing)]);

  if (!ready || (!briefing && !failed)) return <DeskSkeleton />;

  if (failed || !briefing) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Today&apos;s briefing couldn&apos;t be assembled — the market data
          didn&apos;t load. Nothing you saved is affected.
        </p>
        <Button
          variant="outline"
          className="mt-5"
          onClick={() => window.location.reload()}
        >
          Try again
        </Button>
      </Card>
    );
  }

  const quiet = nothingToday(briefing.markets.length, briefing.considered);

  return (
    <div className="space-y-6">
      {/* --- Greeting --- */}
      <header>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {briefing.ritual.greeting}
        </h1>
        {/* Time-neutral: the greeting above is already hour-aware, and a
            hardcoded "this morning" contradicts it after midday. */}
        <p className="mt-2 text-muted-foreground">
          {briefing.ritual.sinceLastVisit
            ? `${briefing.ritual.sinceLastVisit}, here is what changed on your desk.`
            : "Here is your desk."}
        </p>
        {briefing.usingDefaults && (
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            These are default markets, not yours yet. Star the ones you follow
            and this desk becomes specific to you.
          </p>
        )}
      </header>

      {/* --- Today: the Silence Engine's verdict --- */}
      <Card className="p-6">
        <div className="flex items-center gap-2.5">
          <Sparkles className="h-4 w-4 text-gold" />
          <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            Today
          </h2>
          {!briefing.quiet && (
            <Badge variant="outline" className="ml-auto">
              {briefing.items.length}{" "}
              {briefing.items.length === 1 ? "thing" : "things"} worth your
              attention
            </Badge>
          )}
        </div>

        {briefing.quiet ? (
          <div className="mt-5 flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-bull" />
            <div>
              <p className="text-lg font-semibold tracking-tight">
                {quiet.headline}
              </p>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {quiet.body}
              </p>
            </div>
          </div>
        ) : (
          // Three answers at a glance: what happened, why it matters, and
          // whether it needs a decision. Nothing else competes for the eye.
          <ul className="mt-5 space-y-4">
            {briefing.items.map((item) => {
              const Icon = CATEGORY_ICON[item.category];
              return (
                <li key={item.id} className="flex gap-3.5">
                  <span
                    className={cn(
                      "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border",
                      item.needsAttention
                        ? "border-gold/40 bg-gold/15 text-gold"
                        : "border-border bg-foreground/[0.03] text-muted-foreground",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-x-2 font-medium leading-snug">
                      {item.symbol ? (
                        <Link
                          href={`/analysis/${item.symbol}`}
                          className="hover:text-gold"
                        >
                          {item.headline}
                        </Link>
                      ) : (
                        item.headline
                      )}
                      {item.needsAttention && (
                        <span className="rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-gold">
                          Needs attention
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {item.why}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground/70">
                      {item.basis}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* --- Your markets --- */}
      {briefing.markets.length > 0 && (
        <Card className="p-6">
          <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            {briefing.usingDefaults ? "Markets" : "Your markets"}
          </h2>

          <ul className="mt-4 divide-y divide-border/60">
            {briefing.markets.map((market) => (
              <li key={market.symbol} className="py-3 first:pt-0 last:pb-0">
                <Link
                  href={`/analysis/${market.symbol}`}
                  className="group flex flex-wrap items-center gap-x-4 gap-y-1"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium group-hover:text-gold">
                      {market.name}
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {market.approaching
                        ? `${market.approaching.kind} at ${formatPrice(market.approaching.level, market.precision)}`
                        : market.reason}
                    </span>
                  </span>

                  {/* Flagged only when not live — the risk is mistaking a
                      simulated price for a real one, never the reverse. */}
                  {!isLiveSource(market.source) && (
                    <DataSourceBadge source={market.source} size="sm" />
                  )}

                  <span className="tabular text-sm font-semibold">
                    {formatPrice(market.price, market.precision)}
                  </span>
                  <ChangePill value={market.changePercent} size="sm" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* --- From your archive --- */}
      {briefing.archive && (
        <Card className="p-6">
          <div className="flex items-center gap-2.5">
            <Quote className="h-4 w-4 text-gold" />
            <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
              From your archive
            </h2>
          </div>
          <p className="mt-4 text-sm leading-relaxed">
            &ldquo;{briefing.archive.body}&rdquo;
          </p>
          <p className="mt-2.5 text-xs text-muted-foreground">
            You wrote this {briefing.archive.ageDays} days ago
            {briefing.archive.symbol
              ? ` about ${briefing.archive.symbol}`
              : ""}
            . Worth checking whether it still holds.
          </p>
        </Card>
      )}

      {/* --- Risk --- */}
      <Card className="p-6">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="h-4 w-4 text-gold" />
          <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            Risk intelligence
          </h2>
          <Badge
            variant={
              briefing.risk.level === "high" || briefing.risk.level === "elevated"
                ? "gold"
                : "outline"
            }
            className="ml-auto capitalize"
          >
            {briefing.risk.level}
          </Badge>
        </div>

        <p className="mt-4 text-sm leading-relaxed">{briefing.risk.summary}</p>

        {briefing.risk.notes.length > 0 && (
          <ul className="mt-4 space-y-2.5">
            {briefing.risk.notes.map((note) => (
              <li
                key={note}
                className="flex gap-3 text-sm leading-relaxed text-muted-foreground"
              >
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-gold" />
                {note}
              </li>
            ))}
          </ul>
        )}

        {briefing.risk.behavioural && (
          <div className="mt-5 rounded-2xl border border-border/60 p-4">
            <p className="text-sm font-medium">
              {briefing.risk.behavioural.title}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {briefing.risk.behavioural.body}
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground/80">
              Based on {briefing.risk.behavioural.evidence.basis}
            </p>
          </div>
        )}
      </Card>

      {/* --- Research --- */}
      {briefing.research.length > 0 && (
        <Card className="p-6">
          <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            Worth a closer look
          </h2>
          <ul className="mt-4 space-y-2">
            {briefing.research.map((entry) => (
              <li key={entry.symbol}>
                <Link
                  href={`/analysis/${entry.symbol}`}
                  className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-foreground/[0.04]"
                >
                  <span className="text-sm font-medium group-hover:text-gold">
                    {entry.name}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {entry.reason}
                  </span>
                  <ArrowRight className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Disclaimer />
    </div>
  );
}

function DeskSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      </div>
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="glass rounded-[var(--radius)] p-6">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="mt-4 h-5 w-3/4" />
          <Skeleton className="mt-3 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-5/6" />
        </div>
      ))}
    </div>
  );
}
