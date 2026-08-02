import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dollarandgold.xyz";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Personal surfaces and API endpoints have nothing to index.
      disallow: ["/dashboard", "/sign-in", "/api/", "/ai-trader"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
