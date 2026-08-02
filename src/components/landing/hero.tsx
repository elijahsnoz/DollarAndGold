import Link from "next/link";
import { Activity, ArrowRight } from "lucide-react";

import { WorldMap } from "@/components/landing/world-map";
import { Button } from "@/components/ui/button";
import { ASSETS } from "@/lib/market/catalog";

/**
 * Landing hero.
 *
 * The entrance is CSS-only on purpose. This is the most important content on
 * the site, and a JS-driven reveal means the headline is invisible until the
 * animation library has loaded and run — which is a bad trade for a crawler, a
 * slow connection, or any environment where that never happens. The keyframe
 * uses `both` fill, so the copy is visible at rest even if animation is
 * disabled entirely (as it is under `prefers-reduced-motion`).
 */
export function Hero() {
  return (
    <section className="aurora relative isolate overflow-hidden">
      {/* Decorative — fades out well before it reaches the copy. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 mx-auto h-[560px] max-w-6xl opacity-70">
        <WorldMap className="h-full w-full" />
      </div>
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,transparent_20%,hsl(var(--background))_75%)]" />

      <div className="container flex flex-col items-center pb-16 pt-20 text-center sm:pt-28">
        <div className="animate-fade-up" style={{ animationDelay: "40ms" }}>
          <span className="glass inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium text-muted-foreground">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-bull opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-bull" />
            </span>
            {ASSETS.length} markets · Live technical analysis
          </span>
        </div>

        <h1
          className="animate-fade-up mt-7 max-w-4xl text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl"
          style={{ animationDelay: "120ms" }}
        >
          <span className="text-gradient">AI-Powered</span>{" "}
          <span className="text-gradient-gold">Market Intelligence.</span>
        </h1>

        <p
          className="animate-fade-up mt-6 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg"
          style={{ animationDelay: "200ms" }}
        >
          Analyse Forex, Gold, Crypto, Stocks and Indices with AI before placing
          your next trade.
        </p>

        <div
          className="animate-fade-up mt-9 flex flex-col gap-3 sm:flex-row"
          style={{ animationDelay: "280ms" }}
        >
          <Button asChild size="lg">
            <Link href="/analysis">
              Start Analysing
              <ArrowRight />
            </Link>
          </Button>
          <Button asChild size="lg" variant="glass">
            <Link href="/markets">
              <Activity />
              Live Markets
            </Link>
          </Button>
        </div>

        <p
          className="animate-fade-up mt-6 text-xs text-muted-foreground"
          style={{ animationDelay: "360ms" }}
        >
          Research and education only. Not financial advice, and never a promise
          of profit.
        </p>
      </div>
    </section>
  );
}
