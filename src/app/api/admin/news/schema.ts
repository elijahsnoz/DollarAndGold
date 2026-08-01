import { z } from "zod";

/** Shared body schema for creating and editing news articles. */
export const ARTICLE_SCHEMA = z.object({
  headline: z.string().trim().min(1).max(200),
  source: z.string().trim().min(1).max(80),
  category: z.enum(["forex", "crypto", "stocks", "commodities", "economy"]),
  symbols: z.array(z.string().trim().min(1).max(16)).default([]),
  summary: z.string().trim().min(1).max(2000),
  why_it_matters: z.string().trim().min(1).max(2000),
  impact_direction: z.enum(["bullish", "bearish", "mixed"]),
  impact_magnitude: z.enum(["low", "moderate", "high"]),
  impact_note: z.string().trim().min(1).max(500),
  url: z.string().trim().url().nullable().optional(),
  published: z.boolean().default(true),
});

export const ARTICLE_UPDATE_SCHEMA = ARTICLE_SCHEMA.partial().refine(
  (body) => Object.keys(body).length > 0,
  "Empty request.",
);
