import type { Metadata } from "next";
import { AlertTriangle } from "lucide-react";

import { Disclaimer } from "@/components/common/disclaimer";
import { PageHeader } from "@/components/common/page-header";
import { TrendingTokenCard } from "@/components/markets/trending-token-card";
import { getTrendingTokens } from "@/lib/dex/geckoterminal";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Trending on-chain tokens",
  description:
    "Newly-launched and trending tokens on Solana DEXs, sourced from GeckoTerminal — unvetted, extremely high risk, and separate from DollarAndGold's curated market intelligence.",
  robots: { index: false, follow: true },
};

/**
 * Trending on-chain pools — deliberately not part of the curated catalog.
 * See `lib/dex/geckoterminal.ts` for why: these tokens can be minutes old
 * with no meaningful price history, so none of the deterministic analysis
 * engine's assumptions hold. This page reports raw on-chain numbers and
 * nothing else.
 */
export default async function TrendingTokensPage() {
  let tokens: Awaited<ReturnType<typeof getTrendingTokens>> = [];
  let loadError = false;

  try {
    tokens = await getTrendingTokens("solana");
  } catch {
    loadError = true;
  }

  return (
    <div className="container py-12 sm:py-16">
      <PageHeader
        eyebrow="Markets · Solana"
        title="Trending on-chain tokens"
        lede="Freshly-launched and trending pools on Solana DEXs, sourced from GeckoTerminal — not part of DollarAndGold's curated, analysed catalog."
      />

      <div className="mt-8 flex items-start gap-3 rounded-2xl border border-bear/30 bg-bear/10 p-4">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-bear" />
        <div>
          <p className="text-sm font-medium text-bear">
            Extremely high risk — read before continuing
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            These are unvetted tokens, often minutes to hours old. Most fail, and many are
            outright scams. There isn&apos;t enough price history for RSI, MACD, or support and
            resistance to mean anything, so none of DollarAndGold&apos;s technical analysis
            applies here — only the raw on-chain numbers below.
          </p>
        </div>
      </div>

      <div className="mt-10">
        {loadError ? (
          <p className="text-sm text-muted-foreground">
            Couldn&apos;t load trending tokens from GeckoTerminal right now. Try again shortly.
          </p>
        ) : tokens.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing trending right now.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tokens.map((token) => (
              <TrendingTokenCard key={token.id} token={token} />
            ))}
          </div>
        )}
      </div>

      <Disclaimer className="mt-10" />
    </div>
  );
}
