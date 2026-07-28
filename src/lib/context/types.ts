import type { VolatilityRegime } from "@/lib/ai/types";
import type { TrendDirection } from "@/lib/market/types";

/**
 * The Market Context Engine.
 *
 * Records what the market was actually doing at the moment a user did
 * something — researched, opened a position, closed it, wrote a note. Nothing
 * here is interpreted; it is a recording, taken so that Learning Intelligence
 * can later emerge from evidence instead of assumption.
 *
 * The reason this has to exist *before* the learning layer: a claim like "your
 * losses cluster in high-volatility conditions" is unanswerable after the fact.
 * Volatility at the moment of entry is not recoverable from a trade record —
 * you would be re-deriving it from today's data and calling it history. Either
 * it was captured then, or the question cannot honestly be asked.
 *
 * Snapshots are immutable and never backfilled. A gap in the record is a gap;
 * inventing one would poison every conclusion drawn from the set.
 */

export type MarketStructure = "higher-highs" | "lower-lows" | "range";

/** What was true about a market at a single moment. */
export interface MarketConditions {
  symbol: string;
  capturedAt: number;
  price: number;

  volatilityRegime: VolatilityRegime;
  annualisedVolPct: number;
  /** Typical daily range as a percentage of price. */
  atrPercent: number;

  trend: TrendDirection;
  /** Indicator agreement at capture time, 0–100. Not a win probability. */
  trendConfidence: number;
  structure: MarketStructure;

  /** Nearest level and how far away it was, in typical daily ranges. */
  nearestLevel?: {
    kind: "support" | "resistance";
    level: number;
    atrsAway: number;
  };

  /**
   * Which data source produced these figures.
   *
   * Load-bearing for honesty: conditions captured against simulated prices
   * describe a market that does not exist, and must never be pooled with live
   * observations to draw conclusions about someone's real behaviour. The
   * learning layer filters on this rather than trusting the sample.
   */
  source?: string;
}

/** Why a snapshot was taken. */
export type CaptureOccasion =
  | "research"
  | "trade-open"
  | "trade-close"
  | "note";

export interface ContextSnapshot extends MarketConditions {
  occasion: CaptureOccasion;
}

const LIVE_SOURCES = new Set(["coingecko", "frankfurter", "twelvedata", "yahoo"]);

/**
 * Whether a snapshot is admissible as evidence about real market behaviour.
 * Simulated and price-anchored-simulated conditions are not.
 */
export function isEvidenceGrade(
  conditions: Pick<MarketConditions, "source"> | undefined,
): boolean {
  return Boolean(conditions?.source && LIVE_SOURCES.has(conditions.source));
}

/** Human-readable one-liner, used in memories and the journal. */
export function describeConditions(conditions: MarketConditions): string {
  const parts = [
    `${conditions.trend} trend`,
    `${conditions.volatilityRegime} volatility`,
  ];

  if (conditions.nearestLevel && conditions.nearestLevel.atrsAway <= 1) {
    parts.push(
      `near ${conditions.nearestLevel.kind} (${conditions.nearestLevel.atrsAway.toFixed(2)} ranges away)`,
    );
  }

  return parts.join(", ");
}
