import type { VolatilityRegime } from "@/lib/ai/types";
import { clamp } from "@/lib/utils";

/**
 * The Silence Engine.
 *
 * One question: does this deserve a person's attention this morning? Almost
 * always the honest answer is no, and a platform that cannot say so becomes
 * another feed — manufacturing significance daily until the user learns to skim
 * it, and then to skip it.
 *
 * The central idea is that **materiality is relative to how a market normally
 * behaves, never a fixed percentage**. A 2% day in EUR/USD is extraordinary; a
 * 2% day in Bitcoin is a Tuesday. Any threshold expressed in percent is
 * therefore wrong for most of the catalog at once. Scoring in units of the
 * asset's own Average True Range makes one rule correct everywhere: "this
 * market moved much more than it usually does" means the same thing for gold,
 * cable and Solana.
 *
 * The bar is deliberately high. Being wrong by staying quiet costs a user
 * nothing; being wrong by crying wolf costs them their trust in everything else
 * the platform says.
 */

/** Below this, an observation is not shown at all. */
export const MATERIALITY_FLOOR = 0.45;

export interface MaterialityVerdict {
  score: number;
  basis: string;
  material: boolean;
}

function verdict(score: number, basis: string): MaterialityVerdict {
  const bounded = clamp(score, 0, 1);
  return { score: bounded, basis, material: bounded >= MATERIALITY_FLOOR };
}

/**
 * How notable today's move is, measured in the market's own typical daily ranges.
 *
 * Under roughly one ATR is ordinary movement and scores below the floor no
 * matter how large the percentage looks.
 */
export function assessMove(
  changePercent: number,
  atrPercent: number,
): MaterialityVerdict {
  // Without a volatility reference there is no way to judge significance, and
  // guessing from the percentage alone is exactly the mistake this exists to
  // prevent. Stay silent instead.
  if (!Number.isFinite(atrPercent) || atrPercent <= 0) {
    return verdict(0, "no volatility reference available for this market");
  }

  const atrs = Math.abs(changePercent) / atrPercent;

  // Piecewise so that ~1 ATR lands just under the floor and ~1.5 clears it.
  const score =
    atrs < 1 ? atrs * 0.4 : atrs < 2 ? 0.4 + (atrs - 1) * 0.35 : 0.75 + (atrs - 2) * 0.12;

  return verdict(
    score,
    `moved ${atrs.toFixed(1)}× its typical daily range (${atrPercent.toFixed(2)}%)`,
  );
}

/**
 * How close price is to a level that has mattered before.
 *
 * Distance is measured in ATRs for the same reason as moves: "near" is a
 * different number for every market.
 */
export function assessLevelProximity(atrsAway: number): MaterialityVerdict {
  if (!Number.isFinite(atrsAway) || atrsAway < 0) {
    return verdict(0, "no level within range");
  }

  // Sitting on a level is the whole point; a full ATR away is just context.
  const score =
    atrsAway <= 0.25 ? 0.85 : atrsAway <= 0.5 ? 0.65 : atrsAway <= 1 ? 0.4 : 0.15;

  return verdict(score, `${atrsAway.toFixed(2)} typical daily ranges away`);
}

/**
 * A change in volatility regime is often more useful than any single move — it
 * changes what every position on the book is worth risking.
 */
export function assessVolatility(
  regime: VolatilityRegime,
  annualisedPct: number,
): MaterialityVerdict {
  const score =
    regime === "high" ? 0.8 : regime === "elevated" ? 0.55 : regime === "low" ? 0.5 : 0.2;

  const basis =
    regime === "low"
      ? `realised volatility is compressed at ${annualisedPct.toFixed(0)}% annualised`
      : `realised volatility is ${regime} at ${annualisedPct.toFixed(0)}% annualised`;

  return verdict(score, basis);
}

/**
 * Whether the whole briefing should stay quiet.
 *
 * Not simply "are there zero items" — a briefing scraping together three
 * barely-material observations is noise wearing a suit. Silence requires that
 * nothing cleared the floor.
 */
/** Capitalise a basis phrase when it has to open a sentence. */
export function asSentence(basis: string): string {
  return basis.charAt(0).toUpperCase() + basis.slice(1);
}

export function shouldStaySilent(scores: number[]): boolean {
  return scores.every((score) => score < MATERIALITY_FLOOR);
}

/**
 * Phrasing for a quiet morning.
 *
 * Confident, not apologetic. "Nothing important happened" is a finding the user
 * can act on — it means their attention is free today — and it should read that
 * way rather than as the platform failing to find something.
 */
export function quietMessage(marketCount: number): { headline: string; body: string } {
  return {
    headline: "Nothing needs your attention this morning",
    body:
      marketCount > 0
        ? `Your ${marketCount === 1 ? "market is" : `${marketCount} markets are`} moving within their normal ranges, with no levels close enough to matter. That is genuinely useful information: there is nothing here worth changing your plans for today.`
        : "There are no markets on your desk yet, so there is nothing to report. Star a few markets and this becomes your morning read.",
  };
}
