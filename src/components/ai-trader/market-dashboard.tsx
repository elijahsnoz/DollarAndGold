import Link from "next/link";

import { ChangePill } from "@/components/common/change-pill";
import { GlossaryTerm } from "@/components/education/glossary-term";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatPrice } from "@/lib/format";
import type { MarketCardData } from "@/lib/ai-trader/types";
import { cn } from "@/lib/utils";

const SIGNAL_VARIANT = { buy: "bull", sell: "bear", hold: "neutral" } as const;
const SIGNAL_LABEL = { buy: "Buy", sell: "Sell", hold: "Hold" } as const;

/** Section 2: Market Dashboard — "signal" is the existing trend engine, relabelled honestly. */
export function MarketDashboard({ cards }: { cards: MarketCardData[] }) {
  return (
    <section>
      <h2 className="text-lg font-semibold tracking-tight">Market Dashboard</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Signal is a direct read of the same deterministic trend engine behind
        every analysis page — not a separate model.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {cards.map((card) => (
          <Link key={card.symbol} href={`/analysis/${card.symbol}`}>
            <Card interactive className="h-full p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold leading-tight">{card.name}</p>
                  <p className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    {card.ticker}
                  </p>
                </div>
                <Badge variant={SIGNAL_VARIANT[card.signal]}>{SIGNAL_LABEL[card.signal]}</Badge>
              </div>

              <div className="mt-4 flex items-end justify-between gap-3">
                <span className="tabular text-xl font-semibold tracking-tight">
                  {formatPrice(card.price, card.precision)}
                </span>
                <ChangePill value={card.changePercent} size="sm" />
              </div>

              <div className="mt-4 border-t border-border/60 pt-3">
                <div className="flex items-center justify-between text-xs">
                  <GlossaryTerm term="confidence">
                    <span className="text-muted-foreground">AI confidence</span>
                  </GlossaryTerm>
                  <span className="font-medium">{card.confidence}/100</span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-foreground/[0.07]">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      card.trend === "bullish" && "bg-bull",
                      card.trend === "bearish" && "bg-bear",
                      card.trend === "neutral" && "bg-muted-foreground",
                    )}
                    style={{ width: `${card.confidence}%` }}
                  />
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
