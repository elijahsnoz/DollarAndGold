import type { MarketAnalysis } from "@/lib/ai/types";
import type { MarketConditions, MarketStructure } from "./types";

/**
 * Pure derivation of a conditions snapshot from an already-computed analysis.
 *
 * Kept separate from `capture.ts` deliberately: that module reaches into the
 * analysis engine and the data provider, which are server-only. The analysis
 * page is a client component and needs this function, so importing it from
 * there must not drag the whole server chain into the browser bundle.
 *
 * This is also why research capture is free — every figure below has already
 * been computed to render the page.
 */

/** Market structure is already one of the weighted trend signals. */
function structureFrom(analysis: MarketAnalysis): MarketStructure {
  const contribution = analysis.trend.contributions.find(
    (entry) => entry.label === "Market structure",
  );

  if (contribution?.signal === "bullish") return "higher-highs";
  if (contribution?.signal === "bearish") return "lower-lows";
  return "range";
}

/** Nearest level to price, measured in typical daily ranges. */
function nearestLevelFrom(analysis: MarketAnalysis) {
  const atr = analysis.volatility.atr;
  if (!Number.isFinite(atr) || atr <= 0) return undefined;

  const candidates = [
    ...analysis.supports.map((level) => ({ kind: "support" as const, level })),
    ...analysis.resistances.map((level) => ({
      kind: "resistance" as const,
      level,
    })),
  ];

  if (candidates.length === 0) return undefined;

  return candidates
    .map((candidate) => ({
      ...candidate,
      atrsAway: Math.abs(candidate.level - analysis.price) / atr,
    }))
    .sort((a, b) => a.atrsAway - b.atrsAway)[0];
}

export function conditionsFromAnalysis(
  analysis: MarketAnalysis,
  source?: string,
): MarketConditions {
  return {
    symbol: analysis.symbol,
    capturedAt: analysis.generatedAt,
    price: analysis.price,
    volatilityRegime: analysis.volatility.regime,
    annualisedVolPct: analysis.volatility.annualisedPct,
    atrPercent: analysis.volatility.atrPercent,
    trend: analysis.trend.direction,
    trendConfidence: analysis.trend.confidence,
    structure: structureFrom(analysis),
    nearestLevel: nearestLevelFrom(analysis),
    source,
  };
}
