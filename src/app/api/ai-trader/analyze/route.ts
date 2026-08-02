import { NextResponse } from "next/server";
import { z } from "zod";

import { detectSymbols } from "@/lib/ai/chat";
import { composeTradeAnalysis } from "@/lib/ai-trader/compose";
import { requireAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const BodySchema = z.object({
  question: z.string().min(1).max(500),
});

/**
 * POST /api/ai-trader/analyze — the AI Analysis panel's backend.
 *
 * Admin-gated independently of the page: a Next.js layout only protects
 * navigation, not the route handler itself, so this checks `is_admin` again
 * server-side — the same defense-in-depth the /admin API routes already use.
 */
export async function POST(request: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const [symbol] = detectSymbols(parsed.data.question);
  if (!symbol) {
    return NextResponse.json(
      { error: "Couldn't identify a market in that question. Try naming one directly, e.g. \"Analyze BTC\"." },
      { status: 422 },
    );
  }

  try {
    const analysis = await composeTradeAnalysis(symbol);
    if (!analysis) {
      return NextResponse.json({ error: "Unknown market." }, { status: 404 });
    }
    return NextResponse.json({ analysis });
  } catch {
    return NextResponse.json(
      { error: "Unable to generate analysis." },
      { status: 502 },
    );
  }
}
