"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, BellRing, Pin, Sparkles, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ChangePill } from "@/components/common/change-pill";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/misc";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice } from "@/lib/format";
import { getAsset } from "@/lib/market/catalog";
import type { Quote } from "@/lib/market/types";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace/store";
import type { WatchlistItem } from "@/lib/workspace/types";

/**
 * The watchlist.
 *
 * Symbols live in the workspace store, so quotes must be fetched on the client
 * — the server has no idea what this browser is watching. Pinned markets sort
 * to the top; everything else keeps insertion order.
 */
export function WatchlistView() {
  const { state, ready, togglePin, removeFromWatchlist } = useWorkspace();
  const [quotes, setQuotes] = React.useState<Record<string, Quote>>({});
  const [loading, setLoading] = React.useState(false);

  const symbols = React.useMemo(
    () =>
      state.watchlist
        .map((item) => item.symbol)
        .sort()
        .join(","),
    [state.watchlist],
  );

  React.useEffect(() => {
    if (!symbols) {
      setQuotes({});
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const load = async () => {
      if (document.visibilityState === "visible") {
        try {
          const response = await fetch(`/api/markets?symbols=${symbols}`, {
            cache: "no-store",
          });
          if (response.ok) {
            const data = (await response.json()) as { quotes: Quote[] };
            if (!cancelled) {
              setQuotes(
                Object.fromEntries(data.quotes.map((q) => [q.symbol, q])),
              );
            }
          }
        } catch {
          // Keep the last known quotes.
        }
      }
      if (!cancelled) timer = setTimeout(load, 6000);
    };

    setLoading(true);
    void load().finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [symbols]);

  const sorted = React.useMemo(
    () =>
      [...state.watchlist].sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return a.addedAt - b.addedAt;
      }),
    [state.watchlist],
  );

  if (!ready) return <WatchlistSkeleton />;

  if (sorted.length === 0) {
    return (
      <Card className="flex flex-col items-center px-6 py-16 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-2xl border border-gold/25 bg-gold/10 text-gold">
          <Star className="h-5 w-5" />
        </span>
        <h2 className="mt-5 text-lg font-semibold tracking-tight">
          Your watchlist is empty
        </h2>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          Add the markets you actually trade. You&apos;ll get their price,
          change and a one-tap route into the analysis — plus alerts on the
          levels that matter.
        </p>
        <Button asChild className="mt-6">
          <Link href="/markets">Browse markets</Link>
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {sorted.map((item) => {
        const asset = getAsset(item.symbol);
        if (!asset) return null;
        const quote = quotes[item.symbol];

        return (
          <Card key={item.symbol} className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => togglePin(item.symbol)}
                aria-label={item.pinned ? "Unpin" : "Pin to top"}
                aria-pressed={item.pinned}
                className={cn(
                  "rounded-full p-1.5 transition-colors",
                  item.pinned
                    ? "text-gold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Pin className={cn("h-4 w-4", item.pinned && "fill-gold")} />
              </button>

              <Link href={`/analysis/${asset.symbol}`} className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold leading-tight">
                  {asset.name}
                </p>
                <p className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  {asset.ticker}
                </p>
              </Link>

              <div className="flex items-center gap-3">
                {quote ? (
                  <>
                    <span className="tabular text-base font-semibold">
                      {formatPrice(quote.price, asset.precision)}
                    </span>
                    <ChangePill value={quote.changePercent} size="sm" />
                  </>
                ) : (
                  <Skeleton className="h-6 w-28" />
                )}
              </div>

              <div className="ml-auto flex items-center gap-1">
                <AlertDialog item={item} currentPrice={quote?.price} />

                <Button asChild variant="ghost" size="icon-sm">
                  <Link
                    href={`/analysis/${asset.symbol}`}
                    aria-label={`Analyse ${asset.name}`}
                  >
                    <Sparkles />
                  </Link>
                </Button>

                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => {
                    removeFromWatchlist(item.symbol);
                    toast(`${asset.name} removed from watchlist`);
                  }}
                  aria-label={`Remove ${asset.name}`}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>

            <AlertStatus item={item} price={quote?.price} precision={asset.precision} />
          </Card>
        );
      })}

      {loading && sorted.length > 0 && (
        <p className="text-xs text-muted-foreground">Refreshing prices…</p>
      )}
    </div>
  );
}

/** Shows whether either configured level has been reached. */
function AlertStatus({
  item,
  price,
  precision,
}: {
  item: WatchlistItem;
  price?: number;
  precision: number;
}) {
  if (item.alertAbove === undefined && item.alertBelow === undefined) return null;

  const aboveHit =
    item.alertAbove !== undefined && price !== undefined && price >= item.alertAbove;
  const belowHit =
    item.alertBelow !== undefined && price !== undefined && price <= item.alertBelow;
  const triggered = aboveHit || belowHit;

  return (
    <div
      className={cn(
        "mt-3 flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-xs",
        triggered
          ? "border-gold/30 bg-gold/10 text-gold"
          : "border-border/60 text-muted-foreground",
      )}
      role={triggered ? "status" : undefined}
    >
      {triggered ? (
        <BellRing className="h-3.5 w-3.5" />
      ) : (
        <Bell className="h-3.5 w-3.5" />
      )}
      {item.alertAbove !== undefined && (
        <span className="tabular">
          Above {formatPrice(item.alertAbove, precision)}
          {aboveHit ? " — reached" : ""}
        </span>
      )}
      {item.alertAbove !== undefined && item.alertBelow !== undefined && (
        <span aria-hidden="true">·</span>
      )}
      {item.alertBelow !== undefined && (
        <span className="tabular">
          Below {formatPrice(item.alertBelow, precision)}
          {belowHit ? " — reached" : ""}
        </span>
      )}
    </div>
  );
}

function AlertDialog({
  item,
  currentPrice,
}: {
  item: WatchlistItem;
  currentPrice?: number;
}) {
  const { setAlert } = useWorkspace();
  const [open, setOpen] = React.useState(false);
  const [above, setAbove] = React.useState(item.alertAbove?.toString() ?? "");
  const [below, setBelow] = React.useState(item.alertBelow?.toString() ?? "");

  const asset = getAsset(item.symbol);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const parsedAbove = above.trim() ? Number(above) : undefined;
    const parsedBelow = below.trim() ? Number(below) : undefined;

    if (
      (parsedAbove !== undefined && !Number.isFinite(parsedAbove)) ||
      (parsedBelow !== undefined && !Number.isFinite(parsedBelow))
    ) {
      toast.error("Alert levels must be numbers.");
      return;
    }

    setAlert(item.symbol, { above: parsedAbove, below: parsedBelow });
    setOpen(false);
    toast.success(`Alerts updated for ${asset?.name ?? item.symbol}`);
  };

  const hasAlert = item.alertAbove !== undefined || item.alertBelow !== undefined;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Set price alerts for ${asset?.name ?? item.symbol}`}
        >
          <Bell className={cn(hasAlert && "text-gold")} />
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Price alerts · {asset?.name}</DialogTitle>
          <DialogDescription>
            {currentPrice !== undefined && asset
              ? `Currently ${formatPrice(currentPrice, asset.precision)}. Leave a field blank to clear that alert.`
              : "Leave a field blank to clear that alert."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={`above-${item.symbol}`}>Alert me above</Label>
            <Input
              id={`above-${item.symbol}`}
              inputMode="decimal"
              value={above}
              onChange={(event) => setAbove(event.target.value)}
              placeholder="e.g. 3400"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`below-${item.symbol}`}>Alert me below</Label>
            <Input
              id={`below-${item.symbol}`}
              inputMode="decimal"
              value={below}
              onChange={(event) => setBelow(event.target.value)}
              placeholder="e.g. 3200"
            />
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">
            Alerts show on this page while it is open. Push and email delivery
            are part of the Pro plan.
          </p>

          <Button type="submit" className="w-full">
            Save alerts
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function WatchlistSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="glass rounded-[var(--radius)] p-4">
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
    </div>
  );
}
