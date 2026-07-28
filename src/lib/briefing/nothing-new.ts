/**
 * Nothing New — the vocabulary of honest absence.
 *
 * Centralised so that "we have nothing for you" sounds deliberate everywhere it
 * appears, rather than improvised per surface. Absence is a finding this
 * product is willing to report, and it has to read that way: confident, brief,
 * and never apologetic.
 *
 * Three rules hold across every message here:
 *
 *  1. **State what was checked.** "Nothing needs your attention" is a claim;
 *     "we looked at 12 observations across your 4 markets and none met the bar"
 *     is a claim with a warrant behind it. The second earns trust the first
 *     spends.
 *  2. **Never apologise, never pad.** No "unfortunately", no "check back
 *     later", no filler to make the surface look busy. A quiet morning means
 *     the user's attention is free, which is worth saying plainly.
 *  3. **Distinguish "nothing happened" from "we don't know yet".** They are
 *     completely different statements and conflating them is a lie in one
 *     direction or the other.
 */

export type AbsenceKind =
  /** We looked and there was genuinely nothing of note. */
  | "quiet"
  /** There is not yet enough history to say anything. */
  | "insufficient-history"
  /** A pattern exists but has not cleared the evidence bar. */
  | "still-developing"
  /** We cannot answer this at all. */
  | "unknown";

export interface AbsenceMessage {
  headline: string;
  body: string;
}

/** Nothing on the desk needs attention today. */
export function nothingToday(
  marketCount: number,
  considered: number,
): AbsenceMessage {
  if (marketCount === 0) {
    return {
      headline: "No markets on your desk yet",
      body: "Star a few markets and this becomes your morning read.",
    };
  }

  return {
    headline: "Nothing currently requires your attention",
    body: `Your ${marketCount === 1 ? "market is" : `${marketCount} markets are`} moving within normal ranges, with no levels close enough to matter.${
      considered > 0
        ? ` ${considered} observations were checked; none met the bar.`
        : ""
    } That is useful: your attention is free today.`,
  };
}

/** No unusual activity across the watchlist. */
export function nothingUnusual(marketCount: number): AbsenceMessage {
  return {
    headline: "No unusual activity detected",
    body: `Nothing across your ${marketCount} ${marketCount === 1 ? "market" : "markets"} is behaving differently from how it normally behaves.`,
  };
}

/** Not enough history for the learning layer to say anything yet. */
export function nothingLearnedYet(
  closedTrades: number,
  required: number,
): AbsenceMessage {
  const remaining = Math.max(0, required - closedTrades);

  return {
    headline: "There are no learning observations yet",
    body:
      remaining > 0
        ? `Patterns in how you trade need history behind them before they mean anything. ${remaining} more closed ${remaining === 1 ? "trade" : "trades"} in the journal and this starts filling in.`
        : "Nothing has emerged from your history that is worth stating yet.",
  };
}

/** A pattern is forming but has not earned the right to be stated. */
export function stillDeveloping(count: number): AbsenceMessage {
  return {
    headline: `${count} ${count === 1 ? "observation is" : "observations are"} still developing`,
    body: `${count === 1 ? "A pattern is" : "Patterns are"} forming in your history, but not yet supported by enough evidence to state confidently. We would rather wait than guess.`,
  };
}

/** We genuinely do not know. */
export function notKnown(subject: string): AbsenceMessage {
  return {
    headline: "We do not currently know",
    body: `There is no reliable basis for a view on ${subject} right now. Rather than estimate one, this is left open.`,
  };
}

/** Short inline form, for tight spaces where a headline plus body won't fit. */
export const ABSENCE_LINE: Record<AbsenceKind, string> = {
  quiet: "Nothing requires your attention.",
  "insufficient-history": "Not enough history yet.",
  "still-developing": "Still developing.",
  unknown: "Not currently known.",
};
