import { captureConditions } from "@/lib/context/capture";
import { getAsset } from "@/lib/market/catalog";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * GET /api/context/:symbol — a market conditions snapshot for right now.
 *
 * Called when a user records a trade or writes a note without an analysis
 * already on screen. Returns 200 with `conditions: null` rather than an error
 * when a snapshot cannot be taken: failing to capture context must never block
 * someone from saving their own work.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await params;
  const asset = getAsset(symbol);

  if (!asset) {
    return Response.json({ error: "Unknown symbol." }, { status: 404 });
  }

  const conditions = await captureConditions(asset.symbol);

  return Response.json(
    { conditions },
    { headers: { "Cache-Control": "no-store" } },
  );
}
