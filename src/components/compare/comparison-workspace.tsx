"use client";

import * as React from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";

import { ChangePill } from "@/components/common/change-pill";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatPrice } from "@/lib/format";
import type { ComparisonResult } from "@/lib/ai/compare";
import { searchAssets } from "@/lib/market/catalog";
import type { Timeframe } from "@/lib/market/types";
import { cn } from "@/lib/utils";

const TIMEFRAME_ORDER: Timeframe[] = ["1D", "1W", "1M", "3M", "1Y"];
const DEFAULT_SYMBOLS = ["XAUUSD", "BTCUSD"];
const MAX_ASSETS = 6;

const REGIME_LABEL: Record<string, string> = {
  low: "Low",
  normal: "Normal",
  elevated: "Elevated",
  high: "High",
};

/**
 * Market Comparison Workspace.
 *
 * Every card is the same deterministic analysis shown on `/analysis/[symbol]`
 * — trend, confidence, volatility, levels, summary — just arranged so
 * several markets read side by side. Correlation is the one calculation
 * built specifically for this page; see `lib/ai/compare.ts`.
 */
export function ComparisonWorkspace() {
  const [selected, setSelected] = React.useState<string[]>(DEFAULT_SYMBOLS);
  const [timeframe, setTimeframe] = React.useState<Timeframe>("3M");
  const [query, setQuery] = React.useState("");
  const [result, setResult] = React.useState<ComparisonResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const symbolsKey = selected.join(",");

  React.useEffect(() => {
    if (selected.length < 2) {
      setResult(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch("/api/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbols: selected, timeframe }),
    })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error ?? "Unable to build the comparison.");
        if (!cancelled) setResult(data.comparison as ComparisonResult);
      })
      .catch((err) => {
        if (!cancelled) {
          setResult(null);
          setError(err instanceof Error ? err.message : "Unable to build the comparison.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolsKey, timeframe]);

  const matches = React.useMemo(() => {
    if (!query.trim()) return [];
    return searchAssets(query, 6).filter((asset) => !selected.includes(asset.symbol));
  }, [query, selected]);

  const addSymbol = (symbol: string) => {
    if (selected.includes(symbol) || selected.length >= MAX_ASSETS) return;
    setSelected((prev) => [...prev, symbol]);
    setQuery("");
  };

  const removeSymbol = (symbol: string) => {
    setSelected((prev) => prev.filter((s) => s !== symbol));
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              selected.length >= MAX_ASSETS
                ? `Up to ${MAX_ASSETS} markets`
                : "Add a market to compare…"
            }
            disabled={selected.length >= MAX_ASSETS}
            className="pl-9"
          />
          {matches.length > 0 && (
            <div className="glass absolute z-10 mt-1.5 w-full overflow-hidden rounded-xl p-1">
              {matches.map((asset) => (
                <button
                  key={asset.symbol}
                  type="button"
                  onClick={() => addSymbol(asset.symbol)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-foreground/[0.06]"
                >
                  <span>{asset.name}</span>
                  <span className="font-mono text-[11px] uppercase text-muted-foreground">
                    {asset.ticker}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <Tabs value={timeframe} onValueChange={(value) => setTimeframe(value as Timeframe)}>
          <TabsList>
            {TIMEFRAME_ORDER.map((option) => (
              <TabsTrigger key={option} value={option}>
                {option}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {selected.map((symbol) => (
          <span
            key={symbol}
            className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-foreground/[0.03] py-1 pl-3 pr-1.5 text-xs font-medium"
          >
            {symbol}
            <button
              type="button"
              onClick={() => removeSymbol(symbol)}
              aria-label={`Remove ${symbol}`}
              className="rounded-full p-0.5 text-muted-foreground hover:bg-foreground/[0.08] hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>

      <div className="mt-8">
        {selected.length < 2 ? (
          <p className="text-sm text-muted-foreground">Add at least one more market to compare.</p>
        ) : loading && !result ? (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {selected.map((symbol) => (
              <Skeleton key={symbol} className="h-80 w-64 shrink-0 rounded-[var(--radius)]" />
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-bear">{error}</p>
        ) : result ? (
          <>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {result.rows.map((row) => (
                <ComparisonCard key={row.symbol} row={row} />
              ))}
            </div>

            {result.correlations.length > 0 && (
              <CorrelationMatrix result={result} />
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

function ComparisonCard({ row }: { row: ComparisonResult["rows"][number] }) {
  const strengthPct = Math.abs(row.strengthScore);
  const strengthPositive = row.strengthScore > 0;

  return (
    <Card className="w-64 shrink-0 p-5">
      <Link href={`/analysis/${row.symbol}`} className="block">
        <p className="truncate text-sm font-semibold leading-tight hover:underline">{row.name}</p>
        <p className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          {row.symbol}
        </p>
      </Link>

      <div className="mt-4 flex items-end justify-between gap-2">
        <span className="tabular text-lg font-semibold tracking-tight">
          {formatPrice(row.price, row.precision)}
        </span>
        <ChangePill value={row.changePercent} size="sm" />
      </div>

      <div className="mt-4 space-y-3 border-t border-border/60 pt-4 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Trend</span>
          <Badge
            variant={row.trend === "bullish" ? "bull" : row.trend === "bearish" ? "bear" : "neutral"}
          >
            {row.trend}
          </Badge>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Strength</span>
            <span className="tabular font-medium">
              {strengthPositive ? "+" : row.strengthScore < 0 ? "−" : ""}
              {strengthPct}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-foreground/[0.07]">
            <div
              className={cn(
                "h-full rounded-full",
                strengthPositive ? "bg-bull" : row.strengthScore < 0 ? "bg-bear" : "bg-muted-foreground",
              )}
              style={{ width: `${strengthPct}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Risk</span>
          <span className="font-medium">{REGIME_LABEL[row.volatilityRegime]}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Support</span>
          <span className="tabular font-medium">
            {row.supports.map((v) => formatPrice(v, row.precision)).join(", ") || "n/a"}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Resistance</span>
          <span className="tabular font-medium">
            {row.resistances.map((v) => formatPrice(v, row.precision)).join(", ") || "n/a"}
          </span>
        </div>
      </div>

      <p className="mt-4 line-clamp-5 border-t border-border/60 pt-3 text-xs leading-relaxed text-muted-foreground">
        {row.summary}
      </p>
    </Card>
  );
}

function correlationTone(value: number): "bull" | "bear" | "neutral" {
  if (value >= 0.5) return "bull";
  if (value <= -0.5) return "bear";
  return "neutral";
}

function CorrelationMatrix({ result }: { result: ComparisonResult }) {
  const symbols = result.rows.map((row) => row.symbol);
  const lookup = new Map<string, number>();
  for (const pair of result.correlations) {
    lookup.set(`${pair.a}:${pair.b}`, pair.value);
    lookup.set(`${pair.b}:${pair.a}`, pair.value);
  }

  return (
    <Card className="mt-6 overflow-x-auto p-5">
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Correlation · {TIMEFRAME_LABEL[result.timeframe]}
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
        Pearson correlation of daily log returns. Close to +1 means the two markets move together;
        close to −1 means they move opposite each other.
      </p>

      <table className="mt-4 min-w-full text-xs">
        <thead>
          <tr>
            <th className="p-2 text-left font-medium text-muted-foreground" />
            {symbols.map((symbol) => (
              <th key={symbol} className="p-2 text-center font-medium text-muted-foreground">
                {symbol}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {symbols.map((rowSymbol) => (
            <tr key={rowSymbol}>
              <th className="p-2 text-left font-medium text-muted-foreground">{rowSymbol}</th>
              {symbols.map((colSymbol) => {
                if (rowSymbol === colSymbol) {
                  return (
                    <td key={colSymbol} className="p-2 text-center text-muted-foreground">
                      —
                    </td>
                  );
                }
                const value = lookup.get(`${rowSymbol}:${colSymbol}`) ?? 0;
                return (
                  <td key={colSymbol} className="p-2 text-center">
                    <Badge variant={correlationTone(value)} className="tabular">
                      {value.toFixed(2)}
                    </Badge>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

const TIMEFRAME_LABEL: Record<Timeframe, string> = {
  "1D": "24 hours",
  "1W": "7 days",
  "1M": "30 days",
  "3M": "3 months",
  "1Y": "1 year",
};
