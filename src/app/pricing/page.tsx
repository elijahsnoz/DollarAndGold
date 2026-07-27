import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Free, Pro and Enterprise plans for AI-assisted market research across Forex, Gold, Crypto, Stocks and Indices.",
};

const PLANS = [
  {
    name: "Free",
    price: "$0",
    cadence: "forever",
    lede: "Enough to decide whether the analysis is any good.",
    cta: { label: "Start analysing", href: "/analysis" },
    features: [
      "Limited AI analyses per day",
      "Full watchlist",
      "News feed with AI summaries",
      "All nine core markets",
      "Trading journal and notes",
    ],
    featured: false,
  },
  {
    name: "Pro",
    price: "$29",
    cadence: "per month",
    lede: "For traders who look at the market every day.",
    cta: { label: "Upgrade to Pro", href: "/sign-in" },
    features: [
      "Unlimited AI analyses",
      "AI chat assistant with full market context",
      "Advanced indicators and longer history",
      "Portfolio tracking",
      "Price and level alerts",
      "Priority updates on new modules",
    ],
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    cadence: "annual",
    lede: "For desks, funds and platforms building on top of us.",
    cta: { label: "Talk to us", href: "/sign-in" },
    features: [
      "Team dashboards and shared watchlists",
      "Full API access",
      "White-label deployment",
      "Multi-user accounts and roles",
      "Custom market coverage",
      "Dedicated support",
    ],
    featured: false,
  },
];

const FAQ = [
  {
    q: "Is this financial advice?",
    a: "No. DollarAndGold is a research and education platform. It is not a broker, not an exchange, and not a financial adviser. Nothing on the platform is a recommendation to buy or sell anything, and we will never tell you what to do with your money.",
  },
  {
    q: "Will the AI tell me what will happen next?",
    a: "No, and you should be suspicious of anything that claims it can. What the analysis gives you is a structured read of what the market has been doing, the levels that would confirm or break that read, and the risks in each direction. The conclusion is yours.",
  },
  {
    q: "What does the confidence score mean?",
    a: "It measures how much the individual indicators agree with each other on that timeframe. High confidence means the signals are aligned, not that a trade is likely to be profitable. Those are very different things.",
  },
  {
    q: "Where does the market data come from?",
    a: "This deployment runs on a deterministic simulation so the product is fully explorable without a paid data licence. The data layer is a swappable adapter — connecting a live feed is one implementation, with no changes anywhere else in the app.",
  },
  {
    q: "Can I cancel?",
    a: "Yes, at any time, and you keep access until the end of the period you have paid for.",
  },
];

export default function PricingPage() {
  return (
    <div className="container py-12 sm:py-16">
      <PageHeader
        eyebrow="Pricing"
        title="Start free. Upgrade when it earns it."
        lede="Every plan gives you the same honest analysis. The paid tiers give you more of it, and the tools to act on your own research."
        className="text-center [&>div]:mx-auto [&>div]:text-center"
      />

      <div className="mt-14 grid gap-5 lg:grid-cols-3">
        {PLANS.map((plan) => (
          <Card
            key={plan.name}
            className={cn(
              "relative flex flex-col p-6",
              plan.featured && "border-gold/30",
            )}
          >
            {plan.featured && (
              <>
                <div className="pointer-events-none absolute inset-0 -z-10 rounded-[var(--radius)] bg-[radial-gradient(70%_50%_at_50%_0%,hsl(var(--gold)/0.12),transparent_70%)]" />
                <Badge variant="gold" className="absolute -top-3 left-6">
                  Most popular
                </Badge>
              </>
            )}

            <h2 className="text-lg font-semibold tracking-tight">{plan.name}</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">{plan.lede}</p>

            <p className="mt-6 flex items-baseline gap-2">
              <span className="text-4xl font-semibold tracking-tight">
                {plan.price}
              </span>
              <span className="text-sm text-muted-foreground">
                {plan.cadence}
              </span>
            </p>

            <Button
              asChild
              className="mt-6"
              variant={plan.featured ? "default" : "outline"}
            >
              <Link href={plan.cta.href}>{plan.cta.label}</Link>
            </Button>

            <ul className="mt-7 space-y-3 border-t border-border/60 pt-6">
              {plan.features.map((feature) => (
                <li key={feature} className="flex gap-3 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                  <span className="leading-relaxed text-muted-foreground">
                    {feature}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      <section id="faq" className="mx-auto mt-24 max-w-3xl scroll-mt-24">
        <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
          Questions worth asking
        </h2>

        <dl className="mt-10 space-y-8">
          {FAQ.map((item) => (
            <div key={item.q}>
              <dt className="text-[15px] font-semibold">{item.q}</dt>
              <dd className="mt-2 leading-relaxed text-muted-foreground">
                {item.a}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
