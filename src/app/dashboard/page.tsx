import type { Metadata } from "next";

import { PageHeader } from "@/components/common/page-header";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { buildDailyBriefing } from "@/lib/ai/briefing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "Your daily AI briefing, recent analyses, watchlist, alerts, notes, trading journal and performance insights.",
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  const briefing = await buildDailyBriefing();

  return (
    <div className="container py-12 sm:py-16">
      <PageHeader
        eyebrow="Dashboard"
        title="Your workspace"
        lede="Where the briefing, your saved markets, your notes and your own record of what you actually did all sit in one place."
      />

      <div className="mt-10">
        <DashboardView briefing={briefing} />
      </div>
    </div>
  );
}
