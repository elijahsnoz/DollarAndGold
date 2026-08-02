import { NextResponse } from "next/server";

import { decryptSecret } from "@/lib/ai-trader/credentials";
import { BybitClient, type BybitEnvironment } from "@/lib/ai-trader/exchanges/bybit";
import { getCurrentUser, requireAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

/**
 * GET /api/ai-trader/balance — read-only wallet balance from Bybit.
 *
 * The only route that ever decrypts stored credentials. It calls Bybit and
 * returns numbers back to the browser — never the key or secret themselves,
 * encrypted or otherwise.
 */
export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
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

    const balance = await client.getWalletBalance();
    return NextResponse.json({ balance, environment: creds.environment });
  } catch (error) {
    console.error("[ai-trader] Bybit balance fetch failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to fetch balance from Bybit." },
      { status: 502 },
    );
  }
}
