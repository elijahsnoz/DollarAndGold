import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AnalysisView } from "@/components/analysis/analysis-view";
import { analyseAsset } from "@/lib/ai/analysis";
import { getAsset } from "@/lib/market/catalog";
import { getMarketDataProvider } from "@/lib/market/provider";

/**
 * Rendered per request — prices change constantly, so there is nothing worth
 * caching. Deliberately no `generateStaticParams`: combined with
 * `force-dynamic` it prerendered a shell that answered unknown symbols with
 * HTTP 200 and the not-found body, which tells a crawler the page exists.
 * The catalog is discoverable through `sitemap.ts` instead.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ symbol: string }>;
}): Promise<Metadata> {
  const { symbol } = await params;
  const asset = getAsset(symbol);

  if (!asset) return { title: "Market not found" };

  return {
    title: `${asset.name} analysis`,
    description: `AI-assisted technical analysis for ${asset.name} (${asset.symbol}): trend, key support and resistance, RSI, MACD, volume, volatility and the risks in each scenario.`,
    alternates: { canonical: `/analysis/${asset.symbol}` },
  };
}

export default async function AnalysisDetailPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;
  const asset = getAsset(symbol);

  if (!asset) notFound();

  // The deterministic analysis renders immediately; the client requests the
  // narrated version afterwards so the AI call never blocks first paint.
  const [analysis, series] = await Promise.all([
    analyseAsset(asset.symbol, "3M"),
    getMarketDataProvider().getSeries(asset.symbol, "3M"),
  ]);

  return (
    <div className="container py-12 sm:py-16">
      <AnalysisView
        asset={asset}
        initialAnalysis={analysis}
        initialCandles={series.candles}
        initialSeriesSource={series.source}
      />
    </div>
  );
}
