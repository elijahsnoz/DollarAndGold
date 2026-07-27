"use client";

import Link from "next/link";
import { Compass, Lightbulb, Sparkles, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { BehaviourInsight, UserProfile } from "@/lib/personalisation/types";
import { cn } from "@/lib/utils";

const MATURITY_COPY: Record<
  UserProfile["maturity"],
  { label: string; line: string }
> = {
  new: {
    label: "Getting to know you",
    line: "There isn't enough history yet to say much about how you work. That is expected — this fills in as you use the platform.",
  },
  learning: {
    label: "Learning your interests",
    line: "Your focus markets are starting to show. Behaviour patterns need more history before they mean anything.",
  },
  familiar: {
    label: "Familiar with your interests",
    line: "Your attention has a clear shape. Patterns in how you trade are beginning to hold up.",
  },
  established: {
    label: "Familiar with your habits",
    line: "There is enough history here for the patterns below to be worth taking seriously.",
  },
};

/**
 * What the system understands about the user.
 *
 * The hard part of this panel is what it *doesn't* say. It reports withheld
 * patterns and what would unlock them rather than padding itself with weak
 * claims — a platform that guesses at your habits is worse than one that admits
 * it is still watching, because every later claim inherits that doubt.
 */
export function UnderstandingPanel({ profile }: { profile: UserProfile }) {
  const maturity = MATURITY_COPY[profile.maturity];
  const topMarkets = profile.focusMarkets.slice(0, 4);

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center gap-2.5">
        <Compass className="h-4 w-4 text-gold" />
        <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
          What DollarAndGold understands
        </h2>
        <Badge variant="outline" className="ml-auto">
          {maturity.label}
        </Badge>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        {maturity.line}
      </p>

      {topMarkets.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Your markets
          </p>
          <ul className="mt-3 space-y-2.5">
            {topMarkets.map((market) => (
              <li key={market.symbol}>
                <Link
                  href={`/analysis/${market.symbol}`}
                  className="group flex items-center gap-3"
                >
                  <span className="w-28 shrink-0 truncate text-sm font-medium group-hover:text-gold">
                    {market.name}
                  </span>
                  {/* Attention share, not price performance — this bar says
                      "where you look", never "how you did". */}
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/[0.07]">
                    <span
                      className="block h-full rounded-full bg-gold/70"
                      style={{ width: `${Math.max(4, market.score * 100)}%` }}
                    />
                  </span>
                  <span className="w-32 shrink-0 truncate text-right text-[11px] text-muted-foreground">
                    {market.reasons.slice(0, 2).join(", ")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {profile.insights.length > 0 && (
        <div className="mt-6 space-y-3 border-t border-border/60 pt-5">
          {profile.insights.map((insight) => (
            <InsightRow key={insight.id} insight={insight} />
          ))}
        </div>
      )}

      {(profile.nextUnlock || profile.withheldInsights > 0) && (
        <div className="mt-5 flex items-start gap-2.5 border-t border-border/60 pt-4">
          <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            {profile.nextUnlock ??
              `${profile.withheldInsights} further ${profile.withheldInsights === 1 ? "pattern is" : "patterns are"} forming but not yet supported by enough history.`}
          </p>
        </div>
      )}
    </Card>
  );
}

function InsightRow({ insight }: { insight: BehaviourInsight }) {
  const Icon = insight.kind === "watch-out" ? TriangleAlert : Sparkles;

  return (
    <div className="rounded-2xl border border-border/60 p-4">
      <div className="flex items-start gap-2.5">
        <Icon
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0",
            insight.kind === "watch-out" ? "text-gold" : "text-bull",
          )}
        />
        <div className="min-w-0">
          <p className="text-sm font-medium leading-snug">{insight.title}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {insight.body}
          </p>
          {/* Every claim states the evidence behind it, so a user can decide
              how much weight it deserves instead of taking it on faith. */}
          <p className="mt-2 text-[11px] text-muted-foreground/80">
            Based on {insight.evidence.basis}
            {insight.evidence.confidence === "emerging" && " · still emerging"}
          </p>
        </div>
      </div>
    </div>
  );
}
