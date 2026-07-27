"use client";

import * as React from "react";
import { AlertTriangle, CalendarClock, Loader2, Sparkles, Star } from "lucide-react";

import { PriceChart } from "@/components/charts/price-chart";
import { ChangePill } from "@/components/common/change-pill";
import { DataSourceBadge } from "@/components/common/data-source-badge";
import { Disclaimer } from "@/components/common/disclaimer";
import { IndicatorGrid } from "@/components/analysis/indicator-grid";
import { ScenarioCards } from "@/components/analysis/scenario-cards";
import { TrendVerdict } from "@/components/analysis/trend-verdict";
import { NewsCard } from "@/components/news/news-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { MarketAnalysis } from "@/lib/ai/types";
import { formatDateTime, formatPrice } from "@/lib/format";
import { ASSET_CLASS_LABEL } from "@/lib/market/catalog";
import { describeSource } from "@/lib/market/provenance";
import { TIMEFRAMES } from "@/lib/market/simulation";
import type { Asset, Candle, Timeframe } from "@/lib/market/types";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace/store";

const TIMEFRAME_ORDER: Timeframe[] = ["1D", "1W", "1M", "3M", "1Y"];

/**
 * The full analysis surface.
 *
 * The server renders the deterministic analysis so the page is complete on
 * first paint; this component then requests the narrated version in the
 * background and swaps the prose in when it lands. That way the AI layer
 * improves the page without ever being on the critical path — if it is slow,
 * unconfigured, or fails, the reader still has a full analysis.
 */
export function AnalysisView({
  asset,
  initialAnalysis,
  initialCandles,
  initialSeriesSource,
}: {
  asset: Asset;
  initialAnalysis: MarketAnalysis;
  initialCandles: Candle[];
  /** Which source produced `initialCandles`. Shown next to the chart. */
  initialSeriesSource?: string;
}) {
  const [timeframe, setTimeframe] = React.useState<Timeframe>(
    initialAnalysis.timeframe,
  );
  const [analysis, setAnalysis] = React.useState(initialAnalysis);
  const [candles, setCandles] = React.useState(initialCandles);
  const [seriesSource, setSeriesSource] = React.useState(initialSeriesSource);
  const [loading, setLoading] = React.useState(false);
  const [narrating, setNarrating] = React.useState(true);

  const { isWatched, toggleWatch, recordAnalysis } = useWorkspace();
  const watched = isWatched(asset.symbol);

  // Log the visit once per asset so the dashboard has a recent-analyses list.
  React.useEffect(() => {
    recordAnalysis({
      symbol: asset.symbol,
      assetName: asset.name,
      trend: initialAnalysis.trend.direction,
      confidence: initialAnalysis.trend.confidence,
      viewedAt: Date.now(),
    });
    // Intentionally keyed on the symbol alone — re-running on every trend
    // change would rewrite the entry on each poll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset.symbol]);

  // Load the requested timeframe. On first mount this also upgrades the prose.
  React.useEffect(() => {
    let cancelled = false;
    const isInitial = timeframe === initialAnalysis.timeframe;

    if (!isInitial) setLoading(true);
    setNarrating(true);

    (async () => {
      try {
        const [analysisResponse, seriesResponse] = await Promise.all([
          fetch(`/api/analysis/${asset.symbol}?timeframe=${timeframe}`, {
            cache: "no-store",
          }),
          fetch(`/api/markets/${asset.symbol}/series?timeframe=${timeframe}`, {
            cache: "no-store",
          }),
        ]);

        if (cancelled) return;

        if (seriesResponse.ok) {
          const data = (await seriesResponse.json()) as {
            series: { candles: Candle[]; source?: string };
          };
          setCandles(data.series.candles);
          // Provenance can differ per timeframe — a daily source may have
          // nothing to say about a 1D chart — so it is re-read on every load.
          setSeriesSource(data.series.source);
        }

        if (analysisResponse.ok) {
          const data = (await analysisResponse.json()) as {
            analysis: MarketAnalysis;
          };
          if (!cancelled) setAnalysis(data.analysis);
        }
      } catch {
        // Keep whatever is on screen — it is still a valid analysis.
      } finally {
        if (!cancelled) {
          setLoading(false);
          setNarrating(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [asset.symbol, timeframe, initialAnalysis.timeframe]);

  // Only the nearest level on each side is labelled — clustered levels can sit
  // a fraction of a percent apart, and their labels would collide. The Key
  // Levels panel below lists every level with its exact price and distance.
  const levels = React.useMemo(
    () => [
      ...analysis.resistances.slice(0, 2).map((value, index) => ({
        value,
        label:
          index === 0 ? `R ${formatPrice(value, asset.precision)}` : undefined,
        kind: "resistance" as const,
      })),
      ...analysis.supports.slice(0, 2).map((value, index) => ({
        value,
        label:
          index === 0 ? `S ${formatPrice(value, asset.precision)}` : undefined,
        kind: "support" as const,
      })),
    ],
    [analysis.resistances, analysis.supports, asset.precision],
  );

  return (
    <div className="space-y-8">
      {/* --- Header --- */}
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <div className="flex items-center gap-2.5">
            <Badge variant="outline">{ASSET_CLASS_LABEL[asset.assetClass]}</Badge>
            <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              {asset.symbol}
            </span>
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            {asset.name}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {asset.description}
          </p>
        </div>

        <div className="flex flex-col items-start gap-3 sm:items-end">
          <div className="flex items-baseline gap-3">
            <span className="tabular text-3xl font-semibold tracking-tight">
              {formatPrice(analysis.price, asset.precision)}
            </span>
            <ChangePill value={analysis.changePercent} size="lg" />
          </div>
          <Button
            variant={watched ? "secondary" : "outline"}
            size="sm"
            onClick={() => toggleWatch(asset.symbol)}
            aria-pressed={watched}
          >
            <Star className={cn("h-4 w-4", watched && "fill-gold text-gold")} />
            {watched ? "In watchlist" : "Add to watchlist"}
          </Button>
        </div>
      </div>

      {/* --- Chart --- */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h2 className="text-sm font-medium text-muted-foreground">
              Price · last {TIMEFRAMES[timeframe].label}
            </h2>
            <DataSourceBadge source={seriesSource} size="sm" />
            {loading && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            )}
          </div>

          <Tabs
            value={timeframe}
            onValueChange={(value) => setTimeframe(value as Timeframe)}
          >
            <TabsList>
              {TIMEFRAME_ORDER.map((option) => (
                <TabsTrigger key={option} value={option}>
                  {option}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <PriceChart
          candles={candles}
          timeframe={timeframe}
          precision={asset.precision}
          levels={levels}
          height={340}
          className="mt-5"
        />
      </Card>

      {/* --- Verdict + levels --- */}
      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <TrendVerdict trend={analysis.trend} />

        <div className="space-y-4">
          <LevelsPanel
            supports={analysis.supports}
            resistances={analysis.resistances}
            price={analysis.price}
            precision={asset.precision}
          />

          <Card className="p-6">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Volatility
            </p>
            <p className="tabular mt-2 text-2xl font-semibold tracking-tight">
              {analysis.volatility.annualisedPct.toFixed(1)}%
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                annualised · {analysis.volatility.regime}
              </span>
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {analysis.volatility.description}
            </p>
          </Card>
        </div>
      </div>

      {/* --- Summary --- */}
      <Card className="p-6">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-gold" />
          <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            Summary
          </h2>
          <Badge variant="outline" className="ml-auto">
            {narrating && analysis.narrator === "rules" ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Writing
              </>
            ) : analysis.narrator === "claude" ? (
              "Written by Claude"
            ) : (
              "Rules engine"
            )}
          </Badge>
        </div>

        <div className="mt-4 space-y-4">
          {narrating && analysis.narrator === "rules" ? (
            <div className="space-y-2.5">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-[92%]" />
              <Skeleton className="h-4 w-[97%]" />
              <Skeleton className="h-4 w-[70%]" />
            </div>
          ) : (
            analysis.summary
              .split(/\n{2,}/)
              .map((paragraph, index) => (
                <p key={index} className="leading-relaxed">
                  {paragraph}
                </p>
              ))
          )}
        </div>
      </Card>

      {/* --- Indicators --- */}
      <section>
        <h2 className="text-lg font-semibold tracking-tight">
          Technical indicators
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Computed from {candles.length} bars over the last{" "}
          {TIMEFRAMES[timeframe].label}.
        </p>
        <div className="mt-5">
          <IndicatorGrid indicators={analysis.indicators} />
        </div>
      </section>

      {/* --- Scenarios --- */}
      <section>
        <h2 className="text-lg font-semibold tracking-tight">
          Two ways this could go
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Both paths are shown with equal weight. Neither is a prediction.
        </p>
        <div className="mt-5">
          <ScenarioCards
            bullCase={analysis.bullCase}
            bearCase={analysis.bearCase}
          />
        </div>
      </section>

      {/* --- Risks and events --- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-6">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 text-gold" />
            <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
              Trading risks
            </h2>
          </div>
          <ul className="mt-4 space-y-3">
            {analysis.risks.map((risk) => (
              <li key={risk} className="flex gap-3 text-sm leading-relaxed">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-gold" />
                {risk}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2.5">
            <CalendarClock className="h-4 w-4 text-gold" />
            <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
              Key events to watch
            </h2>
          </div>
          <ul className="mt-4 space-y-3">
            {analysis.eventsToWatch.map((event) => (
              <li key={event} className="flex gap-3 text-sm leading-relaxed">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />
                {event}
              </li>
            ))}
          </ul>
          <p className="mt-5 border-t border-border/60 pt-4 text-xs leading-relaxed text-muted-foreground">
            What actually drives {asset.name}: {asset.drivers.join(", ")}.
          </p>
        </Card>
      </div>

      {/* --- News --- */}
      {analysis.news.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold tracking-tight">
            Latest market news
          </h2>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {analysis.news.map((article) => (
              <NewsCard key={article.id} article={article} compact />
            ))}
          </div>
        </section>
      )}

      <Disclaimer />

      <p className="text-xs leading-relaxed text-muted-foreground">
        Generated {formatDateTime(analysis.generatedAt)} ·{" "}
        {describeSource(seriesSource).description}
      </p>
    </div>
  );
}

function LevelsPanel({
  supports,
  resistances,
  price,
  precision,
}: {
  supports: number[];
  resistances: number[];
  price: number;
  precision: number;
}) {
  return (
    <Card className="p-6">
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Key levels
      </p>

      <div className="mt-4 space-y-4">
        <LevelRow
          label="Resistance"
          tone="bear"
          values={resistances}
          price={price}
          precision={precision}
        />
        <div className="flex items-center gap-3 rounded-xl bg-foreground/[0.04] px-3 py-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Price
          </span>
          <span className="tabular ml-auto font-semibold">
            {formatPrice(price, precision)}
          </span>
        </div>
        <LevelRow
          label="Support"
          tone="bull"
          values={supports}
          price={price}
          precision={precision}
        />
      </div>
    </Card>
  );
}

function LevelRow({
  label,
  tone,
  values,
  price,
  precision,
}: {
  label: string;
  tone: "bull" | "bear";
  values: number[];
  price: number;
  precision: number;
}) {
  if (values.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No clear {label.toLowerCase()} in this window.
      </p>
    );
  }

  return (
    <ul className="space-y-1.5">
      {values.map((value) => {
        const distance = ((value - price) / price) * 100;
        return (
          <li
            key={value}
            className="flex items-center gap-3 text-sm"
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                tone === "bull" ? "bg-bull" : "bg-bear",
              )}
            />
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              {label}
            </span>
            <span className="tabular ml-auto font-medium">
              {formatPrice(value, precision)}
            </span>
            <span className="tabular w-16 text-right text-xs text-muted-foreground">
              {distance > 0 ? "+" : ""}
              {distance.toFixed(2)}%
            </span>
          </li>
        );
      })}
    </ul>
  );
}
