import { NextResponse } from "next/server";

import { FEATURED_SYMBOLS, getAsset } from "@/lib/market/catalog";
import { getMarketDataProvider } from "@/lib/market/provider";

/** Quotes are always computed fresh — they are the live surface of the app. */
export const dynamic = "force-dynamic";

/**
 * GET /api/markets?symbols=XAUUSD,BTCUSD
 * Omit `symbols` for the nine featured markets.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requested = searchParams.get("symbols");

  const symbols = requested
    ? requested
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter((s) => getAsset(s))
    : [...FEATURED_SYMBOLS];

  if (symbols.length === 0) {
    return NextResponse.json(
      { error: "No valid symbols requested." },
      { status: 400 },
    );
  }

  try {
    const quotes = await getMarketDataProvider().getQuotes(symbols);
    return NextResponse.json({ quotes });
  } catch {
    return NextResponse.json(
      { error: "Unable to load market data." },
      { status: 502 },
    );
  }
}
