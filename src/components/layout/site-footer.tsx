import Link from "next/link";

import { Logo } from "@/components/layout/logo";
import { describeMarketDataSources } from "@/lib/market/provider";

const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Product",
    links: [
      { href: "/markets", label: "Markets" },
      { href: "/analysis", label: "Market Intelligence" },
      { href: "/watchlist", label: "Watchlist" },
      { href: "/news", label: "News" },
      { href: "/dashboard", label: "Dashboard" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/pricing", label: "Pricing" },
      { href: "/pricing#faq", label: "FAQ" },
      { href: "/sign-in", label: "Sign In" },
    ],
  },
];

export function SiteFooter() {
  // Attribution has to reflect what is actually wired up, not a hardcoded
  // claim — this footer previously said everything was simulated, which stopped
  // being true the moment a live source was configured.
  const liveSources = describeMarketDataSources().filter((s) => s.available);

  return (
    <footer className="mt-24 border-t border-border/60">
      <div className="container py-14">
        <div className="grid gap-10 md:grid-cols-[1.6fr_1fr_1fr]">
          <div className="max-w-sm">
            <Logo />
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              AI-assisted market research for Forex, Gold, Crypto, Stocks and
              Indices. We help you understand the market — we never tell you
              what to do with it.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.title}>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {column.title}
              </h2>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <hr className="rule my-10" />

        <div className="space-y-4 text-xs leading-relaxed text-muted-foreground">
          <p className="max-w-3xl">
            <strong className="font-semibold text-foreground/80">
              Important:
            </strong>{" "}
            DollarAndGold is a research and education platform. It is not a
            broker, not an exchange, and not a financial adviser. Nothing here is
            financial advice or a recommendation to buy or sell any instrument.
            Analysis is generated from historical price data and can be wrong.
            Trading carries risk, including the total loss of your capital. Do
            your own research and consider seeking advice from a licensed
            professional.
          </p>
          <p>
            {liveSources.length > 0 ? (
              <>
                Live market data is provided by{" "}
                {liveSources.map((s) => s.label).join(", ")}. Markets not
                covered by a configured source are simulated and labelled as
                such wherever they appear.
              </>
            ) : (
              <>
                No live market data source is configured on this deployment, so
                all prices are simulated and do not represent real quotes. Every
                simulated figure is labelled in the interface.
              </>
            )}
          </p>
          <p className="pt-2">
            © {new Date().getFullYear()} DollarAndGold. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
