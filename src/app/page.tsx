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
import { FEATURED_SYMBOLS } from "@/lib/market/catalog";
import { getMarketSnapshots } from "@/lib/market/snapshot";

/** Prices move constantly, so the landing page is rendered per request. */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const snapshots = await getMarketSnapshots(FEATURED_SYMBOLS);

  return (
    <>
      <Hero />

      <TickerTape snapshots={snapshots} />

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
