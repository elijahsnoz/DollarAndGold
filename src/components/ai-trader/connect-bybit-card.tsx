"use client";

import * as React from "react";
import { CheckCircle2, KeyRound, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/misc";
import { formatPrice } from "@/lib/format";
import type { BybitWalletBalance } from "@/lib/ai-trader/exchanges/bybit";
import type { ExchangeConnectionStatus, ExchangeEnvironment } from "@/lib/ai-trader/types";
import { cn } from "@/lib/utils";

const ENVIRONMENTS: ExchangeEnvironment[] = ["testnet", "live"];

/**
 * Section 1: Connect Bybit.
 *
 * Saving credentials never calls Bybit — that only happens when this
 * component asks `/api/ai-trader/balance` for a read-only wallet balance,
 * which is the only thing wired up to the exchange so far. No positions, no
 * order placement, no auto-trading.
 */
export function ConnectBybitCard({ initial }: { initial: ExchangeConnectionStatus }) {
  const [connection, setConnection] = React.useState(initial);
  const [apiKey, setApiKey] = React.useState("");
  const [apiSecret, setApiSecret] = React.useState("");
  const [environment, setEnvironment] = React.useState<ExchangeEnvironment>(
    initial.environment ?? "testnet",
  );
  const [saving, setSaving] = React.useState(false);

  const [balance, setBalance] = React.useState<BybitWalletBalance | null>(null);
  const [balanceLoading, setBalanceLoading] = React.useState(false);
  const [balanceError, setBalanceError] = React.useState<string | null>(null);

  const loadBalance = React.useCallback(async () => {
    setBalanceLoading(true);
    setBalanceError(null);
    try {
      const response = await fetch("/api/ai-trader/balance");
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Unable to fetch balance from Bybit.");
      setBalance(data.balance as BybitWalletBalance);
    } catch (error) {
      setBalance(null);
      setBalanceError(
        error instanceof Error ? error.message : "Unable to fetch balance from Bybit.",
      );
    } finally {
      setBalanceLoading(false);
    }
  }, []);

  // Load automatically once, whenever the page loads with a connection already saved.
  React.useEffect(() => {
    if (connection.connected) void loadBalance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!apiKey.trim() || !apiSecret.trim()) {
      toast.error("Enter both the API key and secret.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/ai-trader/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exchange: "bybit",
          apiKey: apiKey.trim(),
          apiSecret: apiSecret.trim(),
          environment,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Couldn't save those credentials.");

      setConnection({ connected: true, exchange: "bybit", environment: data.environment });
      setApiKey("");
      setApiSecret("");
      toast.success("Credentials saved securely");
      void loadBalance();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save those credentials.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2.5">
        <KeyRound className="h-4 w-4 text-gold" />
        <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
          Connect Bybit
        </h2>
      </div>

      {connection.connected ? (
        <div className="mt-5 rounded-2xl border border-bull/25 bg-bull/10 p-4 text-sm">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-bull" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-bull">Credentials saved securely</p>
              <p className="mt-1 leading-relaxed text-muted-foreground">
                Environment: <span className="font-medium capitalize">{connection.environment}</span>.
                Balance is read live below. Positions, order placement and auto-trading are still
                a later phase.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => void loadBalance()}
              disabled={balanceLoading}
              aria-label="Refresh balance"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", balanceLoading && "animate-spin")} />
            </Button>
          </div>

          <div className="mt-4 border-t border-bull/20 pt-4">
            {balanceLoading && !balance ? (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Fetching balance from Bybit…
              </p>
            ) : balanceError ? (
              <p className="text-xs leading-relaxed text-bear">{balanceError}</p>
            ) : balance ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Balance</p>
                  <p className="tabular mt-1 font-semibold">
                    ${formatPrice(balance.totalEquity)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Available</p>
                  <p className="tabular mt-1 font-semibold">
                    ${formatPrice(balance.totalAvailableBalance)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Account type</p>
                  <p className="mt-1 font-semibold">{balance.accountType}</p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Encrypted on the server before it&apos;s stored. Your key and secret are never sent back
          to the browser once saved.
        </p>
      )}

      <form onSubmit={submit} className="mt-5 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="bybit-api-key">API Key</Label>
          <Input
            id="bybit-api-key"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder={connection.connected ? "Enter a new key to replace it" : "Your Bybit API key"}
            autoComplete="off"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bybit-api-secret">API Secret</Label>
          <Input
            id="bybit-api-secret"
            type="password"
            value={apiSecret}
            onChange={(event) => setApiSecret(event.target.value)}
            placeholder={connection.connected ? "Enter a new secret to replace it" : "Your Bybit API secret"}
            autoComplete="off"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Environment</Label>
          <div className="flex gap-2">
            {ENVIRONMENTS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setEnvironment(option)}
                aria-pressed={environment === option}
                className={cn(
                  "flex-1 rounded-xl border px-3 py-2 text-sm font-medium capitalize transition-colors",
                  environment === option
                    ? "border-gold/40 bg-gold/10 text-gold"
                    : "border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground",
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={saving}>
          {saving ? "Saving…" : connection.connected ? "Update credentials" : "Connect Bybit"}
        </Button>
      </form>
    </Card>
  );
}
