import { NextResponse } from "next/server";

import { analyseAsset } from "@/lib/ai/analysis";
import { narrateAnalysis } from "@/lib/ai/narrate";
import { getAsset } from "@/lib/market/catalog";
import { TIMEFRAMES } from "@/lib/market/simulation";
import type { Timeframe } from "@/lib/market/types";

export const dynamic = "force-dynamic";
/** Narration can take a few seconds; allow room before the platform cuts us off. */
export const maxDuration = 60;

/** GET /api/analysis/:symbol?timeframe=3M&narrate=false */
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
  const raw = searchParams.get("timeframe");
  const timeframe: Timeframe =
    raw && raw in TIMEFRAMES ? (raw as Timeframe) : "3M";

  try {
    const analysis = await analyseAsset(asset.symbol, timeframe);

    // `narrate=false` returns the deterministic version immediately, which the
    // analysis page uses for its first paint before upgrading the prose.
    if (searchParams.get("narrate") === "false") {
      return NextResponse.json({ analysis });
    }

    return NextResponse.json({ analysis: await narrateAnalysis(analysis) });
  } catch {
    return NextResponse.json(
      { error: "Unable to generate analysis." },
      { status: 502 },
    );
  }
}
