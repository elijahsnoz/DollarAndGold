import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";

import { AppProviders } from "@/components/layout/app-providers";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ChatDock } from "@/components/chat/chat-dock";
import "./globals.css";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// Prices, tickers and indicator readouts all render in mono so digits align.
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dollarandgold.xyz";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "DollarAndGold — AI-Powered Market Intelligence",
    template: "%s · DollarAndGold",
  },
  description:
    "AI-powered market intelligence for Forex, Gold, Crypto, Stocks and Indices — structured technical analysis, news summaries and risk context. Not financial advice.",
  keywords: [
    "market analysis",
    "AI trading research",
    "forex analysis",
    "gold price analysis",
    "crypto market intelligence",
    "technical analysis",
  ],
  authors: [{ name: "DollarAndGold" }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "DollarAndGold",
    title: "DollarAndGold — AI-Powered Market Intelligence",
    description:
      "Analyse Forex, Gold, Crypto, Stocks and Indices with AI before placing your next trade.",
  },
  twitter: {
    card: "summary_large_image",
    title: "DollarAndGold — AI-Powered Market Intelligence",
    description:
      "Analyse Forex, Gold, Crypto, Stocks and Indices with AI before placing your next trade.",
  },
  robots: { index: true, follow: true },
};

const ORGANIZATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "DollarAndGold",
  url: SITE_URL,
  logo: `${SITE_URL}/icon.png`,
  description:
    "AI-powered market intelligence for Forex, Gold, Crypto, Stocks and Indices.",
};

const WEBSITE_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "DollarAndGold",
  url: SITE_URL,
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#08090c" },
    { media: "(prefers-color-scheme: light)", color: "#fbfcfd" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-dvh">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_JSON_LD) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_JSON_LD) }}
        />
        <AppProviders>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:text-primary-foreground"
          >
            Skip to content
          </a>

          <div className="relative flex min-h-dvh flex-col">
            <SiteHeader />
            <main id="main" className="flex-1">
              {children}
            </main>
            <SiteFooter />
          </div>

          <ChatDock />
        </AppProviders>
      </body>
    </html>
  );
}
