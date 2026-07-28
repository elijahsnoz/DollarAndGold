"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/misc";
import { fetchConditions } from "@/lib/context/client";
import { formatPrice, formatSignedPercent } from "@/lib/format";
import { ASSETS, getAsset } from "@/lib/market/catalog";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace/store";
import type { JournalEntry, TradeDirection } from "@/lib/workspace/types";

/**
 * Trading journal.
 *
 * Recording the thesis is mandatory — a journal of entries and exits without
 * reasoning tells you nothing you couldn't get from a broker statement.
 */
export function TradingJournal() {
  const { state, deleteTrade } = useWorkspace();

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">
            Trading journal
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {state.journal.length === 0
              ? "Record what you did and why."
              : `${state.journal.length} recorded ${state.journal.length === 1 ? "trade" : "trades"}.`}
          </p>
        </div>
        <TradeDialog />
      </div>

      {state.journal.length > 0 && (
        <ul className="mt-5 space-y-3">
          {state.journal.slice(0, 8).map((trade) => (
            <li
              key={trade.id}
              className="rounded-2xl border border-border/60 p-4"
            >
              <div className="flex flex-wrap items-center gap-2.5">
                <Badge
                  variant={trade.direction === "long" ? "bull" : "bear"}
                  className="uppercase"
                >
                  {trade.direction}
                </Badge>
                <span className="text-sm font-medium">
                  {getAsset(trade.symbol)?.name ?? trade.symbol}
                </span>
                <OutcomeBadge trade={trade} />

                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="ml-auto"
                  onClick={() => {
                    deleteTrade(trade.id);
                    toast("Trade removed");
                  }}
                  aria-label="Delete trade"
                >
                  <Trash2 />
                </Button>
              </div>

              <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                {trade.thesis}
              </p>

              <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                <div className="flex gap-1.5">
                  <dt>Entry</dt>
                  <dd className="tabular font-medium text-foreground/80">
                    {formatPrice(
                      trade.entryPrice,
                      getAsset(trade.symbol)?.precision ?? 2,
                    )}
                  </dd>
                </div>
                {trade.exitPrice !== undefined && (
                  <div className="flex gap-1.5">
                    <dt>Exit</dt>
                    <dd className="tabular font-medium text-foreground/80">
                      {formatPrice(
                        trade.exitPrice,
                        getAsset(trade.symbol)?.precision ?? 2,
                      )}
                    </dd>
                  </div>
                )}
                {trade.size !== undefined && (
                  <div className="flex gap-1.5">
                    <dt>Size</dt>
                    <dd className="tabular font-medium text-foreground/80">
                      {trade.size}
                    </dd>
                  </div>
                )}
              </dl>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function OutcomeBadge({ trade }: { trade: JournalEntry }) {
  const pnl = tradeReturn(trade);

  if (trade.outcome === "open") {
    return <Badge variant="outline">Open</Badge>;
  }

  return (
    <Badge
      variant={
        trade.outcome === "win" ? "bull" : trade.outcome === "loss" ? "bear" : "neutral"
      }
    >
      {pnl !== null ? formatSignedPercent(pnl) : trade.outcome}
    </Badge>
  );
}

/** Percentage return, sign-corrected for direction. Null while still open. */
export function tradeReturn(trade: JournalEntry): number | null {
  if (trade.exitPrice === undefined || trade.entryPrice === 0) return null;
  const raw = ((trade.exitPrice - trade.entryPrice) / trade.entryPrice) * 100;
  return trade.direction === "long" ? raw : -raw;
}

function TradeDialog() {
  const { saveTrade } = useWorkspace();
  const [open, setOpen] = React.useState(false);
  const [symbol, setSymbol] = React.useState("XAUUSD");
  const [direction, setDirection] = React.useState<TradeDirection>("long");
  const [entryPrice, setEntryPrice] = React.useState("");
  const [exitPrice, setExitPrice] = React.useState("");
  const [size, setSize] = React.useState("");
  const [thesis, setThesis] = React.useState("");
  const [capturing, setCapturing] = React.useState(false);

  const reset = () => {
    setEntryPrice("");
    setExitPrice("");
    setSize("");
    setThesis("");
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    const entry = Number(entryPrice);
    if (!Number.isFinite(entry) || entry <= 0) {
      toast.error("Enter a valid entry price.");
      return;
    }
    if (!thesis.trim()) {
      toast.error("Record why you took the trade — that's the point of a journal.");
      return;
    }

    const exit = exitPrice.trim() ? Number(exitPrice) : undefined;
    if (exit !== undefined && !Number.isFinite(exit)) {
      toast.error("Enter a valid exit price, or leave it blank.");
      return;
    }

    // Outcome is derived from the prices rather than asked for — it removes a
    // field and stops the journal from disagreeing with its own numbers.
    let outcome: JournalEntry["outcome"] = "open";
    if (exit !== undefined) {
      const raw = ((exit - entry) / entry) * (direction === "long" ? 1 : -1);
      outcome = raw > 0.0005 ? "win" : raw < -0.0005 ? "loss" : "breakeven";
    }

    // Record what the market was doing right now. Bounded so a slow or failing
    // snapshot can never stop someone saving their own trade.
    setCapturing(true);
    const conditions = await fetchConditions(symbol);
    setCapturing(false);

    saveTrade({
      symbol,
      direction,
      entryPrice: entry,
      exitPrice: exit,
      size: size.trim() ? Number(size) : undefined,
      thesis: thesis.trim(),
      outcome,
      closedAt: exit !== undefined ? Date.now() : undefined,
      // An already-closed trade is being recorded after the fact, so the
      // snapshot describes the exit, not the entry. Attributing it to entry
      // would be inventing history the user never observed.
      openContext: exit === undefined ? conditions : undefined,
      closeContext: exit !== undefined ? conditions : undefined,
    });

    reset();
    setOpen(false);
    toast.success("Trade recorded");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus />
          Record trade
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record a trade</DialogTitle>
          <DialogDescription>
            Leave the exit blank while the position is still open.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="trade-symbol">Market</Label>
              <select
                id="trade-symbol"
                value={symbol}
                onChange={(event) => setSymbol(event.target.value)}
                className="h-10 w-full rounded-xl border border-input bg-foreground/[0.03] px-3 text-sm focus-visible:border-ring/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
              >
                {ASSETS.map((asset) => (
                  <option key={asset.symbol} value={asset.symbol}>
                    {asset.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="trade-direction">Direction</Label>
              <div
                id="trade-direction"
                className="flex h-10 items-center gap-1 rounded-xl border border-input p-1"
              >
                {(["long", "short"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setDirection(option)}
                    aria-pressed={direction === option}
                    className={cn(
                      "h-full flex-1 rounded-lg text-xs font-medium capitalize transition-colors",
                      direction === option
                        ? option === "long"
                          ? "bg-bull/15 text-bull"
                          : "bg-bear/15 text-bear"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="trade-entry">Entry</Label>
              <Input
                id="trade-entry"
                inputMode="decimal"
                value={entryPrice}
                onChange={(event) => setEntryPrice(event.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="trade-exit">Exit</Label>
              <Input
                id="trade-exit"
                inputMode="decimal"
                value={exitPrice}
                onChange={(event) => setExitPrice(event.target.value)}
                placeholder="Open"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="trade-size">Size</Label>
              <Input
                id="trade-size"
                inputMode="decimal"
                value={size}
                onChange={(event) => setSize(event.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="trade-thesis">Why did you take it?</Label>
            <Textarea
              id="trade-thesis"
              value={thesis}
              onChange={(event) => setThesis(event.target.value)}
              placeholder="The level, the signal, and what would have told you that you were wrong."
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={capturing}>
            {capturing ? "Recording market conditions…" : "Save trade"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
