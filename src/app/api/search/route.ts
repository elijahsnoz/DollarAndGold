import { NextResponse } from "next/server";

import { searchAssets } from "@/lib/market/catalog";
import { getNewsProvider } from "@/lib/news/provider";

export const dynamic = "force-dynamic";

/** GET /api/search?q=gold — searches markets and headlines in one pass. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim();

  const assets = searchAssets(query, 6);

  const allArticles = await getNewsProvider().getArticles();
  const needle = query.toLowerCase();
  const articles = needle
    ? allArticles
        .filter(
          (a) =>
            a.headline.toLowerCase().includes(needle) ||
            a.summary.toLowerCase().includes(needle),
        )
        .slice(0, 4)
    : [];

  return NextResponse.json({ assets, articles });
}
