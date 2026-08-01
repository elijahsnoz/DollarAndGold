import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/supabase/server";
import { ARTICLE_UPDATE_SCHEMA } from "../schema";

/** PATCH /api/admin/news/:id — edit a news article, or toggle its publish state. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const parsed = ARTICLE_UPDATE_SCHEMA.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { id } = await params;
  const { data, error } = await gate.supabase
    .from("news_articles")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Update failed." }, { status: 500 });
  }

  return NextResponse.json({ article: data });
}

/** DELETE /api/admin/news/:id */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const { id } = await params;
  const { error } = await gate.supabase.from("news_articles").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Delete failed." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
