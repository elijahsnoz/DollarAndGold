import { NextResponse } from "next/server";

import { getAsset } from "@/lib/market/catalog";
import { getMarketDataProvider } from "@/lib/market/provider";
import { TIMEFRAMES } from "@/lib/market/simulation";
import type { Timeframe } from "@/lib/market/types";

export const dynamic = "force-dynamic";

function parseTimeframe(value: string | null): Timeframe {
  return value && value in TIMEFRAMES ? (value as Timeframe) : "3M";
}

/** GET /api/markets/:symbol/series?timeframe=1D|1W|1M|3M|1Y */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await params;
  const asset = getAsset(symbol);

  if (!asset) {
    return NextResponse.json({ error: "Unknown symbol." }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const timeframe = parseTimeframe(searchParams.get("timeframe"));

  try {
    const series = await getMarketDataProvider().getSeries(
      asset.symbol,
      timeframe,
    );
    return NextResponse.json({ series });
  } catch {
    return NextResponse.json(
      { error: "Unable to load price history." },
      { status: 502 },
    );
  }
}
