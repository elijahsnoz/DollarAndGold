import type {
  IndicatorReading,
  Timeframe,
  TrendDirection,
} from "@/lib/market/types";
import type { NewsArticle } from "@/lib/news/types";

export type VolatilityRegime = "low" | "normal" | "elevated" | "high";

export interface Scenario {
  title: string;
  /** What would have to happen for this path to open up. */
  trigger: string;
  /** Where price could travel if the trigger fires. Never a promise. */
  objective: string;
  /** What would invalidate the scenario. */
  invalidation: string;
  narrative: string;
}

export interface TrendVerdict {
  direction: TrendDirection;
  /** 0–100. Agreement across indicators, not a probability of profit. */
  confidence: number;
  headline: string;
  /** The individual signals that produced the verdict, for transparency. */
  contributions: { label: string; signal: TrendDirection; weight: number }[];
}

export interface VolatilityProfile {
  annualisedPct: number;
  atr: number;
  atrPercent: number;
  regime: VolatilityRegime;
  description: string;
}

export interface MarketAnalysis {
  symbol: string;
  assetName: string;
  timeframe: Timeframe;
  generatedAt: number;
  price: number;
  changePercent: number;
  trend: TrendVerdict;
  supports: number[];
  resistances: number[];
  indicators: IndicatorReading[];
  volatility: VolatilityProfile;
  bullCase: Scenario;
  bearCase: Scenario;
  risks: string[];
  eventsToWatch: string[];
  news: NewsArticle[];
  summary: string;
  /** Which layer wrote the prose — surfaced in the UI for honesty. */
  narrator: "claude" | "rules";
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
}
