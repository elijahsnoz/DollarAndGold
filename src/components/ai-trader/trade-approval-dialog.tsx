"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/misc";
import { formatPrice } from "@/lib/format";
import type { ExchangeEnvironment } from "@/lib/ai-trader/types";
import { cn } from "@/lib/utils";

export interface PendingTrade {
  symbol: string;
  bybitSymbol: string;
  assetName: string;
  precision: number;
  side: "buy" | "sell";
  entry: number;
  stopLoss: number;
  takeProfit: number;
  confidence: number;
  reasons: string[];
  note: string;
}

/**
 * Section 4: Trade Approval.
 *
 * "Reject Trade" is just closing this dialog — there is no persistent
 * opportunity queue yet, only a suggestion the user asked for and is now
 * deciding on. Nothing executes without this dialog's Approve button being
 * clicked; there is no automatic path into order placement at all yet.
 */
export function TradeApprovalDialog({
  trade,
  environment,
  open,
  onOpenChange,
  onApproved,
}: {
  trade: PendingTrade | null;
  environment: ExchangeEnvironment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApproved: () => void;
}) {
  const [qty, setQty] = React.useState("");
  const [confirmedLive, setConfirmedLive] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setQty("");
      setConfirmedLive(false);
    }
  }, [open]);

  if (!trade) return null;

  const isLive = environment === "live";
  const canSubmit = Number(qty) > 0 && (!isLive || confirmedLive) && !submitting;

  const approve = async () => {
    setSubmitting(true);
    try {
      const response = await fetch("/api/ai-trader/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: trade.symbol,
          side: trade.side,
          qty: Number(qty),
          stopLoss: trade.stopLoss,
          takeProfit: trade.takeProfit,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Unable to place that order on Bybit.");

      toast.success(`Order placed on Bybit (${data.environment})`, {
        description: `Order ID: ${data.order.orderId}`,
      });
      onApproved();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to place that order on Bybit.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {trade.side === "buy" ? "Buy" : "Sell"} {trade.assetName}
          </DialogTitle>
        </DialogHeader>

        <div
          className={cn(
            "flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium",
            isLive
              ? "border-bear/30 bg-bear/10 text-bear"
              : "border-gold/30 bg-gold/10 text-gold",
          )}
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {isLive
            ? "LIVE — this places a real order with real funds on your Bybit account."
            : "Testnet — no real funds are involved."}
        </div>

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Row label="Entry (market)" value={formatPrice(trade.entry, trade.precision)} />
          <Row label="Stop loss" value={formatPrice(trade.stopLoss, trade.precision)} />
          <Row label="Take profit" value={formatPrice(trade.takeProfit, trade.precision)} />
          <Row label="Confidence" value={`${trade.confidence}/100`} />
        </dl>

        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Reasoning
          </p>
          <ul className="mt-2 space-y-1">
            {trade.reasons.map((reason) => (
              <li key={reason} className="text-xs leading-relaxed text-muted-foreground">
                • {reason}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{trade.note}</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="trade-qty">
            Quantity ({trade.bybitSymbol.replace("USDT", "")})
          </Label>
          <Input
            id="trade-qty"
            inputMode="decimal"
            value={qty}
            onChange={(event) => setQty(event.target.value)}
            placeholder="e.g. 0.01"
          />
          <p className="text-[11px] text-muted-foreground">
            Check Bybit&apos;s minimum order size for {trade.bybitSymbol} — a quantity below it
            will be rejected by Bybit, not silently adjusted.
          </p>
        </div>

        {isLive && (
          <label className="flex items-start gap-2.5 text-xs leading-relaxed">
            <input
              type="checkbox"
              checked={confirmedLive}
              onChange={(event) => setConfirmedLive(event.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 shrink-0"
            />
            I understand this places a real order on my live Bybit account, using whatever
            leverage is currently set for {trade.bybitSymbol} there.
          </label>
        )}

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
          >
            Reject
          </Button>
          <Button
            type="button"
            className="flex-1"
            disabled={!canSubmit}
            onClick={() => void approve()}
          >
            {submitting ? "Placing…" : "Approve trade"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="tabular mt-0.5 font-medium">{value}</dd>
    </div>
  );
}
