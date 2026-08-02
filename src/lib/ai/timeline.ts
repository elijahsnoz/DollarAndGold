import { assessMove } from "@/lib/briefing/materiality";
import { formatPrice } from "@/lib/format";
import { atr, ema } from "@/lib/market/indicators";
import type { Candle, TrendDirection } from "@/lib/market/types";
import type { NewsArticle } from "@/lib/news/types";

/**
 * The Market Timeline: how today's analysis evolved.
 *
 * Deliberately reuses rather than reinvents:
 * - "Major move" uses the exact same ATR-relative materiality scoring as the
 *   Silence Engine (`assessMove`), so "notable" means the same thing here as
 *   it does in the daily briefing — a 2% day is routine for Bitcoin and
 *   extraordinary for EUR/USD, and one rule has to be correct for both.
 * - "Trend reversal" is the 20/50 EMA cross — the same medium-term-trend
 *   signal `analyseAsset` already computes as one of the six weighted trend
 *   contributions, not a separately invented definition.
 * - "Level break" checks the candle series against *today's* support and
 *   resistance (`findLevels`'s output), so an entry reads "price crossed the
 *   level that matters right now" rather than claiming to reconstruct what
 *   was support or resistance at some point in the past.
 *
 * Everything here is pure arithmetic over a candle series that has already
 * been fetched — no extra network round trip, and nothing here is asked to
 * invent a fact the candles don't support.
 */

export type TimelineEventKind =
  | "price-move"
  | "trend-reversal"
  | "level-break"
  | "news";

export interface TimelineEvent {
  at: number;
  kind: TimelineEventKind;
  direction: TrendDirection;
  title: string;
  detail: string;
}

function priceMoveEvents(candles: Candle[]): TimelineEvent[] {
  if (candles.length < 15) return [];

  const atrSeries = atr(candles, 14);
  const events: TimelineEvent[] = [];

  for (let i = 1; i < candles.length; i++) {
    const prevClose = candles[i - 1].c;
    const atrValue = atrSeries[i];
    if (prevClose <= 0 || !Number.isFinite(atrValue) || atrValue <= 0) continue;

    const changePercent = ((candles[i].c - prevClose) / prevClose) * 100;
    const atrPercent = (atrValue / prevClose) * 100;
    const verdict = assessMove(changePercent, atrPercent);
    if (!verdict.material) continue;

    events.push({
      at: candles[i].t,
      kind: "price-move",
      direction: changePercent > 0 ? "bullish" : "bearish",
      title: `${changePercent > 0 ? "Jumped" : "Dropped"} ${Math.abs(changePercent).toFixed(2)}% in one bar`,
      detail: `A genuinely large move for this market, not just a large-looking percentage — it ${verdict.basis}.`,
    });
  }

  return events;
}

function trendReversalEvents(candles: Candle[]): TimelineEvent[] {
  const closes = candles.map((c) => c.c);
  const fast = ema(closes, 20);
  const slow = ema(closes, 50);
  const events: TimelineEvent[] = [];
  let prevSign = 0;

  for (let i = 0; i < candles.length; i++) {
    if (!Number.isFinite(fast[i]) || !Number.isFinite(slow[i])) continue;
    const sign = Math.sign(fast[i] - slow[i]);
    if (sign === 0) continue;

    if (prevSign !== 0 && sign !== prevSign) {
      events.push({
        at: candles[i].t,
        kind: "trend-reversal",
        direction: sign > 0 ? "bullish" : "bearish",
        title: sign > 0 ? "Medium-term trend turned bullish" : "Medium-term trend turned bearish",
        detail: `The 20-period average crossed ${sign > 0 ? "above" : "below"} the 50-period average — the same signal behind this page's trend verdict.`,
      });
    }
    prevSign = sign;
  }

  return events;
}

function levelBreakEvents(
  candles: Candle[],
  levels: number[],
  side: "support" | "resistance",
  precision: number,
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const level of levels) {
    for (let i = 1; i < candles.length; i++) {
      const prevClose = candles[i - 1].c;
      const close = candles[i].c;
      const broke =
        side === "resistance" ? prevClose <= level && close > level : prevClose >= level && close < level;
      if (!broke) continue;

      events.push({
        at: candles[i].t,
        kind: "level-break",
        direction: side === "resistance" ? "bullish" : "bearish",
        title: `Closed ${side === "resistance" ? "above" : "below"} ${formatPrice(level, precision)}`,
        detail: `That price is one of today's key levels — this is when price last closed on the other side of it.`,
      });
    }
  }

  return events;
}

function newsEvents(news: NewsArticle[]): TimelineEvent[] {
  return news.map((article) => ({
    at: article.publishedAt,
    kind: "news",
    direction: article.impact.direction === "mixed" ? "neutral" : article.impact.direction,
    title: article.headline,
    detail: article.summary,
  }));
}

export function buildTimeline({
  candles,
  supports,
  resistances,
  news,
  precision,
}: {
  candles: Candle[];
  supports: number[];
  resistances: number[];
  news: NewsArticle[];
  precision: number;
}): TimelineEvent[] {
  return [
    ...priceMoveEvents(candles),
    ...trendReversalEvents(candles),
    ...levelBreakEvents(candles, resistances, "resistance", precision),
    ...levelBreakEvents(candles, supports, "support", precision),
    ...newsEvents(news),
  ].sort((a, b) => b.at - a.at);
}
