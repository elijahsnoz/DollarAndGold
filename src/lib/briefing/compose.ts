import { formatPrice } from "@/lib/format";
import { FEATURED_SYMBOLS, getAsset } from "@/lib/market/catalog";
import {
  atr,
  findLevels,
  lastValid,
  realisedVolatility,
} from "@/lib/market/indicators";
import { getMarketDataProvider } from "@/lib/market/provider";
import { TIMEFRAMES } from "@/lib/market/simulation";
import { resurface } from "@/lib/memory/derive";
import { selectBehaviouralRisk } from "./risk";
import type { UserProfile } from "@/lib/personalisation/types";
import type { WorkspaceState } from "@/lib/workspace/types";
import {
  MATERIALITY_FLOOR,
  assessLevelProximity,
  assessMove,
} from "./materiality";
import { buildRiskIntelligence, type MarketRiskInput } from "./risk";
import { buildRitualContext, type RitualState } from "./ritual";
import type { BriefingItem, DeskMarket, PersonalBriefing } from "./types";

/**
 * Composes the personalised daily briefing.
 *
 * Two decisions shape everything here:
 *
 *  1. **Only the user's markets are examined.** Personalisation is not a
 *     ranking applied to a firehose — it decides what is looked at in the first
 *     place. A briefing about markets someone does not follow is noise however
 *     well written, and evaluating five markets properly costs less than
 *     evaluating sixteen badly.
 *  2. **Silence is a valid output.** Candidates are scored, then filtered
 *     against a high bar. Most mornings nothing clears it, and the briefing says
 *     so. See `materiality.ts`.
 */

/** Enough to be useful, few enough to read before coffee. */
const MAX_DESK_MARKETS = 5;
const MAX_ITEMS = 4;

interface MarketContext {
  symbol: string;
  name: string;
  precision: number;
  price: number;
  changePercent: number;
  source?: string;
  atrValue: number;
  atrPercent: number;
  annualisedVol: number;
  regime: "low" | "normal" | "elevated" | "high";
  supports: number[];
  resistances: number[];
  reason: string;
}

/** Which markets belong on this desk, and why. */
function chooseSymbols(profile: UserProfile): {
  symbols: { symbol: string; reason: string }[];
  usingDefaults: boolean;
} {
  const focus = profile.focusMarkets
    .filter((market) => market.score > 0)
    .slice(0, MAX_DESK_MARKETS);

  if (focus.length > 0) {
    return {
      symbols: focus.map((market) => ({
        symbol: market.symbol,
        reason: market.reasons.slice(0, 2).join(", ") || "on your desk",
      })),
      usingDefaults: false,
    };
  }

  // Nothing known about this user yet. Show a sensible default desk and say so
  // rather than pretending these are their markets.
  return {
    symbols: FEATURED_SYMBOLS.slice(0, 4).map((symbol) => ({
      symbol,
      reason: "default market",
    })),
    usingDefaults: true,
  };
}

const CLASS_NORMAL_VOL: Record<string, number> = {
  forex: 9,
  index: 16,
  stock: 28,
  commodity: 18,
  energy: 34,
  crypto: 52,
};

async function loadContext(
  symbol: string,
  reason: string,
): Promise<MarketContext | null> {
  const asset = getAsset(symbol);
  if (!asset) return null;

  const provider = getMarketDataProvider();

  try {
    const [quote, series] = await Promise.all([
      provider.getQuote(symbol),
      provider.getSeries(symbol, "1M"),
    ]);

    const closes = series.candles.map((c) => c.c);
    if (closes.length < 15) return null;

    const atrValue = lastValid(atr(series.candles, 14));
    const atrPercent =
      quote.price > 0 && Number.isFinite(atrValue)
        ? (atrValue / quote.price) * 100
        : 0;

    const annualisedVol = realisedVolatility(
      closes,
      TIMEFRAMES["1M"].periodsPerYear,
    );
    const normal = CLASS_NORMAL_VOL[asset.assetClass] ?? 20;
    const ratio = normal === 0 ? 1 : annualisedVol / normal;
    const regime =
      ratio > 1.6 ? "high" : ratio > 1.2 ? "elevated" : ratio < 0.7 ? "low" : "normal";

    const { supports, resistances } = findLevels(series.candles, quote.price, 3, 3);

    return {
      symbol: asset.symbol,
      name: asset.name,
      precision: asset.precision,
      price: quote.price,
      changePercent: quote.changePercent,
      source: quote.source,
      atrValue,
      atrPercent,
      annualisedVol,
      regime,
      supports,
      resistances,
      reason,
    };
  } catch {
    // A market that cannot be loaded is simply absent from today's desk. It is
    // not worth failing the whole briefing over.
    return null;
  }
}

/** Nearest level in either direction, measured in ATRs. */
function nearestLevel(context: MarketContext) {
  const candidates = [
    ...context.supports.map((level) => ({ kind: "support" as const, level })),
    ...context.resistances.map((level) => ({ kind: "resistance" as const, level })),
  ];

  if (candidates.length === 0 || context.atrValue <= 0) return undefined;

  const nearest = candidates
    .map((candidate) => ({
      ...candidate,
      atrsAway: Math.abs(candidate.level - context.price) / context.atrValue,
    }))
    .sort((a, b) => a.atrsAway - b.atrsAway)[0];

  return nearest;
}

/** Every candidate observation, scored. Filtering happens after. */
function buildCandidates(contexts: MarketContext[]): BriefingItem[] {
  const candidates: BriefingItem[] = [];

  for (const context of contexts) {
    const direction = context.changePercent >= 0 ? "higher" : "lower";

    const move = assessMove(context.changePercent, context.atrPercent);
    candidates.push({
      id: `move-${context.symbol}`,
      category: "market-move",
      symbol: context.symbol,
      headline: `${context.name} is ${Math.abs(context.changePercent).toFixed(2)}% ${direction}`,
      why: `That is ${move.basis}. Moves this size relative to a market's own range are usually driven by something specific rather than by drift, so it is worth knowing what.`,
      materiality: move.score,
      basis: move.basis,
    });

    const level = nearestLevel(context);
    if (level) {
      const proximity = assessLevelProximity(level.atrsAway);
      candidates.push({
        id: `level-${context.symbol}`,
        category: "level",
        symbol: context.symbol,
        headline: `${context.name} is sitting on ${level.kind} at ${formatPrice(level.level, context.precision)}`,
        why: `Price is ${proximity.basis} from a level it has respected before. This is where the market either confirms the level or invalidates it — informative either way, which is rarely true of the middle of a range.`,
        materiality: proximity.score,
        basis: proximity.basis,
      });
    }

    // Volatility regime is deliberately NOT a "Today" candidate. It is a
    // persistent state, not an event: a market that is quiet today was quiet
    // yesterday and will be quiet tomorrow, so surfacing it here would put the
    // same line in front of the user every morning until they stopped reading
    // the section. It belongs in Risk Intelligence, which is about standing
    // conditions, and it already appears there.
  }

  return candidates;
}

export type { MarketContext };

/**
 * Server half: load and score the markets on a desk.
 *
 * Takes only symbols. The user's notes, journal and derived profile never reach
 * the server — composition is split precisely so that private material stays in
 * the browser, and the server is asked nothing more revealing than "what is
 * gold doing".
 */
export async function loadMarketContexts(
  symbols: { symbol: string; reason: string }[],
): Promise<MarketContext[]> {
  const contexts = await Promise.all(
    symbols.map(({ symbol, reason }) => loadContext(symbol, reason)),
  );
  return contexts.filter((context): context is MarketContext => context !== null);
}

/** Which symbols this user's desk should cover. Pure; safe to call anywhere. */
export function deskSymbolsFor(profile: UserProfile) {
  return chooseSymbols(profile);
}

export interface BriefingInput {
  /** Market data loaded by the server. */
  contexts: MarketContext[];
  workspace: WorkspaceState;
  profile: UserProfile;
  ritual: RitualState;
  usingDefaults: boolean;
  name?: string;
  now?: number;
}

/**
 * Client half: fold the user's own history into the market picture.
 * Pure, so it is directly unit-testable without a network or a browser.
 */
export function composeBriefing({
  contexts,
  workspace,
  profile,
  ritual,
  usingDefaults,
  name,
  now = Date.now(),
}: BriefingInput): PersonalBriefing {
  const candidates = buildCandidates(contexts);

  // The Silence Engine. Everything below the floor is discarded, and if that
  // leaves nothing, the briefing reports a quiet morning as a finding.
  const items = candidates
    .filter((candidate) => candidate.materiality >= MATERIALITY_FLOOR)
    .sort((a, b) => b.materiality - a.materiality)
    .slice(0, MAX_ITEMS);

  const markets: DeskMarket[] = contexts.map((context) => {
    const level = nearestLevel(context);
    return {
      symbol: context.symbol,
      name: context.name,
      price: context.price,
      changePercent: context.changePercent,
      precision: context.precision,
      source: context.source,
      moveInAtrs:
        context.atrPercent > 0
          ? Math.abs(context.changePercent) / context.atrPercent
          : 0,
      // Only mention a level when it is genuinely close enough to matter.
      approaching: level && level.atrsAway <= 1 ? level : undefined,
      reason: context.reason,
    };
  });

  const riskInputs: MarketRiskInput[] = contexts.map((context) => ({
    symbol: context.symbol,
    name: context.name,
    regime: context.regime,
    annualisedPct: context.annualisedVol,
    atr: context.atrValue,
    atrPercent: context.atrPercent,
    precision: context.precision,
  }));

  // Prefer an archive note about a market on today's desk; fall back to any.
  const deskSymbols = contexts.map((c) => c.symbol);
  const archive =
    deskSymbols
      .map((symbol) => resurface(workspace, { symbol, now }))
      .find((memory) => memory !== null) ?? resurface(workspace, { now });

  // Research suggestions are earned, not filler: only markets that produced a
  // material observation are worth a closer look today.
  const research = items
    .filter((item) => item.symbol)
    .slice(0, 3)
    .map((item) => ({
      symbol: item.symbol as string,
      name: getAsset(item.symbol as string)?.name ?? (item.symbol as string),
      reason: item.basis,
    }));

  return {
    generatedAt: now,
    ritual: buildRitualContext(ritual, { now, name }),
    quiet: items.length === 0,
    items,
    considered: candidates.length,
    markets,
    risk: buildRiskIntelligence(
      riskInputs,
      selectBehaviouralRisk(profile.insights),
    ),
    archive,
    research: research.filter(
      (entry, index, all) =>
        all.findIndex((other) => other.symbol === entry.symbol) === index,
    ),
    usingDefaults,
  };
}
