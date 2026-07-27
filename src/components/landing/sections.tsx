import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  Bot,
  Bell,
  BookOpen,
  Gauge,
  Globe2,
  Newspaper,
  ArrowRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Section heading with a consistent eyebrow / title / lede rhythm. */
export function SectionHeading({
  eyebrow,
  title,
  lede,
  align = "center",
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  lede?: string;
  align?: "center" | "left";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col",
        align === "center" ? "items-center text-center" : "items-start",
        className,
      )}
    >
      {eyebrow && (
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">
          {eyebrow}
        </p>
      )}
      <h2 className="mt-3 max-w-2xl text-balance text-2xl font-semibold tracking-tight sm:text-4xl">
        {title}
      </h2>
      {lede && (
        <p
          className={cn(
            "mt-4 max-w-2xl text-pretty leading-relaxed text-muted-foreground",
            align === "center" && "mx-auto",
          )}
        >
          {lede}
        </p>
      )}
    </div>
  );
}

const FEATURES = [
  {
    icon: Gauge,
    title: "Structured technical analysis",
    body: "Moving averages, RSI, MACD, volume and volatility computed from real price history — then explained in plain English, with a confidence reading that measures how much the indicators actually agree.",
  },
  {
    icon: BarChart3,
    title: "Support and resistance that mean something",
    body: "Levels come from clustered swing pivots weighted by how often price respected them, not from lines drawn by eye. Every level shows what would confirm it and what would break it.",
  },
  {
    icon: Newspaper,
    title: "News, summarised in 30 seconds",
    body: "Every story gets a short summary, why it matters, and the likely transmission channel into price — so you can tell a headline that moves markets from one that just fills a feed.",
  },
  {
    icon: Bot,
    title: "An assistant that reads your screen",
    body: "Ask why Bitcoin is falling or what RSI means. The assistant answers from the same computed readings the analysis pages use, so the numbers it quotes are the numbers you are looking at.",
  },
  {
    icon: AlertTriangle,
    title: "Risk stated up front",
    body: "Every analysis names what could invalidate it, which scheduled events could reprice the market, and how much room ordinary noise needs. Good analysis says how it could be wrong.",
  },
  {
    icon: Bell,
    title: "Watchlist and alerts",
    body: "Pin the markets you actually trade, set levels worth knowing about, and keep your notes and trade journal next to the analysis that prompted them.",
  },
];

export function FeatureGrid() {
  return (
    <section className="container py-20 sm:py-28">
      <SectionHeading
        eyebrow="What you get"
        title="Everything you need to form a view — and nothing that pretends to make it for you."
        lede="DollarAndGold is a research terminal, not a signal service. It shows you what the market is doing and what would change that, then gets out of the way."
      />

      <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => (
          <Card key={feature.title} interactive className="p-6">
            <span className="grid h-10 w-10 place-items-center rounded-xl border border-gold/25 bg-gold/10 text-gold">
              <feature.icon className="h-5 w-5" />
            </span>
            <h3 className="mt-4 text-[15px] font-semibold tracking-tight">
              {feature.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {feature.body}
            </p>
          </Card>
        ))}
      </div>
    </section>
  );
}

const STEPS = [
  {
    step: "01",
    title: "Pick a market",
    body: "Nine core markets across Forex, Gold, Crypto, Indices and Energy — plus stocks and more in search.",
  },
  {
    step: "02",
    title: "Read the analysis",
    body: "Trend and confidence, key levels, five indicator readings, a bullish and a bearish path, and the risks in each.",
  },
  {
    step: "03",
    title: "Decide for yourself",
    body: "Save it, note your own thesis, set an alert on the level that matters — and make your own call.",
  },
];

export function HowItWorks() {
  return (
    <section className="border-y border-border/60 bg-foreground/[0.015]">
      <div className="container py-20 sm:py-24">
        <SectionHeading
          eyebrow="How it works"
          title="Three steps, about ninety seconds."
        />

        <ol className="mt-14 grid gap-8 md:grid-cols-3">
          {STEPS.map((item) => (
            <li key={item.step} className="relative">
              <span className="font-mono text-xs font-semibold tracking-widest text-gold">
                {item.step}
              </span>
              <h3 className="mt-3 text-lg font-semibold tracking-tight">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {item.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const ROADMAP = [
  "Portfolio tracker",
  "Broker integrations",
  "AI strategy builder",
  "Economic calendar",
  "Social sentiment",
  "Whale tracker",
  "Token analysis",
  "Crypto scanner",
  "Mobile app",
  "Public API",
  "Marketplace",
];

export function Roadmap() {
  return (
    <section className="container py-20 sm:py-24">
      <SectionHeading
        eyebrow="What's next"
        title="Built to grow without being rebuilt."
        lede="The data, analysis and workspace layers are separate and swappable, so each of these plugs in as a module rather than a rewrite."
      />

      <ul className="mx-auto mt-10 flex max-w-3xl flex-wrap justify-center gap-2">
        {ROADMAP.map((item) => (
          <li
            key={item}
            className="rounded-full border border-border/70 bg-foreground/[0.03] px-3.5 py-1.5 text-[13px] text-muted-foreground"
          >
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CtaBand() {
  return (
    <section className="container pb-8">
      <Card className="relative overflow-hidden px-6 py-14 text-center sm:px-14">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_80%_at_50%_0%,hsl(var(--gold)/0.16),transparent_70%)]" />

        <span className="grid h-11 w-11 place-items-center rounded-2xl border border-gold/25 bg-gold/10 text-gold mx-auto">
          <Globe2 className="h-5 w-5" />
        </span>

        <h2 className="mx-auto mt-6 max-w-2xl text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
          Analyse the market before you trade it.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-pretty leading-relaxed text-muted-foreground">
          Free to start. No card, no broker account, no promises about what the
          market will do next.
        </p>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/analysis">
              Start Analysing
              <ArrowRight />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/pricing">
              <BookOpen />
              See pricing
            </Link>
          </Button>
        </div>
      </Card>
    </section>
  );
}
