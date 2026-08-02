import { NextResponse } from "next/server";
import { z } from "zod";

import { bybitSymbolFor } from "@/lib/ai-trader/bybit-symbol-map";
import { decryptSecret } from "@/lib/ai-trader/credentials";
import { BybitClient, type BybitEnvironment } from "@/lib/ai-trader/exchanges/bybit";
import { getCurrentUser, requireAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

const BodySchema = z.object({
  symbol: z.string().min(1).max(16),
  side: z.enum(["buy", "sell"]),
  qty: z.number().positive(),
  stopLoss: z.number().positive().optional(),
  takeProfit: z.number().positive().optional(),
});

/**
 * POST /api/ai-trader/orders — the only route that places a real order.
 *
 * Every trade this app has ever placed goes through here, because this is
 * the one place credentials get decrypted for a write (not just a balance
 * read). There is no automatic path into this route yet — the AI Analysis
 * panel's "Approve Trade" button is the only caller, so every order today
 * was a human clicking a button after seeing the exact entry/stop/target.
 */
export async function POST(request: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const bybitSymbol = bybitSymbolFor(parsed.data.symbol);
  if (!bybitSymbol) {
    return NextResponse.json(
      { error: "That market isn't tradable on Bybit." },
      { status: 422 },
    );
  }

  const { data: creds } = await gate.supabase
    .from("exchange_credentials")
    .select("api_key_encrypted, api_secret_encrypted, environment")
    .eq("user_id", user.id)
    .eq("exchange", "bybit")
    .maybeSingle();

  if (!creds) {
    return NextResponse.json({ error: "No Bybit credentials saved yet." }, { status: 404 });
  }

  try {
    const client = new BybitClient({
      apiKey: decryptSecret(creds.api_key_encrypted),
      apiSecret: decryptSecret(creds.api_secret_encrypted),
      environment: creds.environment as BybitEnvironment,
    });

    const order = await client.placeOrder({
      symbol: bybitSymbol,
      side: parsed.data.side === "buy" ? "Buy" : "Sell",
      qty: parsed.data.qty.toString(),
      stopLoss: parsed.data.stopLoss?.toString(),
      takeProfit: parsed.data.takeProfit?.toString(),
    });

    return NextResponse.json({ order, environment: creds.environment });
  } catch (error) {
    console.error("[ai-trader] Bybit order placement failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to place that order on Bybit." },
      { status: 502 },
    );
  }
}
