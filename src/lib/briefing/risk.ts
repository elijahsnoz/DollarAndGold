import type { VolatilityRegime } from "@/lib/ai/types";
import { formatPrice } from "@/lib/format";
import type { BehaviourInsight } from "@/lib/personalisation/types";
import type { RiskIntelligence, RiskLevel } from "./types";

/**
 * Risk Intelligence.
 *
 * Describes the conditions; never tells anyone what to do about them. "Reduce
 * your position size" is advice, and this platform does not give advice. "A
 * stop tighter than $54 will be hit by ordinary noise today" is a fact about
 * the market that leaves the decision where it belongs.
 *
 * The behavioural half is gated by the same evidence rules as everything else —
 * a risk warning drawn from four trades is worse than no warning, because it
 * teaches the user to discount the ones that are real.
 */

export interface MarketRiskInput {
  symbol: string;
  name: string;
  regime: VolatilityRegime;
  annualisedPct: number;
  atr: number;
  atrPercent: number;
  precision: number;
}

const REGIME_RANK: Record<VolatilityRegime, number> = {
  low: 0,
  normal: 1,
  elevated: 2,
  high: 3,
};

const LEVEL_BY_RANK: RiskLevel[] = ["calm", "normal", "elevated", "high"];

export function buildRiskIntelligence(
  markets: MarketRiskInput[],
  behavioural: BehaviourInsight | null,
): RiskIntelligence {
  if (markets.length === 0) {
    return {
      level: "normal",
      summary:
        "No markets on your desk yet, so there is no risk picture to report.",
      notes: [],
      behavioural,
    };
  }

  // The desk's risk is set by its most volatile market, not its average — an
  // average hides the one position capable of doing real damage.
  const worst = markets.reduce((a, b) =>
    REGIME_RANK[b.regime] > REGIME_RANK[a.regime] ? b : a,
  );
  const level = LEVEL_BY_RANK[REGIME_RANK[worst.regime]];

  const elevated = markets.filter(
    (m) => m.regime === "elevated" || m.regime === "high",
  );
  const compressed = markets.filter((m) => m.regime === "low");

  const summary =
    elevated.length > 0
      ? `${elevated.length === 1 ? `${elevated[0].name} is` : `${elevated.length} of your markets are`} in a higher-volatility environment than usual.`
      : compressed.length === markets.length
        ? "Your markets are unusually quiet. Compressed ranges tend to precede expansion rather than continue."
        : "Your markets are moving within their normal ranges.";

  const notes: string[] = [];

  // The single most practical number: what "ordinary noise" costs today.
  notes.push(
    `${worst.name} is currently moving about ${formatPrice(worst.atr, worst.precision)} (${worst.atrPercent.toFixed(2)}%) in a typical day. Any level closer than that to your entry will be reached by ordinary movement, independent of whether the direction is right.`,
  );

  if (elevated.length > 0) {
    notes.push(
      `Higher volatility widens both outcomes symmetrically. The same position carries more risk today than it did in a calmer week, even though nothing about the position changed.`,
    );
  }

  if (compressed.length > 0 && elevated.length === 0) {
    notes.push(
      `Quiet conditions make it tempting to size up to feel the same movement. That is the mechanism by which a calm week becomes an expensive one when range returns.`,
    );
  }

  return { level, summary, notes, behavioural };
}

/**
 * Pick the risk-relevant behaviour insight, if the user has earned one.
 * Only `watch-out` insights qualify — a strength is not a risk.
 */
export function selectBehaviouralRisk(
  insights: BehaviourInsight[],
): BehaviourInsight | null {
  const candidates = insights.filter((insight) => insight.kind === "watch-out");
  if (candidates.length === 0) return null;

  return candidates.reduce((a, b) =>
    b.evidence.observations > a.evidence.observations ? b : a,
  );
}
