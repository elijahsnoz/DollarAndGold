import { z } from "zod";

import { loadMarketContexts } from "@/lib/briefing/compose";
import { getAsset } from "@/lib/market/catalog";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const BodySchema = z.object({
  symbols: z
    .array(
      z.object({
        symbol: z.string().min(1).max(16),
        reason: z.string().max(120),
      }),
    )
    .min(1)
    // A desk is a handful of markets by design; a larger request is either a
    // mistake or an attempt to use this as a bulk data endpoint.
    .max(8),
});

/**
 * POST /api/desk — market context for the briefing.
 *
 * Takes only symbols. The user's notes, journal, profile and history stay in
 * the browser: composition is deliberately split so the server is never asked
 * anything more revealing than "what is gold doing". The personal half runs
 * client-side in `composeBriefing`.
 */
export async function POST(request: Request) {
  let parsed;
  try {
    parsed = BodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const symbols = parsed.symbols.filter((entry) => getAsset(entry.symbol));
  if (symbols.length === 0) {
    return Response.json({ error: "No known markets requested." }, { status: 400 });
  }

  try {
    const contexts = await loadMarketContexts(symbols);
    return Response.json(
      { contexts },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Unable to load market context." },
      { status: 502 },
    );
  }
}
