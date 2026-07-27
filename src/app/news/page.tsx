import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/common/page-header";
import { NewsFeed } from "@/components/news/news-feed";
import { Skeleton } from "@/components/ui/skeleton";
import { getNewsProvider } from "@/lib/news/provider";

export const metadata: Metadata = {
  title: "News",
  description:
    "Forex, crypto, stocks, commodities and global economy headlines — each with a 30-second AI summary, why it matters, and the likely market impact.",
};

export default async function NewsPage() {
  const articles = await getNewsProvider().getArticles();

  return (
    <div className="container py-12 sm:py-16">
      <PageHeader
        eyebrow="News"
        title="What moved, and why it matters"
        lede="Every story carries a 30-second summary, the reason it matters, and the likely channel into price — so you can tell a market-moving headline from noise."
      />

      <div className="mt-10">
        <Suspense fallback={<FeedSkeleton />}>
          <NewsFeed articles={articles} />
        </Suspense>
      </div>

      <p className="mt-10 text-xs text-muted-foreground">
        Headlines on this deployment are an editorial sample set written to
        demonstrate the summary format. They are not a live newswire.
      </p>
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="glass space-y-3 rounded-[var(--radius)] p-5">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-4 w-[92%]" />
          <Skeleton className="h-4 w-[78%]" />
        </div>
      ))}
    </div>
  );
}
