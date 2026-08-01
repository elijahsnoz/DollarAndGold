import type { Metadata } from "next";

import { NewsAdminView } from "@/components/admin/news-view";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "News" };

export default async function AdminNewsPage() {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("news_articles")
    .select(
      "id, headline, source, category, symbols, summary, why_it_matters, impact_direction, impact_magnitude, impact_note, url, published, published_at",
    )
    .order("published_at", { ascending: false });

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">News</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Articles published here replace the sample feed, category by category.
        Anything left unpublished, or any category you haven&apos;t written for
        yet, keeps showing the bundled sample stories instead of going empty.
      </p>

      <div className="mt-6">
        <NewsAdminView articles={data ?? []} />
      </div>
    </div>
  );
}
