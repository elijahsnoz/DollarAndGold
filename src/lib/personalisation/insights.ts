import { getAsset } from "@/lib/market/catalog";
import { DAY } from "@/lib/market/simulation";
import type { JournalEntry, WorkspaceState } from "@/lib/workspace/types";
import {
  EVIDENCE_THRESHOLDS,
  canSpeak,
  gradeEvidence,
  hedge,
  type BehaviourInsight,
} from "./types";

/**
 * Behaviour insights.
 *
 * Every rule here follows the same contract: compute the pattern, attach the
 * evidence that supports it, and let the caller drop anything that hasn't
 * earned the right to be said. A rule may return an insight graded
 * `insufficient` — that is not a failure, it is the system counting how close
 * it is to being able to help.
 *
 * Tone is a deliberate constraint. These are read by someone who has just lost
 * money, so a finding is framed as something to work with rather than a verdict
 * on them. "Your losses cluster in X" teaches; "you are bad at X" does not.
 */

/** Percentage return of a closed trade, sign-corrected for direction. */
function tradeReturn(trade: JournalEntry): number | null {
  if (trade.exitPrice === undefined || trade.entryPrice === 0) return null;
  const raw = ((trade.exitPrice - trade.entryPrice) / trade.entryPrice) * 100;
  return trade.direction === "long" ? raw : -raw;
}

interface ClosedTrade extends JournalEntry {
  result: number;
}

function closedTrades(workspace: WorkspaceState): ClosedTrade[] {
  return workspace.journal
    .filter((t) => t.outcome !== "open")
    .map((t) => ({ ...t, result: tradeReturn(t) ?? NaN }))
    .filter((t) => Number.isFinite(t.result));
}

const mean = (values: number[]) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

// --- Rules -----------------------------------------------------------------

/**
 * Which market treats them best.
 *
 * Requires a real sample in *both* markets being compared — the failure mode
 * this guards is declaring a "strongest market" off two lucky trades, which is
 * exactly the kind of claim that feels insightful and is worthless.
 */
function marketStrength(trades: ClosedTrade[]): BehaviourInsight | null {
  const bySymbol = new Map<string, number[]>();
  for (const trade of trades) {
    const list = bySymbol.get(trade.symbol) ?? [];
    list.push(trade.result);
    bySymbol.set(trade.symbol, list);
  }

  const MIN_PER_MARKET = 3;
  const eligible = [...bySymbol.entries()]
    .filter(([, results]) => results.length >= MIN_PER_MARKET)
    .map(([symbol, results]) => ({
      symbol,
      name: getAsset(symbol)?.name ?? symbol,
      average: mean(results),
      count: results.length,
    }))
    .sort((a, b) => b.average - a.average);

  if (eligible.length < 2) return null;

  const best = eligible[0];
  const worst = eligible[eligible.length - 1];
  const gap = best.average - worst.average;

  // A trivial gap is noise, not a pattern.
  if (gap < 1) return null;

  const observations = best.count + worst.count;
  const evidence = gradeEvidence(
    observations,
    `${best.count} closed trades in ${best.name}, ${worst.count} in ${worst.name}`,
  );

  return {
    id: "market-strength",
    kind: "strength",
    title: `${best.name} has been your strongest market`,
    body: `${hedge(evidence)}your ${best.name} positions have averaged ${best.average.toFixed(1)}% while ${worst.name} has averaged ${worst.average.toFixed(1)}%. That is worth understanding rather than acting on directly — it may reflect genuine familiarity with how ${best.name} moves, or simply that you traded it in easier conditions. The useful question is what you do differently there.`,
    evidence,
    symbols: [best.symbol, worst.symbol],
  };
}

/** Whether holding longer helps or hurts. */
function holdDuration(trades: ClosedTrade[]): BehaviourInsight | null {
  const timed = trades.filter(
    (t) => t.closedAt !== undefined && t.closedAt > t.openedAt,
  );
  if (timed.length < EVIDENCE_THRESHOLDS.emerging) return null;

  const withHours = timed.map((t) => ({
    result: t.result,
    hours: ((t.closedAt as number) - t.openedAt) / (1000 * 60 * 60),
  }));

  const median = [...withHours].sort((a, b) => a.hours - b.hours)[
    Math.floor(withHours.length / 2)
  ].hours;

  const longer = withHours.filter((t) => t.hours > median);
  const shorter = withHours.filter((t) => t.hours <= median);
  if (longer.length < 2 || shorter.length < 2) return null;

  const longAvg = mean(longer.map((t) => t.result));
  const shortAvg = mean(shorter.map((t) => t.result));
  if (Math.abs(longAvg - shortAvg) < 1) return null;

  const favoursLonger = longAvg > shortAvg;
  const evidence = gradeEvidence(
    timed.length,
    `${timed.length} closed trades with recorded hold times`,
  );

  return {
    id: "hold-duration",
    kind: "pattern",
    title: favoursLonger
      ? "Your longer holds have performed better"
      : "Your shorter holds have performed better",
    body: `${hedge(evidence)}trades you held ${favoursLonger ? "longer" : "less"} than about ${median < 48 ? `${Math.round(median)} hours` : `${Math.round(median / 24)} days`} averaged ${(favoursLonger ? longAvg : shortAvg).toFixed(1)}%, against ${(favoursLonger ? shortAvg : longAvg).toFixed(1)}% for the rest. ${favoursLonger ? "Closing early may be cutting positions before the idea has had room to work." : "Holding on may be turning manageable losses into larger ones."} Worth checking against what you wrote in each trade's thesis.`,
    evidence,
  };
}

/** Whether wins are big enough to justify the loss rate. */
function payoffBalance(trades: ClosedTrade[]): BehaviourInsight | null {
  if (trades.length < EVIDENCE_THRESHOLDS.emerging) return null;

  const wins = trades.filter((t) => t.result > 0).map((t) => t.result);
  const losses = trades.filter((t) => t.result < 0).map((t) => t.result);
  if (wins.length < 2 || losses.length < 2) return null;

  const avgWin = mean(wins);
  const avgLoss = Math.abs(mean(losses));
  const payoff = avgLoss === 0 ? 0 : avgWin / avgLoss;
  const winRate = (wins.length / trades.length) * 100;

  const evidence = gradeEvidence(
    trades.length,
    `${trades.length} closed trades`,
  );

  const healthy = payoff >= 1.5 || (payoff >= 1 && winRate >= 50);

  return {
    id: "payoff-balance",
    kind: healthy ? "strength" : "watch-out",
    title: healthy
      ? "Your winners are large enough to carry your losers"
      : "Your losers are running larger than your winners",
    body: `${hedge(evidence)}your average win is ${avgWin.toFixed(1)}% against an average loss of ${avgLoss.toFixed(1)}%, with a ${winRate.toFixed(0)}% win rate. ${
      healthy
        ? "That combination is what makes a strategy survivable — it means you do not need to be right most of the time."
        : "With losses this size relative to wins, the win rate has to stay high for the account to grow, which is a demanding thing to sustain. This is usually about where losses are cut rather than about picking better entries."
    }`,
    evidence,
  };
}

/** Trading frequency relative to how long they've been active. */
function tradingFrequency(
  workspace: WorkspaceState,
  now: number,
): BehaviourInsight | null {
  const trades = workspace.journal;
  if (trades.length < 8) return null;

  const earliest = Math.min(...trades.map((t) => t.openedAt));
  const spanDays = Math.max(1, (now - earliest) / DAY);
  const perWeek = (trades.length / spanDays) * 7;

  if (perWeek < 10) return null;

  const evidence = gradeEvidence(
    trades.length,
    `${trades.length} trades over ${Math.round(spanDays)} days`,
  );

  return {
    id: "trading-frequency",
    kind: "watch-out",
    title: "Your trading pace has picked up",
    body: `${hedge(evidence)}you have recorded around ${perWeek.toFixed(0)} trades a week. High frequency is not a problem in itself — some approaches require it — but it is worth checking that each position still has a thesis you would recognise a week later. If the recent entries in your journal are shorter than the older ones, that is usually the signal worth paying attention to.`,
    evidence,
  };
}

/** Researching a lot but recording nothing — the loop is left open. */
function researchToRecord(
  workspace: WorkspaceState,
): BehaviourInsight | null {
  const research = workspace.researchLog.length;
  if (research < 15) return null;

  const records = workspace.journal.length + workspace.notes.length;
  if (records >= research * 0.15) return null;

  const evidence = gradeEvidence(
    research,
    `${research} markets researched, ${records} written up`,
  );

  return {
    id: "research-to-record",
    kind: "pattern",
    title: "You research far more than you record",
    body: `${hedge(evidence)}you have studied ${research} markets but written up ${records}. Nothing is wrong with reading widely — but analysis you do not record is analysis you will redo. A single line about what you concluded is usually enough to make the next look at that market faster, and it is what makes the archive worth having in six months.`,
    evidence,
  };
}

// --- Assembly ---------------------------------------------------------------

/**
 * Run every rule, then split into what may be shown and what is still forming.
 * The withheld count is surfaced honestly rather than hidden — "three patterns
 * are forming" is a truthful reason to come back tomorrow.
 */
export function deriveInsights(
  workspace: WorkspaceState,
  now: number = Date.now(),
): { insights: BehaviourInsight[]; withheld: number } {
  const trades = closedTrades(workspace);

  const candidates = [
    marketStrength(trades),
    holdDuration(trades),
    payoffBalance(trades),
    tradingFrequency(workspace, now),
    researchToRecord(workspace),
  ].filter((insight): insight is BehaviourInsight => insight !== null);

  const insights = candidates.filter((insight) => canSpeak(insight.evidence));

  return {
    insights: insights.sort(
      (a, b) => b.evidence.observations - a.evidence.observations,
    ),
    withheld: candidates.length - insights.length,
  };
}
