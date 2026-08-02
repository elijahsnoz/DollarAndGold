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
import { MarketCatalog } from "@/components/markets/market-catalog";
import { TickerTape } from "@/components/markets/ticker-tape";
import { Button } from "@/components/ui/button";
import { ASSETS } from "@/lib/market/catalog";
import { getMarketQuotes, getMarketSnapshots } from "@/lib/market/snapshot";
import type { AssetClass } from "@/lib/market/types";

/** Prices move constantly, so the landing page is rendered per request. */
export const dynamic = "force-dynamic";

// Every currency pair and crypto token in the catalog — the ticker is the
// surface built to show a large symbol set at a glance.
const TICKER_SYMBOLS = ASSETS.filter(
  (asset) => asset.assetClass === "forex" || asset.assetClass === "crypto",
).map((asset) => asset.symbol);

// A taste of every asset class, not just the majors — the grid below this
// is a preview, not the full catalog (that's /markets), so it draws a
// couple of markets from each class rather than defaulting to the same
// handful of large-cap names every time.
const PREVIEW_CLASS_ORDER: AssetClass[] = [
  "commodity",
  "crypto",
  "forex",
  "index",
  "energy",
  "stock",
];
const PREVIEW_SYMBOLS = PREVIEW_CLASS_ORDER.flatMap((assetClass) =>
  ASSETS.filter((asset) => asset.assetClass === assetClass)
    .slice(0, 2)
    .map((asset) => asset.symbol),
);

export default async function HomePage() {
  const [snapshots, tickerQuotes] = await Promise.all([
    getMarketSnapshots(PREVIEW_SYMBOLS),
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
            title="Across every asset class."
            lede="Prices update as you watch. Open any card for its full market intelligence."
          />
          <Button asChild variant="outline" className="shrink-0">
            <Link href="/markets">
              All {ASSETS.length} markets
              <ArrowRight />
            </Link>
          </Button>
        </div>

        <div className="mt-10">
          <MarketCatalog snapshots={snapshots} />
        </div>
      </section>

      <FeatureGrid />
      <HowItWorks />
      <Roadmap />
      <CtaBand />
    </>
  );
}
