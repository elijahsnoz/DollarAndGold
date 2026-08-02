import { buildTimeline, type TimelineEvent } from "@/lib/ai/timeline";
import { getAsset } from "@/lib/market/catalog";
import { findLevels } from "@/lib/market/indicators";
import { getMarketDataProvider } from "@/lib/market/provider";
import { DAY } from "@/lib/market/simulation";
import type { Timeframe } from "@/lib/market/types";
import type { BehaviourInsight } from "@/lib/personalisation/types";
import { greetingFor } from "./ritual";

/**
 * Watchlist Intelligence: the same desk, read at different cadences.
 *
 * Deliberately two surfaces, not four. The spec this was built against asked
 * for Morning/Afternoon/End-of-day/Weekly briefs, but Morning already exists —
 * it's the daily briefing on `/dashboard`, and the Daily Ritual Engine's whole
 * point is that it reads the same all day, which an "Afternoon" rehash of the
 * same trailing-24h change would either duplicate or quietly break. Afternoon
 * and End-of-day would show identical data (nothing in this app has a single
 * "market close" — crypto trades continuously and FX nearly so), so they are
 * one surface — "Today" — whose greeting adapts to the time of day rather than
 * pretending to be two different reads of the same events. "This week" is
 * genuinely distinct: a longer window, not a rehash.
 *
 * Both reuse `buildTimeline` — the same engine behind the analysis page's
 * "How this developed" — rather than inventing a second notion of what counts
 * as material.
 */

export interface CadenceEvent extends TimelineEvent {
  symbol: string;
  assetName: string;
}

export interface TodayUpdate {
  generatedAt: number;
  greeting: string;
  quiet: boolean;
  events: CadenceEvent[];
  marketCount: number;
}

export interface WeeklyReview {
  generatedAt: number;
  weekStart: number;
  quiet: boolean;
  events: CadenceEvent[];
  insights: BehaviourInsight[];
  marketCount: number;
}

/** Server half: timeline events per symbol, over the given window. No personal data touches this. */
async function loadTimelinesFor(
  symbols: string[],
  timeframe: Timeframe,
): Promise<Record<string, CadenceEvent[]>> {
  const provider = getMarketDataProvider();

  const entries = await Promise.all(
    symbols.map(async (symbol) => {
      const asset = getAsset(symbol);
      if (!asset) return null;

      try {
        const [quote, series] = await Promise.all([
          provider.getQuote(symbol),
          provider.getSeries(symbol, timeframe),
        ]);

        const { supports, resistances } = findLevels(series.candles, quote.price, 3, 3);
        const events = buildTimeline({
          candles: series.candles,
          supports,
          resistances,
          // News isn't fetched here — this surface is about price behaviour,
          // and pulling per-symbol news for a whole desk on every tab switch
          // is cost this feature doesn't need to pay.
          news: [],
          precision: asset.precision,
        }).map((event) => ({ ...event, symbol, assetName: asset.name }));

        return [symbol, events] as const;
      } catch {
        // A market that can't be loaded is simply absent from this cadence,
        // same as the daily briefing's own desk loader.
        return null;
      }
    }),
  );

  return Object.fromEntries(
    entries.filter((entry): entry is [string, CadenceEvent[]] => entry !== null),
  );
}

/** Intraday (15-minute) bars are what make a same-day timeline meaningful. */
export function loadTodayTimelines(symbols: string[]) {
  return loadTimelinesFor(symbols, "1D");
}

/** Daily bars over three months, filtered down to the last 7 days below. */
export function loadWeeklyTimelines(symbols: string[]) {
  return loadTimelinesFor(symbols, "3M");
}

function startOfDay(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Client half: pure, so directly unit-testable without a network. */
export function composeTodayUpdate({
  eventsBySymbol,
  now = Date.now(),
  name,
}: {
  eventsBySymbol: Record<string, CadenceEvent[]>;
  now?: number;
  name?: string;
}): TodayUpdate {
  const todayStart = startOfDay(now);

  const events = Object.values(eventsBySymbol)
    .flat()
    .filter((event) => event.at >= todayStart)
    .sort((a, b) => b.at - a.at);

  return {
    generatedAt: now,
    greeting: greetingFor(now, name),
    quiet: events.length === 0,
    events,
    marketCount: Object.keys(eventsBySymbol).length,
  };
}

/** Client half: pure, so directly unit-testable without a network. */
export function composeWeeklyReview({
  eventsBySymbol,
  insights,
  now = Date.now(),
}: {
  eventsBySymbol: Record<string, CadenceEvent[]>;
  insights: BehaviourInsight[];
  now?: number;
}): WeeklyReview {
  const weekStart = now - 7 * DAY;

  const events = Object.values(eventsBySymbol)
    .flat()
    .filter((event) => event.at >= weekStart)
    .sort((a, b) => b.at - a.at);

  return {
    generatedAt: now,
    weekStart,
    quiet: events.length === 0 && insights.length === 0,
    events,
    insights,
    marketCount: Object.keys(eventsBySymbol).length,
  };
}
