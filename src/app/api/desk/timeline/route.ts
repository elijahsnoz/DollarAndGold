import { z } from "zod";

import { loadTodayTimelines, loadWeeklyTimelines } from "@/lib/briefing/cadence";
import { getAsset } from "@/lib/market/catalog";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const BodySchema = z.object({
  symbols: z.array(z.string().min(1).max(16)).min(1).max(8),
  window: z.enum(["today", "week"]),
});

/**
 * POST /api/desk/timeline — Watchlist Intelligence's market data half.
 *
 * Same privacy split as `/api/desk`: only symbols in, timeline events out.
 * Nothing about which markets are on a watchlist versus a desk, or why,
 * reaches the server.
 */
export async function POST(request: Request) {
  let parsed;
  try {
    parsed = BodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const symbols = parsed.symbols.filter((symbol) => getAsset(symbol));
  if (symbols.length === 0) {
    return Response.json({ error: "No known markets requested." }, { status: 400 });
  }

  try {
    const eventsBySymbol =
      parsed.window === "today"
        ? await loadTodayTimelines(symbols)
        : await loadWeeklyTimelines(symbols);

    return Response.json(
      { eventsBySymbol },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Unable to load timeline data." },
      { status: 502 },
    );
  }
}
