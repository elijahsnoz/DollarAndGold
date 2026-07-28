/**
 * What the system believes about a user, and how sure it is allowed to sound.
 *
 * The central constraint: **an insight is only permitted to speak when it has
 * enough evidence to be worth trusting.** A platform that tells someone they
 * trade Gold better than Crypto on the strength of three positions is not
 * personalising, it is guessing with their money at stake — and once a user
 * catches it doing that, nothing else it says is credible either.
 *
 * So every derived belief carries its evidence count, and the renderer is not
 * allowed to display anything below `emerging`.
 */

export type Confidence = "insufficient" | "emerging" | "established";

export interface Evidence {
  /** Number of independent observations behind this. */
  observations: number;
  confidence: Confidence;
  /** Plain-English basis, shown to the user so a claim can be audited. */
  basis: string;
}

/** Minimum observations before a belief may be stated at all. */
export const EVIDENCE_THRESHOLDS = {
  /** Below this the system says nothing. */
  emerging: 5,
  /** Above this it may speak without hedging. */
  established: 15,
} as const;

export function gradeEvidence(observations: number, basis: string): Evidence {
  const confidence: Confidence =
    observations >= EVIDENCE_THRESHOLDS.established
      ? "established"
      : observations >= EVIDENCE_THRESHOLDS.emerging
        ? "emerging"
        : "insufficient";

  return { observations, confidence, basis };
}

/** True when a belief has cleared the bar to be shown to the user. */
export function canSpeak(evidence: Evidence): boolean {
  return evidence.confidence !== "insufficient";
}

/**
 * Hedging is not decoration — an emerging pattern genuinely might not hold, and
 * the language has to carry that.
 */
export function hedge(evidence: Evidence): string {
  return evidence.confidence === "established" ? "" : "So far, ";
}

export interface RankedMarket {
  symbol: string;
  name: string;
  /** 0–1, relative attention share. */
  score: number;
  /** Why it ranks: research count, journal count, pinned, etc. */
  reasons: string[];
  lastTouchedAt: number;
}

export type InsightKind = "strength" | "watch-out" | "pattern";

export interface BehaviourInsight {
  id: string;
  kind: InsightKind;
  /** One line. This is what a briefing shows. */
  title: string;
  /** The explanation, written to teach rather than to scold. */
  body: string;
  evidence: Evidence;
  symbols?: string[];
}

/**
 * How much the system is entitled to claim it knows, based on history depth.
 * Drives the tone of the briefing and stops a day-one user being told the
 * platform understands their habits.
 */
export type ProfileMaturity = "new" | "learning" | "familiar" | "established";

export interface UserProfile {
  generatedAt: number;
  maturity: ProfileMaturity;
  /** Distinct days on which the user did anything. */
  activeDays: number;
  /** Days since first recorded activity. */
  historyDays: number;
  /** Markets ranked by genuine attention, not just watchlist membership. */
  focusMarkets: RankedMarket[];
  /** Asset classes ordered by attention share. */
  classAffinity: { assetClass: string; label: string; share: number }[];
  /**
   * How much of the trade history can support claims about market conditions.
   *
   * Conditions-based rules read only snapshots captured live at the time. When
   * most of a journal predates context capture — or was recorded against
   * simulated prices — those rules stay silent, and the user is owed the
   * reason. Without this, working-as-designed silence is indistinguishable
   * from a broken feature.
   */
  contextCoverage: {
    closedTrades: number;
    withUsableContext: number;
    /** Plain-English explanation of the gap, or null when there isn't one. */
    note: string | null;
  };

  /** Only insights that cleared the evidence bar. */
  insights: BehaviourInsight[];
  /** Insights withheld, so the UI can honestly say it is still learning. */
  withheldInsights: number;
  /** What the system would need in order to say more. */
  nextUnlock: string | null;
}
