"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";

import { NewsCard } from "@/components/news/news-card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NEWS_CATEGORIES, type NewsArticle, type NewsCategory } from "@/lib/news/types";

type Filter = NewsCategory | "all";

/**
 * The news feed with its category filter.
 *
 * All stories are delivered with the page and filtered client-side — the feed
 * is small enough that a round trip per tab would be slower than it is worth.
 */
export function NewsFeed({ articles }: { articles: NewsArticle[] }) {
  const searchParams = useSearchParams();
  const focusedId = searchParams.get("story");
  const [filter, setFilter] = React.useState<Filter>("all");

  const visible = React.useMemo(
    () =>
      filter === "all"
        ? articles
        : articles.filter((article) => article.category === filter),
    [articles, filter],
  );

  // Deep links from global search scroll the story into view.
  React.useEffect(() => {
    if (!focusedId) return;
    const element = document.getElementById(focusedId);
    element?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focusedId]);

  return (
    <div>
      <Tabs
        value={filter}
        onValueChange={(value) => setFilter(value as Filter)}
        className="overflow-x-auto"
      >
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          {NEWS_CATEGORIES.map((category) => (
            <TabsTrigger key={category.value} value={category.value}>
              {category.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {visible.length === 0 ? (
        <p className="mt-10 text-sm text-muted-foreground">
          No stories in this category right now.
        </p>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {visible.map((article) => (
            <NewsCard
              key={article.id}
              article={article}
              defaultOpen={article.id === focusedId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
