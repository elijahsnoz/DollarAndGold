import { ExternalLink } from "lucide-react";

import { ChangePill } from "@/components/common/change-pill";
import { Card } from "@/components/ui/card";
import { formatRelativeTime } from "@/lib/format";
import type { TrendingToken } from "@/lib/dex/geckoterminal";

function formatUsdCompact(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

/** Fixed decimals scaled to magnitude — a token at $0.0000049 needs more places than one at $340. */
function formatTokenPrice(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "$0.00";
  const abs = Math.abs(value);
  const decimals = abs >= 1 ? 4 : abs >= 0.01 ? 6 : 10;
  return `$${value.toFixed(decimals)}`;
}

/**
 * A trending on-chain pool — deliberately not styled like a catalog
 * MarketCard. Shows only what GeckoTerminal actually reports (liquidity,
 * volume, pool age, buy/sell counts), never a trend, confidence or signal —
 * there is no analysis engine behind these numbers.
 */
export function TrendingTokenCard({ token }: { token: TrendingToken }) {
  return (
    <a
      href={`https://www.geckoterminal.com/${token.network}/pools/${token.poolAddress}`}
      target="_blank"
      rel="noopener noreferrer"
    >
      <Card interactive className="h-full p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">
              {token.baseSymbol}
              <span className="text-muted-foreground"> / {token.quoteSymbol}</span>
            </p>
            <p className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              {token.dex}
            </p>
          </div>
          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </div>

        <div className="mt-4 flex items-end justify-between gap-3">
          <span className="tabular text-lg font-semibold tracking-tight">
            {formatTokenPrice(token.priceUsd)}
          </span>
          <ChangePill value={token.priceChangePercent24h} size="sm" />
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-2 gap-y-2 border-t border-border/60 pt-3 text-xs">
          <div>
            <dt className="text-muted-foreground">Liquidity</dt>
            <dd className="tabular font-medium">{formatUsdCompact(token.liquidityUsd)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">24h volume</dt>
            <dd className="tabular font-medium">{formatUsdCompact(token.volumeUsd24h)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Pool age</dt>
            <dd className="font-medium">
              {token.poolCreatedAt > 0 ? formatRelativeTime(token.poolCreatedAt) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">24h buys/sells</dt>
            <dd className="tabular font-medium">
              {token.buys24h}/{token.sells24h}
            </dd>
          </div>
        </dl>
      </Card>
    </a>
  );
}
