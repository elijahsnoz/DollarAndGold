"use client";

import Link from "next/link";
import { Compass, GraduationCap, HelpCircle, Sparkles, TriangleAlert } from "lucide-react";

import {
  nothingLearnedYet,
  stillDeveloping,
} from "@/lib/briefing/nothing-new";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  EVIDENCE_THRESHOLDS,
  type BehaviourInsight,
  type UserProfile,
} from "@/lib/personalisation/types";
import { cn } from "@/lib/utils";

/**
 * Learning Intelligence.
 *
 * Reframed from analysing the user to helping them learn — the same underlying
 * evidence, addressed to them rather than about them. "You perform better in
 * Gold" is a verdict handed down; "here is what your record shows, and here is
 * what is still uncertain" is something a person can actually work with.
 *
 * The section that matters most is the last one. Most products hide what they
 * do not know; stating it is what makes the things they *do* claim worth
 * believing, and it is a truthful reason to come back — the uncertainty is
 * genuinely resolving.
 */
export function LearningPanel({
  profile,
  closedTrades,
}: {
  profile: UserProfile;
  closedTrades: number;
}) {
  // Established beliefs and emerging ones are shown separately, because the
  // difference in how much weight they deserve is the whole point.
  const learned = profile.insights.filter(
    (insight) => insight.evidence.confidence === "established",
  );
  const emerging = profile.insights.filter(
    (insight) => insight.evidence.confidence === "emerging",
  );

  const topMarkets = profile.focusMarkets.slice(0, 4);
  const nothingYet = profile.insights.length === 0;
  const empty = nothingLearnedYet(closedTrades, EVIDENCE_THRESHOLDS.emerging);
  const developing =
    profile.withheldInsights > 0 ? stillDeveloping(profile.withheldInsights) : null;

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center gap-2.5">
        <GraduationCap className="h-4 w-4 text-gold" />
        <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
          Learning intelligence
        </h2>
      </div>

      {/* --- What you've learned --- */}
      {learned.length > 0 && (
        <section className="mt-5">
          <SectionLabel>What your record shows</SectionLabel>
          <div className="mt-3 space-y-3">
            {learned.map((insight) => (
              <InsightRow key={insight.id} insight={insight} />
            ))}
          </div>
        </section>
      )}

      {/* --- What's emerging --- */}
      {emerging.length > 0 && (
        <section className={cn(learned.length > 0 && "mt-6")}>
          <SectionLabel>What may be emerging</SectionLabel>
          <p className="mt-1 text-xs text-muted-foreground">
            Supported, but not yet by enough history to lean on.
          </p>
          <div className="mt-3 space-y-3">
            {emerging.map((insight) => (
              <InsightRow key={insight.id} insight={insight} />
            ))}
          </div>
        </section>
      )}

      {/* --- Nothing yet --- */}
      {nothingYet && (
        <div className="mt-5">
          <p className="text-[15px] font-medium">{empty.headline}</p>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {empty.body}
          </p>
        </div>
      )}

      {/* --- Where your attention goes --- */}
      {topMarkets.length > 0 && (
        <section className="mt-6 border-t border-border/60 pt-5">
          <SectionLabel>
            <Compass className="mr-1.5 inline h-3 w-3" />
            Where your attention goes
          </SectionLabel>
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
                  {/* Attention share — where you look, never how you did. */}
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
        </section>
      )}

      {/* --- What remains uncertain --- */}
      <section className="mt-6 border-t border-border/60 pt-5">
        <SectionLabel>
          <HelpCircle className="mr-1.5 inline h-3 w-3" />
          What remains uncertain
        </SectionLabel>

        <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
          {developing
            ? developing.body
            : profile.nextUnlock ??
              "Nothing is currently pending. New patterns will appear here as your history grows."}
        </p>

        {/* Silence about market conditions needs its reason attached. Without
            this, a user with twenty trades and no conditions insight concludes
            the feature is broken rather than that the evidence isn't there. */}
        {profile.contextCoverage.note && (
          <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
            {profile.contextCoverage.note}
          </p>
        )}
      </section>
    </Card>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
      {children}
    </p>
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
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium leading-snug">
            {insight.title}
            {insight.evidence.confidence === "emerging" && (
              <Badge variant="outline" className="text-[10px]">
                Developing
              </Badge>
            )}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {insight.body}
          </p>
          {/* Every claim states its basis, so it can be audited rather than
              taken on faith. */}
          <p className="mt-2 text-[11px] text-muted-foreground/80">
            Based on {insight.evidence.basis}
          </p>
        </div>
      </div>
    </div>
  );
}
