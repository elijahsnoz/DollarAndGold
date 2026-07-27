import { Minus, TrendingDown, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { TrendVerdict as TrendVerdictType } from "@/lib/ai/types";
import type { TrendDirection } from "@/lib/market/types";
import { cn } from "@/lib/utils";

const DIRECTION_META: Record<
  TrendDirection,
  { label: string; icon: typeof TrendingUp; badge: "bull" | "bear" | "neutral" }
> = {
  bullish: { label: "Bullish", icon: TrendingUp, badge: "bull" },
  bearish: { label: "Bearish", icon: TrendingDown, badge: "bear" },
  neutral: { label: "Neutral", icon: Minus, badge: "neutral" },
};

/**
 * Trend verdict and confidence.
 *
 * Confidence is drawn as a meter with the number direct-labelled, and the
 * caption says explicitly what it measures — the single most misread figure on
 * the page if left unexplained.
 */
export function TrendVerdict({ trend }: { trend: TrendVerdictType }) {
  const meta = DIRECTION_META[trend.direction];
  const Icon = meta.icon;

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={cn(
            "grid h-11 w-11 place-items-center rounded-xl border",
            trend.direction === "bullish" && "border-bull/25 bg-bull/12 text-bull",
            trend.direction === "bearish" && "border-bear/25 bg-bear/12 text-bear",
            trend.direction === "neutral" &&
              "border-border bg-foreground/[0.04] text-muted-foreground",
          )}
        >
          <Icon className="h-5 w-5" />
        </span>

        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Market trend
          </p>
          <p className="mt-0.5 text-xl font-semibold tracking-tight">
            {meta.label}
          </p>
        </div>

        <Badge variant={meta.badge} className="ml-auto">
          {trend.confidence}/100 confidence
        </Badge>
      </div>

      <p className="mt-5 text-[15px] leading-relaxed">{trend.headline}.</p>

      <div className="mt-5">
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-foreground/[0.07]"
          role="meter"
          aria-valuenow={trend.confidence}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Indicator agreement"
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-700",
              trend.direction === "bullish" && "bg-bull",
              trend.direction === "bearish" && "bg-bear",
              trend.direction === "neutral" && "bg-muted-foreground",
            )}
            style={{ width: `${trend.confidence}%` }}
          />
        </div>
        <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
          Confidence measures how much the indicators agree with each other. It
          is <strong className="font-medium">not</strong> a probability that a
          trade will be profitable.
        </p>
      </div>

      <div className="mt-5 border-t border-border/60 pt-4">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Signals behind this
        </p>
        <ul className="mt-3 space-y-2">
          {trend.contributions.map((contribution) => (
            <li
              key={contribution.label}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="text-muted-foreground">{contribution.label}</span>
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    contribution.signal === "bullish" && "bg-bull",
                    contribution.signal === "bearish" && "bg-bear",
                    contribution.signal === "neutral" && "bg-muted-foreground",
                  )}
                />
                <span className="w-16 text-right font-medium capitalize">
                  {contribution.signal}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
