import type { MarketAnalysis } from "@/lib/ai/types";

/**
 * Macro Agent.
 *
 * For now, a relabelling of the existing risk engine's "events to watch" —
 * not a live economic calendar (that's a larger, separate feature). Kept as
 * its own module so swapping in a real calendar provider later changes
 * nothing at the call site.
 */
export function loadMacroEvents(analysis: MarketAnalysis): string[] {
  return analysis.eventsToWatch;
}
