import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, TriangleAlert } from "lucide-react";

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
  alternates: { canonical: "/markets" },
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

      {/* Deliberately understated, not another market card — this leads to a
          fundamentally different risk category and shouldn't look like more
          of the same curated catalog above. */}
      <Link
        href="/markets/trending"
        className="mt-10 flex items-center gap-3 rounded-2xl border border-border/60 p-4 text-sm text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
      >
        <TriangleAlert className="h-4 w-4 shrink-0 text-bear" />
        <span className="flex-1">
          Looking for newly-launched, trending on-chain tokens?{" "}
          <span className="font-medium text-foreground">Not part of this catalog</span> —
          unvetted, extremely high risk, and analysed differently.
        </span>
        <ArrowRight className="h-4 w-4 shrink-0" />
      </Link>
    </div>
  );
}
