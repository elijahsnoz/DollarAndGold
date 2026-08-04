import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { Sparkline } from "@/components/charts/sparkline";
import { ChangePill } from "@/components/common/change-pill";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice } from "@/lib/format";
import { ASSETS, ASSET_CLASS_LABEL } from "@/lib/market/catalog";
import { getMarketSnapshots } from "@/lib/market/snapshot";
import type { AssetClass } from "@/lib/market/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Market Intelligence",
  description:
    "Choose a market for structured market intelligence: trend and confidence, key support and resistance, technical indicators, scenarios and risks.",
  alternates: { canonical: "/analysis" },
};

const CLASS_ORDER: AssetClass[] = [
  "commodity",
  "crypto",
  "forex",
  "index",
  "energy",
  "stock",
];

/**
 * Market picker.
 *
 * The header renders immediately and the quote grid streams in behind a
 * Suspense boundary declared here rather than in a `loading.tsx` — a segment
 * file would also wrap `[symbol]`, whose `notFound()` needs to set a 404 status
 * before anything flushes.
 */
export default function AnalysisIndexPage() {
  return (
    <div className="container py-12 sm:py-16">
      <PageHeader
        eyebrow="Market Intelligence"
        title="Which market do you want to understand?"
        lede="Pick any market for a full structured read: trend and confidence, the levels that matter, five indicator readings, both scenarios, and the risks in each."
      />

      <Suspense fallback={<PickerSkeleton />}>
        <MarketPicker />
      </Suspense>

      <div className="mt-14">
        <Badge variant="outline">
          Educational research only — never financial advice
        </Badge>
      </div>
    </div>
  );
}

async function MarketPicker() {
  const snapshots = await getMarketSnapshots(ASSETS.map((a) => a.symbol));

  const grouped = CLASS_ORDER.map((assetClass) => ({
    assetClass,
    items: snapshots.filter((s) => s.asset.assetClass === assetClass),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="mt-12 space-y-12">
      {grouped.map((group) => (
        <section key={group.assetClass}>
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {ASSET_CLASS_LABEL[group.assetClass]}
          </h2>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.items.map(({ asset, quote, spark }) => (
              <Link key={asset.symbol} href={`/analysis/${asset.symbol}`}>
                <Card interactive className="group h-full p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold leading-tight">
                        {asset.name}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                        {asset.ticker}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-gold" />
                  </div>

                  <div className="mt-3 flex items-end justify-between gap-3">
                    <span className="tabular text-lg font-semibold tracking-tight">
                      {formatPrice(quote.price, asset.precision)}
                    </span>
                    <ChangePill value={quote.changePercent} size="sm" />
                  </div>

                  <Sparkline
                    data={spark}
                    change={quote.change}
                    height={32}
                    className="mt-3"
                  />
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function PickerSkeleton() {
  return (
    <div className="mt-12 space-y-12">
      {Array.from({ length: 2 }).map((_, section) => (
        <div key={section}>
          <Skeleton className="h-3 w-24" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, card) => (
              <div key={card} className="glass rounded-[var(--radius)] p-4">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="mt-3 h-6 w-24" />
                <Skeleton className="mt-3 h-8 w-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
