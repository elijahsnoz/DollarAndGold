import type { Metadata } from "next";

import { PageHeader } from "@/components/common/page-header";
import { MarketCatalog } from "@/components/markets/market-catalog";
import { ASSETS } from "@/lib/market/catalog";
import { summariseSources } from "@/lib/market/provenance";
import { getMarketSnapshots } from "@/lib/market/snapshot";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Markets",
  description:
    "Live prices, 24h change and trend across the whole catalog — forex, crypto, commodities, indices and equities.",
};

export default async function MarketsPage() {
  const snapshots = await getMarketSnapshots(ASSETS.map((asset) => asset.symbol));

  return (
    <div className="container py-12 sm:py-16">
      <PageHeader
        eyebrow="Markets"
        title="Live markets"
        lede="Price, 24-hour change and session range across the whole catalog. Open any market for its full market intelligence."
      />

      <div className="mt-10">
        <MarketCatalog snapshots={snapshots} />
      </div>

      <p className="mt-10 max-w-3xl text-xs leading-relaxed text-muted-foreground">
        {summariseSources(snapshots.map((s) => s.quote.source))}
      </p>
    </div>
  );
}
