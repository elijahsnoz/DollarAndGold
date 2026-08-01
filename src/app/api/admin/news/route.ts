import { NextResponse } from "next/server";

import { getCurrentUser, requireAdmin } from "@/lib/supabase/server";
import { ARTICLE_SCHEMA } from "./schema";

/** POST /api/admin/news — create a news article. */
export async function POST(request: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const parsed = ARTICLE_SCHEMA.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const user = await getCurrentUser();

  const { data, error } = await gate.supabase
    .from("news_articles")
    .insert({ ...parsed.data, created_by: user?.id ?? null })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Create failed." }, { status: 500 });
  }

  return NextResponse.json({ article: data });
}
