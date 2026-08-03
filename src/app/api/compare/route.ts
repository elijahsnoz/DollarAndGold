import { NextResponse } from "next/server";
import { z } from "zod";

import { buildComparison } from "@/lib/ai/compare";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const BodySchema = z.object({
  symbols: z.array(z.string().min(1).max(16)).min(2).max(6),
  timeframe: z.enum(["1D", "1W", "1M", "3M", "1Y"]).optional(),
});

/** POST /api/compare — trend, confidence, volatility, levels and correlation for 2-6 markets. */
export async function POST(request: Request) {
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Pick between 2 and 6 markets to compare." },
      { status: 400 },
    );
  }

  try {
    const comparison = await buildComparison(parsed.data.symbols, parsed.data.timeframe);
    if (comparison.rows.length < 2) {
      return NextResponse.json(
        { error: "Couldn't resolve enough valid markets to compare." },
        { status: 422 },
      );
    }
    return NextResponse.json({ comparison });
  } catch {
    return NextResponse.json(
      { error: "Unable to build the comparison right now." },
      { status: 502 },
    );
  }
}
