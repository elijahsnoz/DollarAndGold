import { getAsset } from "@/lib/market/catalog";
import { DAY } from "@/lib/market/simulation";
import { formatPrice } from "@/lib/format";
import { deriveInsights } from "@/lib/personalisation/insights";
import type { JournalEntry, WorkspaceState } from "@/lib/workspace/types";
import type { DatedMemory, MarketMemory } from "./types";

/**
 * Assembles the Market Memories archive from workspace activity.
 *
 * Derived rather than stored, on purpose. A parallel memories collection would
 * drift from the records it describes — delete a trade and its memory outlives
 * it — and would need its own migration every time a capture rule changes.
 * Deriving means the archive is always consistent with the truth, and that a
 * rule written today applies retroactively to a year of history.
 */

/** Stable id from the origin, so the same activity always yields the same memory. */
function memoryId(prefix: string, ref: string): string {
  return `mem-${prefix}-${ref}`;
}

function notesToMemories(workspace: WorkspaceState): MarketMemory[] {
  return workspace.notes.map((note) => ({
    id: memoryId("note", note.id),
    kind: "observation" as const,
    symbol: note.symbol,
    title: note.title,
    // The user's own words are the memory. Never paraphrase these.
    body: note.body,
    occurredAt: note.updatedAt,
    origin: { type: "note" as const, refId: note.id },
    tags: [
      "note",
      ...(note.symbol ? [note.symbol, getAsset(note.symbol)?.assetClass ?? ""] : []),
    ].filter(Boolean),
    weight: 3 as const,
  }));
}

function tradeToMemory(trade: JournalEntry): MarketMemory {
  const asset = getAsset(trade.symbol);
  const precision = asset?.precision ?? 2;
  const name = asset?.name ?? trade.symbol;

  const outcome =
    trade.outcome === "open"
      ? "still open"
      : trade.exitPrice !== undefined
        ? `closed at ${formatPrice(trade.exitPrice, precision)}`
        : `closed ${trade.outcome}`;

  return {
    id: memoryId("trade", trade.id),
    kind: "trade",
    symbol: trade.symbol,
    title: `${trade.direction === "long" ? "Long" : "Short"} ${name} from ${formatPrice(trade.entryPrice, precision)} — ${outcome}`,
    body: trade.thesis,
    occurredAt: trade.openedAt,
    origin: { type: "journal", refId: trade.id },
    tags: ["trade", trade.symbol, trade.direction, trade.outcome].filter(Boolean),
    weight: 3,
  };
}

/**
 * Research is collapsed to one memory per market per day.
 *
 * A memory per click would bury the things the user actually wrote under
 * hundreds of low-value rows, which is the exact information overload this
 * product exists to remove.
 */
function researchToMemories(workspace: WorkspaceState): MarketMemory[] {
  const byDayAndSymbol = new Map<
    string,
    { symbol: string; day: string; at: number; count: number; trend: string; confidence: number }
  >();

  for (const event of workspace.researchLog) {
    const day = new Date(event.at).toISOString().slice(0, 10);
    const key = `${day}:${event.symbol}`;
    const existing = byDayAndSymbol.get(key);

    if (existing) {
      existing.count += 1;
      // Keep the latest reading of the day.
      if (event.at > existing.at) {
        existing.at = event.at;
        existing.trend = event.trend;
        existing.confidence = event.confidence;
      }
    } else {
      byDayAndSymbol.set(key, {
        symbol: event.symbol,
        day,
        at: event.at,
        count: 1,
        trend: event.trend,
        confidence: event.confidence,
      });
    }
  }

  return [...byDayAndSymbol.entries()].map(([key, entry]) => {
    const name = getAsset(entry.symbol)?.name ?? entry.symbol;
    return {
      id: memoryId("research", key),
      kind: "research" as const,
      symbol: entry.symbol,
      title: `Researched ${name}`,
      body: `The analysis read ${entry.trend} at ${entry.confidence}/100 indicator agreement${entry.count > 1 ? `. You came back to it ${entry.count} times that day` : ""}.`,
      occurredAt: entry.at,
      origin: { type: "analysis" as const, refId: entry.symbol },
      tags: ["research", entry.symbol, entry.trend],
      // Lowest weight: useful as context, never the headline.
      weight: 1 as const,
    };
  });
}

/** Countable, datable achievements. Not congratulation for its own sake. */
function milestoneMemories(workspace: WorkspaceState): MarketMemory[] {
  const memories: MarketMemory[] = [];
  const trades = [...workspace.journal].sort((a, b) => a.openedAt - b.openedAt);

  for (const count of [1, 10, 25, 50, 100]) {
    const trade = trades[count - 1];
    if (!trade) break;
    memories.push({
      id: memoryId("milestone", `trades-${count}`),
      kind: "milestone",
      title:
        count === 1
          ? "You started keeping a trading journal"
          : `${count} trades recorded`,
      body:
        count === 1
          ? "The first entry in what becomes the most useful record you have — your own reasoning, written before you knew the outcome."
          : `${count} positions now carry a written thesis. That is enough history to start seeing which of your ideas actually repeat.`,
      occurredAt: trade.openedAt,
      origin: { type: "derived" },
      tags: ["milestone", "journal"],
      weight: 2,
    });
  }

  return memories;
}

/** Patterns the system noticed, dated to now — they describe the present. */
function insightMemories(
  workspace: WorkspaceState,
  now: number,
): MarketMemory[] {
  return deriveInsights(workspace, now).insights.map((insight) => ({
    id: memoryId("insight", insight.id),
    kind: "behaviour" as const,
    symbol: insight.symbols?.[0],
    title: insight.title,
    body: insight.body,
    occurredAt: now,
    origin: { type: "derived" as const, refId: insight.id },
    tags: ["behaviour", insight.kind, ...(insight.symbols ?? [])],
    weight: 2 as const,
  }));
}

export function buildMemories(
  workspace: WorkspaceState,
  now: number = Date.now(),
): MarketMemory[] {
  return [
    ...notesToMemories(workspace),
    ...workspace.journal.map(tradeToMemory),
    ...researchToMemories(workspace),
    ...milestoneMemories(workspace),
    ...insightMemories(workspace, now),
  ].sort((a, b) => b.occurredAt - a.occurredAt);
}

/** Memories with age attached, newest first, optionally filtered. */
export function timeline(
  workspace: WorkspaceState,
  {
    symbol,
    minWeight = 1,
    limit,
    now = Date.now(),
  }: { symbol?: string; minWeight?: number; limit?: number; now?: number } = {},
): DatedMemory[] {
  let memories = buildMemories(workspace, now).filter(
    (memory) => memory.weight >= minWeight,
  );

  if (symbol) {
    const key = symbol.toUpperCase();
    memories = memories.filter((memory) => memory.symbol === key);
  }

  const dated = memories.map((memory) => ({
    ...memory,
    ageDays: Math.max(0, Math.floor((now - memory.occurredAt) / DAY)),
  }));

  return limit ? dated.slice(0, limit) : dated;
}

/**
 * "Four months ago you wrote…" — the resurfacing that makes an archive feel
 * like it is working for you rather than just accumulating.
 *
 * Only surfaces the user's own words, and only things old enough to have been
 * genuinely forgotten. A note from yesterday is not a recollection.
 */
export function resurface(
  workspace: WorkspaceState,
  { symbol, now = Date.now() }: { symbol?: string; now?: number } = {},
): DatedMemory | null {
  const MIN_AGE_DAYS = 21;

  const candidates = timeline(workspace, { symbol, now }).filter(
    (memory) => memory.kind === "observation" && memory.ageDays >= MIN_AGE_DAYS,
  );

  if (candidates.length === 0) return null;

  // The oldest surviving observation is the one most worth being reminded of.
  return candidates[candidates.length - 1];
}
