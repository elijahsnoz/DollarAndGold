import { Newspaper, Repeat, Target, TrendingDown, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatRelativeTime } from "@/lib/format";
import type { TimelineEvent } from "@/lib/ai/timeline";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<TimelineEvent["kind"], string> = {
  "price-move": "Price move",
  "trend-reversal": "Trend change",
  "level-break": "Level break",
  news: "News",
};

const MAX_SHOWN = 20;

function EventIcon({ event }: { event: TimelineEvent }) {
  const Icon =
    event.kind === "trend-reversal"
      ? Repeat
      : event.kind === "level-break"
        ? Target
        : event.kind === "news"
          ? Newspaper
          : event.direction === "bearish"
            ? TrendingDown
            : TrendingUp;

  return (
    <span
      className={cn(
        "grid h-7 w-7 shrink-0 place-items-center rounded-full border",
        event.direction === "bullish" && "border-bull/25 bg-bull/10 text-bull",
        event.direction === "bearish" && "border-bear/25 bg-bear/10 text-bear",
        event.direction === "neutral" && "border-border bg-foreground/[0.04] text-muted-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}

/**
 * How today's analysis evolved: major moves, trend changes, level breaks and
 * news, merged into one chronological read. See `lib/ai/timeline.ts` for what
 * qualifies as each kind of event and why.
 */
export function MarketTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">
          Nothing in this window cleared the bar for a notable move, trend
          change, or level break.
        </p>
      </Card>
    );
  }

  const shown = events.slice(0, MAX_SHOWN);

  return (
    <Card className="p-6">
      <ul className="space-y-4">
        {shown.map((event, index) => (
          <li key={`${event.at}-${index}`} className="flex gap-3">
            <EventIcon event={event} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">{event.title}</p>
                <Badge variant="outline" className="text-[10px]">
                  {KIND_LABEL[event.kind]}
                </Badge>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {event.detail}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatRelativeTime(event.at)}
              </p>
            </div>
          </li>
        ))}
      </ul>

      {events.length > shown.length && (
        <p className="mt-4 border-t border-border/60 pt-3 text-xs text-muted-foreground">
          Showing the {shown.length} most recent of {events.length} events in
          this window.
        </p>
      )}
    </Card>
  );
}
