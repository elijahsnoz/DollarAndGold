import { getNewsProvider } from "@/lib/news/provider";
import type { NewsArticle } from "@/lib/news/types";

/** News Agent: the AI Analysis panel's news half. Thin on purpose — the real logic already lives in the news provider. */
export function loadRelevantNews(symbol: string, limit = 3): Promise<NewsArticle[]> {
  return getNewsProvider().getArticles({ symbol, limit });
}
