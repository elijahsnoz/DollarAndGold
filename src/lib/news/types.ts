export type NewsCategory =
  | "forex"
  | "crypto"
  | "stocks"
  | "commodities"
  | "economy";

export type ImpactDirection = "bullish" | "bearish" | "mixed";
export type ImpactMagnitude = "low" | "moderate" | "high";

export interface NewsImpact {
  direction: ImpactDirection;
  magnitude: ImpactMagnitude;
  /** One sentence on the likely transmission channel into price. */
  note: string;
}

export interface NewsArticle {
  id: string;
  headline: string;
  source: string;
  /** Unix ms. */
  publishedAt: number;
  category: NewsCategory;
  /** Catalog symbols this story is relevant to. */
  symbols: string[];
  /** The AI's 30-second read of the story. */
  summary: string;
  whyItMatters: string;
  impact: NewsImpact;
  url?: string;
}

export interface NewsProvider {
  readonly id: string;
  getArticles(options?: {
    category?: NewsCategory;
    symbol?: string;
    limit?: number;
  }): Promise<NewsArticle[]>;
}

export const NEWS_CATEGORIES: { value: NewsCategory; label: string }[] = [
  { value: "forex", label: "Forex" },
  { value: "crypto", label: "Crypto" },
  { value: "stocks", label: "Stocks" },
  { value: "commodities", label: "Commodities" },
  { value: "economy", label: "Global Economy" },
];
