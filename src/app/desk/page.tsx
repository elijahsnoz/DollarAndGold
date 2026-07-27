import type { Metadata } from "next";

import { MarketDesk } from "@/components/desk/market-desk";

export const metadata: Metadata = {
  title: "Market Desk",
  description:
    "Your personalised daily market briefing: what deserves your attention today, your markets, your archive and the risk picture.",
  robots: { index: false, follow: false },
};

/**
 * The Market Desk.
 *
 * A page with almost nothing on it, because the work happens client-side: the
 * briefing folds in the user's notes, journal and derived profile, none of
 * which should be sent to a server to render a morning read.
 */
export default function DeskPage() {
  return (
    <div className="container max-w-4xl py-12 sm:py-16">
      <MarketDesk />
    </div>
  );
}
