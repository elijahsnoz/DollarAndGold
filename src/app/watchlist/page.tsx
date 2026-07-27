import type { Metadata } from "next";

import { PageHeader } from "@/components/common/page-header";
import { WatchlistView } from "@/components/watchlist/watchlist-view";

export const metadata: Metadata = {
  title: "Watchlist",
  description:
    "Track the markets you actually trade. Pin favourites, set price alerts and jump straight into their market intelligence.",
};

export default function WatchlistPage() {
  return (
    <div className="container py-12 sm:py-16">
      <PageHeader
        eyebrow="Watchlist"
        title="The markets you're actually watching"
        lede="Pin the ones you care about most, set the levels worth knowing about, and open the analysis in one tap."
      />

      <div className="mt-10">
        <WatchlistView />
      </div>
    </div>
  );
}
