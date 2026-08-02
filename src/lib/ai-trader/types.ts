import type { TrendDirection } from "@/lib/market/types";

/**
 * DollarAndGold AI (`/ai-trader`) domain types.
 *
 * A private, admin-only tool — distinct from the public research product's
 * "never recommend a trade" promise, which still governs every other page.
 * The same honesty rules still apply here, though: every number traces back
 * to the deterministic engine or is explicitly marked unavailable. Nothing is
 * invented to fill a field.
 */

export type TradeSignal = "buy" | "sell" | "hold";

/** One card on the Market Dashboard. */
export interface MarketCardData {
  symbol: string;
  name: string;
  ticker: string;
  precision: number;
  price: number;
  changePercent: number;
  trend: TrendDirection;
  /** 30–100, same scale and meaning as the rest of the app: indicator agreement, not a win rate. */
  confidence: number;
  signal: TradeSignal;
}

/** A deterministically-derived entry/stop/target — never an LLM guess. */
export interface SuggestedTrade {
  signal: TradeSignal;
  entry: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  riskRewardRatio: number | null;
  /** How the numbers above were reached, so the suggestion can be audited. */
  note: string;
}

export interface TradeAnalysis {
  symbol: string;
  assetName: string;
  precision: number;
  generatedAt: number;

  price: number;
  changePercent: number;

  trend: TrendDirection;
  confidenceScore: number;

  momentum: { value: string; interpretation: string };
  support: number[];
  resistance: number[];
  risk: { regime: string; description: string };
  volumeAnalysis: { value: string; interpretation: string };

  /** Why the trend reads the way it does — the weighted signals behind it. */
  reasons: string[];
  newsSummary: { headline: string; summary: string; impact: string }[];
  /** Reuses the existing risk engine's "events to watch" — not a live economic calendar yet. */
  macroEvents: string[];

  /** Genuinely not available without a live exchange connection — never fabricated. */
  whaleActivityNote: string;
  fundingRateNote: string;

  suggestion: SuggestedTrade;

  /** Which layer wrote `reasons`/`note` — same honesty pattern as the analysis pages. */
  narrator: "rules" | "claude";
}

export type ExchangeEnvironment = "testnet" | "live";

export interface ExchangeConnectionStatus {
  connected: boolean;
  exchange: "bybit";
  environment: ExchangeEnvironment | null;
}
