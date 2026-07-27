"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Loader2, Newspaper, Search, TrendingUp } from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ASSET_CLASS_LABEL, getFeaturedAssets } from "@/lib/market/catalog";
import type { Asset } from "@/lib/market/types";
import type { NewsArticle } from "@/lib/news/types";

/**
 * Global search (⌘K).
 *
 * Queries hit `/api/search`, which covers markets and headlines in one pass.
 * Results are debounced rather than fired per keystroke, and the featured
 * markets show immediately so the palette is never empty on open.
 */
export function CommandSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [assets, setAssets] = React.useState<Asset[]>(() => getFeaturedAssets());
  const [articles, setArticles] = React.useState<NewsArticle[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;

    const trimmed = query.trim();
    if (!trimmed) {
      setAssets(getFeaturedAssets());
      setArticles([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("search failed");
        const data = (await response.json()) as {
          assets: Asset[];
          articles: NewsArticle[];
        };
        setAssets(data.assets);
        setArticles(data.articles);
      } catch {
        // Aborted or offline — leave the previous results on screen.
      } finally {
        setLoading(false);
      }
    }, 160);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, open]);

  React.useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl gap-0 overflow-hidden p-0" hideClose>
        <DialogTitle className="sr-only">Search DollarAndGold</DialogTitle>

        <Command shouldFilter={false} loop className="[&_[cmdk-group-heading]]:px-3">
          <div className="flex items-center gap-3 border-b border-border/70 px-4">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              autoFocus
              placeholder="Search markets, currencies, stocks, crypto and news…"
              className="h-14 w-full bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
            />
            {loading && (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
            )}
          </div>

          <Command.List className="max-h-[min(60vh,26rem)] overflow-y-auto p-2">
            <Command.Empty className="py-10 text-center text-sm text-muted-foreground">
              No markets or headlines match “{query}”.
            </Command.Empty>

            {assets.length > 0 && (
              <Command.Group
                heading={
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Markets
                  </span>
                }
              >
                {assets.map((asset) => (
                  <Command.Item
                    key={asset.symbol}
                    value={asset.symbol}
                    onSelect={() => go(`/analysis/${asset.symbol}`)}
                    className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm data-[selected=true]:bg-foreground/[0.07]"
                  >
                    <TrendingUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="font-medium">{asset.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {asset.ticker}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {ASSET_CLASS_LABEL[asset.assetClass]}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {articles.length > 0 && (
              <Command.Group
                heading={
                  <span className="mt-2 block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    News
                  </span>
                }
              >
                {articles.map((article) => (
                  <Command.Item
                    key={article.id}
                    value={article.id}
                    onSelect={() => go(`/news?story=${article.id}`)}
                    className="flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 text-sm data-[selected=true]:bg-foreground/[0.07]"
                  >
                    <Newspaper className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="line-clamp-2 leading-snug">
                      {article.headline}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>

          <div className="flex items-center justify-between border-t border-border/70 px-4 py-2.5 text-[11px] text-muted-foreground">
            <span>Enter to open · Esc to close</span>
            <span>Simulated market data</span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
