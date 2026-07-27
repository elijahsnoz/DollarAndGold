import { NextResponse } from "next/server";

import { getNewsProvider } from "@/lib/news/provider";
import type { NewsCategory } from "@/lib/news/types";

export const revalidate = 300;

const VALID_CATEGORIES: NewsCategory[] = [
  "forex",
  "crypto",
  "stocks",
  "commodities",
  "economy",
];

/** GET /api/news?category=crypto&symbol=BTCUSD&limit=10 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const rawCategory = searchParams.get("category");
  const category = VALID_CATEGORIES.includes(rawCategory as NewsCategory)
    ? (rawCategory as NewsCategory)
    : undefined;

  const symbol = searchParams.get("symbol") ?? undefined;
  const limitParam = Number(searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : undefined;

  try {
    const articles = await getNewsProvider().getArticles({
      category,
      symbol,
      limit,
    });
    return NextResponse.json({ articles });
  } catch {
    return NextResponse.json({ error: "Unable to load news." }, { status: 502 });
  }
}
