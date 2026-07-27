import type { Metadata } from "next";

import { PageHeader } from "@/components/common/page-header";
import { MarketGrid } from "@/components/markets/market-grid";
import { FEATURED_SYMBOLS } from "@/lib/market/catalog";
import { summariseSources } from "@/lib/market/provenance";
import { getMarketSnapshots } from "@/lib/market/snapshot";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Markets",
  description:
    "Live prices, 24h change and trend for Gold, Bitcoin, Ethereum, EUR/USD, GBP/USD, USD/JPY, NASDAQ, S&P 500 and Oil.",
};

export default async function MarketsPage() {
  const snapshots = await getMarketSnapshots(FEATURED_SYMBOLS);

  return (
    <div className="container py-12 sm:py-16">
      <PageHeader
        eyebrow="Markets"
        title="Live markets"
        lede="Price, 24-hour change and session range across Forex, Gold, Crypto, Indices and Energy. Open any market for its full market intelligence."
      />

      <div className="mt-10">
        <MarketGrid snapshots={snapshots} />
      </div>

      <p className="mt-10 max-w-3xl text-xs leading-relaxed text-muted-foreground">
        {summariseSources(snapshots.map((s) => s.quote.source))}
      </p>
    </div>
  );
}
