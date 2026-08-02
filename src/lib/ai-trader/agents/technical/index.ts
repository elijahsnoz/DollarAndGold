import type { MarketAnalysis } from "@/lib/ai/types";
import { signalFromTrend } from "../market";
import type { SuggestedTrade } from "../../types";

/** Below this, a level target isn't worth preferring over a plain ATR multiple. */
const MIN_RISK_REWARD = 1.5;
const STOP_ATR_MULTIPLE = 1.5;
const FALLBACK_TARGET_ATR_MULTIPLE = 2;

/**
 * Technical Analysis Agent: derives a suggested entry/stop/target from
 * figures the deterministic analysis engine already computed.
 *
 * The stop distance is built on ATR — the exact methodology this app's own
 * Learning Mode glossary teaches ("position sizing and stop placement should
 * be built on ATR, not on how much you are willing to lose"). The target
 * prefers the nearest level beyond entry, falling back to an ATR multiple
 * when no level clears a reasonable risk:reward. This never touches an LLM —
 * a stop-loss price is not something to let a language model improvise.
 */
export function buildSuggestion(analysis: MarketAnalysis): SuggestedTrade {
  const signal = signalFromTrend(analysis.trend.direction);
  const { price: entry, volatility, supports, resistances } = analysis;

  if (signal === "hold") {
    return {
      signal,
      entry: null,
      stopLoss: null,
      takeProfit: null,
      riskRewardRatio: null,
      note: "No trade suggested — the trend is neutral, with no decisive edge either way.",
    };
  }

  if (!Number.isFinite(volatility.atr) || volatility.atr <= 0) {
    return {
      signal,
      entry: null,
      stopLoss: null,
      takeProfit: null,
      riskRewardRatio: null,
      note: "No trade suggested — there isn't a reliable volatility reference for this market right now.",
    };
  }

  const stopDistance = volatility.atr * STOP_ATR_MULTIPLE;
  const stopLoss = signal === "buy" ? entry - stopDistance : entry + stopDistance;

  const levelTarget =
    signal === "buy"
      ? resistances.filter((level) => level > entry).sort((a, b) => a - b)[0]
      : supports.filter((level) => level < entry).sort((a, b) => b - a)[0];

  const levelReward = levelTarget !== undefined ? Math.abs(levelTarget - entry) : 0;
  const meetsMinimum = levelTarget !== undefined && levelReward / stopDistance >= MIN_RISK_REWARD;

  const takeProfit = meetsMinimum
    ? (levelTarget as number)
    : signal === "buy"
      ? entry + volatility.atr * FALLBACK_TARGET_ATR_MULTIPLE
      : entry - volatility.atr * FALLBACK_TARGET_ATR_MULTIPLE;

  const riskRewardRatio = Math.abs(takeProfit - entry) / stopDistance;

  return {
    signal,
    entry,
    stopLoss,
    takeProfit,
    riskRewardRatio,
    note: meetsMinimum
      ? `Target uses the nearest ${signal === "buy" ? "resistance" : "support"} that clears a ${MIN_RISK_REWARD}:1 minimum. Stop is ${STOP_ATR_MULTIPLE}× the current ATR beyond entry.`
      : `No nearby level cleared a ${MIN_RISK_REWARD}:1 minimum, so the target uses ${FALLBACK_TARGET_ATR_MULTIPLE}× ATR instead. Stop is ${STOP_ATR_MULTIPLE}× the current ATR beyond entry.`,
  };
}
