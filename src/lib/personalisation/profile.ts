import { isEvidenceGrade } from "@/lib/context/types";
import { ASSET_CLASS_LABEL, getAsset } from "@/lib/market/catalog";
import { DAY } from "@/lib/market/simulation";
import type { WorkspaceState } from "@/lib/workspace/types";
import { deriveInsights } from "./insights";
import {
  type ProfileMaturity,
  type RankedMarket,
  type UserProfile,
} from "./types";

/**
 * Derives what the system believes about a user from what they actually did.
 *
 * Pure: same workspace in, same profile out. Nothing here is stored, which
 * means the understanding improves retroactively whenever the derivation
 * improves — a user who has been keeping a journal for six months gets the
 * benefit of a rule written today, applied to all of it.
 */

/**
 * Attention decays. A market someone studied daily in March but has ignored
 * since is not their focus market today, and a briefing that leads with it is
 * wrong in the way that makes people stop opening the product.
 */
const ATTENTION_HALF_LIFE_DAYS = 21;

function recencyWeight(timestamp: number, now: number): number {
  const ageDays = Math.max(0, (now - timestamp) / DAY);
  return Math.pow(0.5, ageDays / ATTENTION_HALF_LIFE_DAYS);
}

function dayKey(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

/** Every timestamp the workspace knows about, for activity measurement. */
function allTimestamps(workspace: WorkspaceState): number[] {
  return [
    ...workspace.notes.map((n) => n.updatedAt),
    ...workspace.journal.map((t) => t.openedAt),
    ...workspace.journal.flatMap((t) => (t.closedAt ? [t.closedAt] : [])),
    ...workspace.researchLog.map((r) => r.at),
    ...workspace.recentAnalyses.map((a) => a.viewedAt),
    ...workspace.watchlist.map((w) => w.addedAt),
  ].filter((t) => Number.isFinite(t) && t > 0);
}

function rankMarkets(workspace: WorkspaceState, now: number): RankedMarket[] {
  const scores = new Map<
    string,
    { score: number; reasons: Map<string, number>; lastTouchedAt: number }
  >();

  const add = (
    symbol: string,
    weight: number,
    reason: string,
    at: number,
  ) => {
    const key = symbol.toUpperCase();
    if (!getAsset(key)) return;

    const entry = scores.get(key) ?? {
      score: 0,
      reasons: new Map<string, number>(),
      lastTouchedAt: 0,
    };
    entry.score += weight;
    entry.reasons.set(reason, (entry.reasons.get(reason) ?? 0) + 1);
    entry.lastTouchedAt = Math.max(entry.lastTouchedAt, at);
    scores.set(key, entry);
  };

  // Researching a market is the clearest signal of interest, but it is cheap —
  // one click. Writing about it or trading it costs more and counts for more.
  for (const event of workspace.researchLog) {
    add(event.symbol, 1 * recencyWeight(event.at, now), "researched", event.at);
  }
  for (const note of workspace.notes) {
    if (note.symbol) {
      add(note.symbol, 4 * recencyWeight(note.updatedAt, now), "wrote about", note.updatedAt);
    }
  }
  for (const trade of workspace.journal) {
    add(trade.symbol, 6 * recencyWeight(trade.openedAt, now), "traded", trade.openedAt);
  }
  for (const item of workspace.watchlist) {
    // Watchlist membership is an intention, not an action — deliberately worth
    // less than a single note. Pinning is a stronger, explicit statement.
    add(item.symbol, item.pinned ? 5 : 2, item.pinned ? "pinned" : "watching", item.addedAt);
  }

  const total = [...scores.values()].reduce((sum, e) => sum + e.score, 0) || 1;

  return [...scores.entries()]
    .map(([symbol, entry]) => ({
      symbol,
      name: getAsset(symbol)?.name ?? symbol,
      score: entry.score / total,
      reasons: [...entry.reasons.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([reason, count]) =>
          count > 1 ? `${reason} ${count}×` : reason,
        ),
      lastTouchedAt: entry.lastTouchedAt,
    }))
    .sort((a, b) => b.score - a.score);
}

function assessMaturity(activeDays: number, historyDays: number): ProfileMaturity {
  if (activeDays >= 21 && historyDays >= 60) return "established";
  if (activeDays >= 8 && historyDays >= 21) return "familiar";
  if (activeDays >= 3) return "learning";
  return "new";
}

/** What the user would have to do for the system to say more. */
function describeNextUnlock(
  workspace: WorkspaceState,
  withheld: number,
): string | null {
  const closed = workspace.journal.filter((t) => t.outcome !== "open").length;

  if (closed < 5) {
    const needed = 5 - closed;
    return `Record ${needed} more closed ${needed === 1 ? "trade" : "trades"} in the journal and behaviour insights become available.`;
  }
  if (withheld > 0) {
    return `${withheld} more ${withheld === 1 ? "pattern is" : "patterns are"} forming, but there isn't enough history yet to state ${withheld === 1 ? "it" : "them"} confidently.`;
  }
  if (workspace.researchLog.length < 10) {
    return "Keep researching markets and your focus areas will sharpen.";
  }
  return null;
}

/**
 * How much of the journal can support claims about market conditions.
 *
 * The note matters more than the numbers. A user with twenty trades and no
 * conditions insight will assume the feature is broken unless told that their
 * history predates context capture — silence needs a reason attached, or it
 * reads as failure.
 */
function assessContextCoverage(workspace: WorkspaceState) {
  const closed = workspace.journal.filter((trade) => trade.outcome !== "open");
  const usable = closed.filter((trade) => isEvidenceGrade(trade.openContext));

  const closedTrades = closed.length;
  const withUsableContext = usable.length;

  if (closedTrades === 0) {
    return { closedTrades, withUsableContext, note: null };
  }

  if (withUsableContext === closedTrades) {
    return { closedTrades, withUsableContext, note: null };
  }

  const missing = closedTrades - withUsableContext;

  return {
    closedTrades,
    withUsableContext,
    note:
      withUsableContext === 0
        ? `None of your ${closedTrades} closed ${closedTrades === 1 ? "trade has" : "trades have"} live market conditions recorded, so nothing can yet be said about how conditions affect your results. Trades recorded from now on will carry that context.`
        : `${withUsableContext} of your ${closedTrades} closed trades have live market conditions recorded. The other ${missing} either predate context capture or were recorded against simulated prices, so they are excluded from any conclusion about conditions.`,
  };
}

export function deriveProfile(
  workspace: WorkspaceState,
  now: number = Date.now(),
): UserProfile {
  const timestamps = allTimestamps(workspace);
  const activeDays = new Set(timestamps.map(dayKey)).size;
  const earliest = timestamps.length ? Math.min(...timestamps) : now;
  const historyDays = Math.max(0, Math.floor((now - earliest) / DAY));

  const focusMarkets = rankMarkets(workspace, now);

  // Roll market attention up to asset class.
  const classTotals = new Map<string, number>();
  for (const market of focusMarkets) {
    const asset = getAsset(market.symbol);
    if (!asset) continue;
    classTotals.set(
      asset.assetClass,
      (classTotals.get(asset.assetClass) ?? 0) + market.score,
    );
  }
  const classSum = [...classTotals.values()].reduce((a, b) => a + b, 0) || 1;

  const { insights, withheld } = deriveInsights(workspace, now);
  const contextCoverage = assessContextCoverage(workspace);

  return {
    generatedAt: now,
    maturity: assessMaturity(activeDays, historyDays),
    activeDays,
    historyDays,
    focusMarkets,
    classAffinity: [...classTotals.entries()]
      .map(([assetClass, value]) => ({
        assetClass,
        label:
          ASSET_CLASS_LABEL[assetClass as keyof typeof ASSET_CLASS_LABEL] ??
          assetClass,
        share: value / classSum,
      }))
      .sort((a, b) => b.share - a.share),
    contextCoverage,
    insights,
    withheldInsights: withheld,
    nextUnlock: describeNextUnlock(workspace, withheld),
  };
}
