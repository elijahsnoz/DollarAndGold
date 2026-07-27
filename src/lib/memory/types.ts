/**
 * Market Memories — the user's personal archive.
 *
 * Not conversational memory, and not a second place to write things down. A
 * memory is a *record of something that already happened* inside the product:
 * a note written, a trade closed, a market researched, a pattern the system
 * noticed. The user never files anything; the archive assembles itself from
 * activity they were doing anyway.
 *
 * Two properties make this worth having a year from now:
 *
 *  - **Immutable and timestamped.** A memory records what was true when it was
 *    written. "Gold rejected 3,400" stays a record of that observation even
 *    after gold trades through 3,400 — editing it retroactively would destroy
 *    the only thing an archive is for.
 *  - **Self-describing.** Each memory carries enough context to be understood
 *    in isolation, months later, without the surrounding session.
 */

export type MemoryKind =
  /** Something the user wrote themselves. */
  | "observation"
  /** A position they recorded. */
  | "trade"
  /** A market they studied. */
  | "research"
  /** A pattern the system derived from their behaviour. */
  | "behaviour"
  /** A threshold crossed — first month, tenth trade, a market becoming their focus. */
  | "milestone";

export interface MarketMemory {
  id: string;
  kind: MemoryKind;
  /** Market this concerns, when it concerns one. */
  symbol?: string;
  /** One line, readable on its own months later. */
  title: string;
  /** The substance. For an observation this is the user's own words. */
  body: string;
  /** When the thing happened — not when the record was created. */
  occurredAt: number;
  /**
   * What produced this, so the archive can explain itself and so a
   * regenerated derivation can replace its own previous entry.
   */
  origin: {
    type: "note" | "journal" | "analysis" | "watchlist" | "derived";
    /** Id of the originating record, where one exists. */
    refId?: string;
  };
  /** Free-form tags for retrieval — market, asset class, theme. */
  tags: string[];
  /**
   * 1–3. Drives what surfaces in a briefing when there is more history than
   * room. Set by the capture rule, never by the user.
   */
  weight: 1 | 2 | 3;
}

/** A memory plus how long ago it happened, for timeline rendering. */
export interface DatedMemory extends MarketMemory {
  ageDays: number;
}

export const MEMORY_KIND_LABEL: Record<MemoryKind, string> = {
  observation: "Your note",
  trade: "Trade",
  research: "Research",
  behaviour: "Behaviour",
  milestone: "Milestone",
};
