import { DAY } from "@/lib/market/simulation";
import type { RitualContext } from "./types";

/**
 * The Daily Ritual Engine.
 *
 * A ritual is not a feed. The distinguishing property is that **the briefing is
 * the same all day** — open it at 07:00 and again at 11:00 and you see the same
 * read, because a morning paper that rewrote itself every time you glanced at
 * it would train you to keep glancing. Stability is what makes something a
 * habit rather than a slot machine.
 *
 * Deliberately absent: streaks, badges, counters, "you're on fire". Those
 * manufacture obligation, and a product that makes people feel guilty for
 * missing a day is a product they eventually resent. The pull has to be that
 * the briefing is genuinely worth reading — nothing else.
 */

/** Local calendar day, which is the boundary a person actually experiences. */
export function dayKey(now: number = Date.now()): string {
  const date = new Date(now);
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function greetingFor(now: number, name?: string): string {
  const hour = new Date(now).getHours();
  const part =
    hour < 5 ? "Good evening" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return name ? `${part}, ${name}` : part;
}

/**
 * How long they have been away, phrased like a person would say it.
 * Returns null on a first visit — there is nothing to have been away from.
 */
function describeAbsence(lastOpenedAt: number | undefined, now: number): string | null {
  if (!lastOpenedAt || lastOpenedAt <= 0) return null;

  const elapsed = now - lastOpenedAt;
  if (elapsed < 0) return null;

  const days = Math.floor(elapsed / DAY);
  const lastDay = dayKey(lastOpenedAt);

  if (lastDay === dayKey(now)) return null; // Already here today.
  if (days <= 1) return "Since you were here yesterday";
  if (days < 7) return `Since you were here ${days} days ago`;
  if (days < 30) {
    const weeks = Math.round(days / 7);
    return `Since you were here ${weeks} ${weeks === 1 ? "week" : "weeks"} ago`;
  }
  const months = Math.round(days / 30);
  return `Since you were here ${months} ${months === 1 ? "month" : "months"} ago`;
}

export interface RitualState {
  lastOpenedAt?: number;
  lastBriefingDay?: string;
}

export function buildRitualContext(
  state: RitualState,
  { now = Date.now(), name }: { now?: number; name?: string } = {},
): RitualContext {
  const today = dayKey(now);

  return {
    day: today,
    greeting: greetingFor(now, name),
    sinceLastVisit: describeAbsence(state.lastOpenedAt, now),
    firstToday: state.lastBriefingDay !== today,
  };
}

/**
 * A stable per-day seed.
 *
 * Anything that would otherwise vary between renders — which of several equally
 * material items leads, which suggestion is shown — is keyed off this, so the
 * briefing a user reads at breakfast is the one they find again at lunch.
 */
export function daySeed(day: string): number {
  let hash = 2166136261;
  for (let i = 0; i < day.length; i++) {
    hash ^= day.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
