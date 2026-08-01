import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Hero } from "@/components/landing/hero";
import {
  CtaBand,
  FeatureGrid,
  HowItWorks,
  Roadmap,
  SectionHeading,
} from "@/components/landing/sections";
import { MarketGrid } from "@/components/markets/market-grid";
import { TickerTape } from "@/components/markets/ticker-tape";
import { Button } from "@/components/ui/button";
import { ASSETS, FEATURED_SYMBOLS } from "@/lib/market/catalog";
import { getMarketQuotes, getMarketSnapshots } from "@/lib/market/snapshot";

/** Prices move constantly, so the landing page is rendered per request. */
export const dynamic = "force-dynamic";

// Every currency pair and crypto token in the catalog — the ticker is the
// surface built to show a large symbol set at a glance, so it isn't limited
// to the nine featured markets the way the grid below deliberately is.
const TICKER_SYMBOLS = ASSETS.filter(
  (asset) => asset.assetClass === "forex" || asset.assetClass === "crypto",
).map((asset) => asset.symbol);

export default async function HomePage() {
  const [snapshots, tickerQuotes] = await Promise.all([
    getMarketSnapshots(FEATURED_SYMBOLS),
    getMarketQuotes(TICKER_SYMBOLS),
  ]);

  return (
    <>
      <Hero />

      <TickerTape snapshots={tickerQuotes} />

      <section className="container py-20 sm:py-24">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading
            align="left"
            eyebrow="Live markets"
            title="Nine markets, one view."
            lede="Prices update as you watch. Open any card for its full market intelligence."
          />
          <Button asChild variant="outline" className="shrink-0">
            <Link href="/markets">
              All markets
              <ArrowRight />
            </Link>
          </Button>
        </div>

        <div className="mt-10">
          <MarketGrid snapshots={snapshots.slice(0, 6)} />
        </div>
      </section>

      <FeatureGrid />
      <HowItWorks />
      <Roadmap />
      <CtaBand />
    </>
  );
}
