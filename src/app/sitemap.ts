import type { MetadataRoute } from "next";

import { ASSETS } from "@/lib/market/catalog";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dollarandgold.xyz";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = [
    { path: "", priority: 1 },
    { path: "/markets", priority: 0.9 },
    { path: "/analysis", priority: 0.9 },
    { path: "/news", priority: 0.8 },
    { path: "/watchlist", priority: 0.5 },
    { path: "/pricing", priority: 0.7 },
  ];

  const now = new Date();

  return [
    ...staticRoutes.map((route) => ({
      url: `${SITE_URL}${route.path}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: route.priority,
    })),
    ...ASSETS.map((asset) => ({
      url: `${SITE_URL}/analysis/${asset.symbol}`,
      lastModified: now,
      changeFrequency: "hourly" as const,
      priority: 0.8,
    })),
  ];
}
