import { NextResponse } from "next/server";
import { z } from "zod";

import { encryptSecret } from "@/lib/ai-trader/credentials";
import { getCurrentUser, requireAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  exchange: z.literal("bybit"),
  apiKey: z.string().min(1).max(500),
  apiSecret: z.string().min(1).max(500),
  environment: z.enum(["testnet", "live"]),
});

/**
 * GET /api/ai-trader/credentials — connection status only.
 * The key/secret never round-trip back to the browser once saved; this
 * route can only ever say whether a row exists and which environment it's
 * for, never the credential values themselves.
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

  const { data } = await gate.supabase
    .from("exchange_credentials")
    .select("exchange, environment")
    .eq("user_id", user.id)
    .eq("exchange", "bybit")
    .maybeSingle();

  return NextResponse.json({
    connected: Boolean(data),
    exchange: "bybit",
    environment: data?.environment ?? null,
  });
}

/**
 * POST /api/ai-trader/credentials — save (or replace) the admin's Bybit
 * credentials, encrypted before they ever reach Postgres.
 *
 * This does not call Bybit. It only stores the credentials securely for a
 * later phase to use — see the module doc on `lib/ai-trader/credentials.ts`.
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

  let apiKeyEncrypted: string;
  let apiSecretEncrypted: string;
  try {
    apiKeyEncrypted = encryptSecret(parsed.data.apiKey);
    apiSecretEncrypted = encryptSecret(parsed.data.apiSecret);
  } catch {
    return NextResponse.json(
      { error: "Credential storage isn't configured on this deployment yet." },
      { status: 503 },
    );
  }

  const { error } = await gate.supabase.from("exchange_credentials").upsert(
    {
      user_id: user.id,
      exchange: "bybit",
      environment: parsed.data.environment,
      api_key_encrypted: apiKeyEncrypted,
      api_secret_encrypted: apiSecretEncrypted,
    },
    { onConflict: "user_id,exchange" },
  );

  if (error) {
    // Logged, not swallowed — the most common cause is a Supabase project
    // that hasn't had the latest supabase/schema.sql run against it yet.
    console.error("[ai-trader] exchange_credentials upsert failed:", error);
    return NextResponse.json({ error: "Couldn't save those credentials." }, { status: 500 });
  }

  return NextResponse.json({ connected: true, environment: parsed.data.environment });
}
