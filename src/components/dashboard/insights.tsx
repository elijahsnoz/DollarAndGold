"use client";

import * as React from "react";

import { Card } from "@/components/ui/card";
import { tradeReturn } from "@/components/dashboard/journal";
import { formatSignedPercent } from "@/lib/format";
import { getAsset } from "@/lib/market/catalog";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace/store";

/**
 * Performance insights from the journal.
 *
 * These are descriptive statistics on what the user recorded, not a verdict on
 * whether they are a good trader — the sample is almost always far too small
 * for that, which the caption says out loud.
 */
export function PerformanceInsights() {
  const { state } = useWorkspace();

  const stats = React.useMemo(() => {
    const closed = state.journal.filter(
      (trade) => trade.outcome !== "open" && tradeReturn(trade) !== null,
    );

    if (closed.length === 0) return null;

    const returns = closed.map((trade) => tradeReturn(trade) as number);
    const wins = returns.filter((r) => r > 0);
    const losses = returns.filter((r) => r < 0);

    const average = returns.reduce((a, b) => a + b, 0) / returns.length;
    const avgWin = wins.length
      ? wins.reduce((a, b) => a + b, 0) / wins.length
      : 0;
    const avgLoss = losses.length
      ? losses.reduce((a, b) => a + b, 0) / losses.length
      : 0;

    // Which market has produced the most cumulative return so far.
    const bySymbol = new Map<string, number>();
    for (const trade of closed) {
      const value = tradeReturn(trade) as number;
      bySymbol.set(trade.symbol, (bySymbol.get(trade.symbol) ?? 0) + value);
    }
    const bestSymbol = [...bySymbol.entries()].sort((a, b) => b[1] - a[1])[0];

    return {
      count: closed.length,
      open: state.journal.length - closed.length,
      winRate: (wins.length / closed.length) * 100,
      average,
      avgWin,
      avgLoss,
      // Ratio of average win to average loss — the number that decides whether
      // a low win rate is actually a problem.
      payoff: avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : null,
      bestSymbol,
    };
  }, [state.journal]);

  if (!stats) {
    return (
      <Card className="p-6">
        <h2 className="text-base font-semibold tracking-tight">
          Performance insights
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Record a few closed trades in the journal and this fills in with your
          win rate, average result, and how your winners compare to your losers.
        </p>
      </Card>
    );
  }

  const tiles: { label: string; value: string; tone?: "bull" | "bear" }[] = [
    { label: "Closed trades", value: String(stats.count) },
    { label: "Win rate", value: `${stats.winRate.toFixed(0)}%` },
    {
      label: "Average result",
      value: formatSignedPercent(stats.average),
      tone: stats.average >= 0 ? "bull" : "bear",
    },
    {
      label: "Win / loss ratio",
      value: stats.payoff ? `${stats.payoff.toFixed(2)}×` : "—",
    },
  ];

  return (
    <Card className="p-6">
      <h2 className="text-base font-semibold tracking-tight">
        Performance insights
      </h2>

      <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label}>
            <dt className="text-xs text-muted-foreground">{tile.label}</dt>
            <dd
              className={cn(
                "tabular mt-1 text-xl font-semibold tracking-tight",
                tile.tone === "bull" && "text-bull",
                tile.tone === "bear" && "text-bear",
              )}
            >
              {tile.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 space-y-2 border-t border-border/60 pt-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          Your average winner is {formatSignedPercent(stats.avgWin)} and your
          average loser is {formatSignedPercent(stats.avgLoss)}.
          {stats.payoff && stats.payoff >= 1.5
            ? " With winners that much larger than losers, a win rate below 50% can still work."
            : stats.payoff && stats.payoff < 1
              ? " Losers are currently larger than winners, which means the win rate has to stay high for this to work out."
              : ""}
        </p>
        {stats.bestSymbol && (
          <p>
            Most productive market so far:{" "}
            <span className="text-foreground/85">
              {getAsset(stats.bestSymbol[0])?.name ?? stats.bestSymbol[0]}
            </span>{" "}
            at {formatSignedPercent(stats.bestSymbol[1])} cumulative.
          </p>
        )}
        {stats.count < 20 && (
          <p className="text-xs">
            With {stats.count} closed{" "}
            {stats.count === 1 ? "trade" : "trades"}, this is far too small a
            sample to say anything about skill. Treat it as bookkeeping, not a
            verdict.
          </p>
        )}
      </div>
    </Card>
  );
}
