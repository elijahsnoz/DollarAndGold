import type { DatedMemory } from "@/lib/memory/types";
import type { BehaviourInsight } from "@/lib/personalisation/types";

/**
 * Briefing domain types.
 *
 * The organising idea is that **nothing reaches the user without earning it**.
 * Every candidate observation carries a materiality score and the reason it
 * scored that way, and the composer drops anything below the bar. A briefing
 * with two items is a better briefing than one with nine, and a briefing with
 * none is a legitimate, useful outcome — see `materiality.ts`.
 */

export type BriefingCategory =
  | "market-move"
  | "level"
  | "volatility"
  | "event"
  | "behaviour"
  | "archive";

export interface BriefingItem {
  id: string;
  category: BriefingCategory;
  symbol?: string;
  /** One line. The thing itself. */
  headline: string;
  /** Why it deserves attention today, in plain English. */
  why: string;
  /**
   * 0–1. How much this deserves the user's attention *relative to how this
   * market normally behaves*, not in absolute percentage terms.
   */
  materiality: number;
  /** How the score was reached, so the judgement can be audited. */
  basis: string;
}

/** A focus market with just enough state to be useful at a glance. */
export interface DeskMarket {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  precision: number;
  source?: string;
  /** Today's move expressed in the market's own typical daily ranges. */
  moveInAtrs: number;
  /** Nearest level and how far away it is, when one is close enough to matter. */
  approaching?: { kind: "support" | "resistance"; level: number; atrsAway: number };
  /** Why this market is on the user's desk at all. */
  reason: string;
}

export type RiskLevel = "calm" | "normal" | "elevated" | "high";

export interface RiskIntelligence {
  level: RiskLevel;
  /** The headline risk statement for today. */
  summary: string;
  /** Concrete, non-prescriptive notes. Never "reduce your size". */
  notes: string[];
  /** Behaviour-derived risk, only when the evidence supports it. */
  behavioural: BehaviourInsight | null;
}

/** How the ritual greets a returning user. */
export interface RitualContext {
  /** Local-day key the briefing was built for. */
  day: string;
  greeting: string;
  /** "Since you were here yesterday" — null on a first visit. */
  sinceLastVisit: string | null;
  /** True when this is the user's first briefing of the day. */
  firstToday: boolean;
}

export interface PersonalBriefing {
  generatedAt: number;
  ritual: RitualContext;
  /**
   * The Silence Engine's verdict. When true, `items` is empty *on purpose* and
   * the UI says so plainly rather than padding.
   */
  quiet: boolean;
  /** What genuinely deserves attention, most material first. */
  items: BriefingItem[];
  /** How many candidates were considered and dropped. Surfaced for honesty. */
  considered: number;
  markets: DeskMarket[];
  risk: RiskIntelligence;
  /** A note from the user's own past, when one is relevant to today. */
  archive: DatedMemory | null;
  /** Markets worth a closer look. Empty when nothing warrants it. */
  research: { symbol: string; name: string; reason: string }[];
  /** True when the desk is falling back to default markets, not the user's own. */
  usingDefaults: boolean;
}
