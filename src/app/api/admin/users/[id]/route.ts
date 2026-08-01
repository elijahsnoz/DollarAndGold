import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/supabase/server";

const BODY_SCHEMA = z
  .object({
    plan: z.enum(["free", "pro", "enterprise"]),
    is_admin: z.boolean(),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, "Empty request.");

/** PATCH /api/admin/users/:id — change a user's plan or admin access. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const parsed = BODY_SCHEMA.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { id } = await params;
  const { error } = await gate.supabase
    .from("profiles")
    .update(parsed.data)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Update failed." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
