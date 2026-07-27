import { formatPrice, formatSignedPercent } from "@/lib/format";
import { requireAsset } from "@/lib/market/catalog";
import {
  atr,
  bollinger,
  ema,
  findLevels,
  lastValid,
  macd,
  realisedVolatility,
  rsi,
  sma,
} from "@/lib/market/indicators";
import { getMarketDataProvider } from "@/lib/market/provider";
import { TIMEFRAMES } from "@/lib/market/simulation";
import type {
  Asset,
  IndicatorReading,
  Series,
  Timeframe,
  TrendDirection,
} from "@/lib/market/types";
import { getNewsProvider } from "@/lib/news/provider";
import { clamp } from "@/lib/utils";
import type {
  MarketAnalysis,
  Scenario,
  TrendVerdict,
  VolatilityProfile,
} from "./types";

/**
 * The rules engine behind every AI Analysis page.
 *
 * It derives the full verdict — trend, confidence, levels, indicators,
 * scenarios, risks — from the candle series alone. The language model is an
 * optional narration layer on top (see `narrate.ts`); it never gets to invent a
 * number, only to explain the ones computed here. That separation is what makes
 * the analysis reproducible and keeps it consistent with the chart on screen.
 */

interface Contribution {
  label: string;
  signal: TrendDirection;
  weight: number;
  /** −1 … +1 */
  score: number;
}

function directionOf(score: number, threshold: number): TrendDirection {
  if (score > threshold) return "bullish";
  if (score < -threshold) return "bearish";
  return "neutral";
}

/**
 * Trend verdict from six weighted signals.
 *
 * Confidence is deliberately a measure of *agreement between indicators*, not a
 * probability that a trade works. A single very strong signal with everything
 * else flat should not read as high confidence, so the raw score is scaled by
 * how aligned the contributors are.
 */
function assessTrend(closes: number[], asset: Asset): TrendVerdict {
  const fastMa = ema(closes, 20);
  const slowMa = ema(closes, 50);
  const trendMa = sma(closes, Math.min(200, Math.floor(closes.length * 0.6)));
  const rsiSeries = rsi(closes, 14);
  const { histogram } = macd(closes);
  const bands = bollinger(closes, 20, 2);

  const price = closes[closes.length - 1];
  const contributions: Contribution[] = [];

  // 1. Price relative to the long moving average — the primary regime filter.
  const trendMaValue = lastValid(trendMa);
  if (Number.isFinite(trendMaValue)) {
    const distance = (price - trendMaValue) / trendMaValue;
    const score = clamp(distance * 22, -1, 1);
    contributions.push({
      label: "Price vs long-term average",
      signal: directionOf(score, 0.12),
      weight: 0.24,
      score,
    });
  }

  // 2. Fast/slow EMA relationship — momentum of the medium-term trend.
  const fast = lastValid(fastMa);
  const slow = lastValid(slowMa);
  if (Number.isFinite(fast) && Number.isFinite(slow) && slow !== 0) {
    const score = clamp(((fast - slow) / slow) * 45, -1, 1);
    contributions.push({
      label: "EMA 20 vs EMA 50",
      signal: directionOf(score, 0.12),
      weight: 0.22,
      score,
    });
  }

  // 3. MACD histogram, plus whether it is expanding or contracting.
  const hist = lastValid(histogram);
  const prevHist = histogram[histogram.length - 2];
  if (Number.isFinite(hist) && price !== 0) {
    const normalised = clamp((hist / price) * 900, -1, 1);
    const expanding =
      Number.isFinite(prevHist) && Math.abs(hist) > Math.abs(prevHist);
    const score = clamp(normalised * (expanding ? 1.15 : 0.8), -1, 1);
    contributions.push({
      label: "MACD momentum",
      signal: directionOf(score, 0.12),
      weight: 0.18,
      score,
    });
  }

  // 4. RSI, treated as a momentum reading rather than a contrarian one until
  //    it reaches a genuine extreme.
  const rsiValue = lastValid(rsiSeries);
  if (Number.isFinite(rsiValue)) {
    let score = (rsiValue - 50) / 30;
    if (rsiValue > 78) score = 0.25; // Overbought: momentum, but stretched.
    if (rsiValue < 22) score = -0.25;
    contributions.push({
      label: "RSI (14)",
      signal: directionOf(clamp(score, -1, 1), 0.15),
      weight: 0.14,
      score: clamp(score, -1, 1),
    });
  }

  // 5. Position within the Bollinger band.
  const upper = lastValid(bands.upper);
  const lower = lastValid(bands.lower);
  if (Number.isFinite(upper) && Number.isFinite(lower) && upper !== lower) {
    const position = (price - lower) / (upper - lower); // 0 … 1
    const score = clamp((position - 0.5) * 2, -1, 1);
    contributions.push({
      label: "Bollinger position",
      signal: directionOf(score, 0.2),
      weight: 0.1,
      score,
    });
  }

  // 6. Market structure: are recent swing highs and lows stepping up?
  const structureScore = assessStructure(closes);
  contributions.push({
    label: "Market structure",
    signal: directionOf(structureScore, 0.2),
    weight: 0.12,
    score: structureScore,
  });

  const totalWeight = contributions.reduce((sum, c) => sum + c.weight, 0) || 1;
  const composite =
    contributions.reduce((sum, c) => sum + c.score * c.weight, 0) / totalWeight;

  const direction = directionOf(composite, 0.14);

  // Agreement: share of weight pointing the same way as the composite.
  const agreeing = contributions
    .filter((c) => (composite >= 0 ? c.score > 0.05 : c.score < -0.05))
    .reduce((sum, c) => sum + c.weight, 0);
  const agreement = agreeing / totalWeight;

  const magnitude = Math.min(Math.abs(composite) / 0.55, 1);
  const raw = magnitude * 0.55 + agreement * 0.45;

  // Floor at 30 and cap at 88 — the product must never imply certainty.
  const confidence = Math.round(clamp(raw * 100, 30, 88));

  return {
    direction,
    confidence,
    headline: buildTrendHeadline(direction, confidence, asset),
    contributions: contributions.map(({ label, signal, weight }) => ({
      label,
      signal,
      weight,
    })),
  };
}

/** Higher highs / higher lows over the last two swing windows. */
function assessStructure(closes: number[]): number {
  const window = Math.max(6, Math.floor(closes.length / 6));
  if (closes.length < window * 3) return 0;

  const recent = closes.slice(-window);
  const middle = closes.slice(-window * 2, -window);
  const older = closes.slice(-window * 3, -window * 2);

  const highOf = (a: number[]) => Math.max(...a);
  const lowOf = (a: number[]) => Math.min(...a);

  let score = 0;
  if (highOf(recent) > highOf(middle)) score += 0.35;
  else score -= 0.35;
  if (lowOf(recent) > lowOf(middle)) score += 0.35;
  else score -= 0.35;
  if (highOf(middle) > highOf(older)) score += 0.15;
  else score -= 0.15;
  if (lowOf(middle) > lowOf(older)) score += 0.15;
  else score -= 0.15;

  return clamp(score, -1, 1);
}

function buildTrendHeadline(
  direction: TrendDirection,
  confidence: number,
  asset: Asset,
): string {
  const strength =
    confidence >= 72 ? "clearly" : confidence >= 55 ? "moderately" : "marginally";

  if (direction === "neutral") {
    return `${asset.name} is range-bound with no decisive edge either way`;
  }
  return `${asset.name} is ${strength} ${direction} on this timeframe`;
}

function buildIndicators(
  closes: number[],
  series: Series,
  asset: Asset,
): IndicatorReading[] {
  const readings: IndicatorReading[] = [];
  const price = closes[closes.length - 1];
  const p = asset.precision;

  // --- Moving averages ---
  const ema20 = lastValid(ema(closes, 20));
  const ema50 = lastValid(ema(closes, 50));
  const maSignal =
    Number.isFinite(ema20) && Number.isFinite(ema50)
      ? ema20 > ema50
        ? "bullish"
        : "bearish"
      : "neutral";

  readings.push({
    key: "ma",
    label: "Moving Averages",
    value: `${formatPrice(ema20, p)} / ${formatPrice(ema50, p)}`,
    signal: maSignal,
    interpretation:
      maSignal === "bullish"
        ? `The 20-period average sits above the 50-period average, which is the classic shape of an uptrend. Price above both means buyers have controlled the recent range.`
        : maSignal === "bearish"
          ? `The 20-period average has crossed below the 50-period average — sellers have had the upper hand and rallies have been sold into.`
          : `The two averages are effectively flat and intertwined, which is what a market with no trend looks like.`,
  });

  // --- RSI ---
  const rsiValue = lastValid(rsi(closes, 14));
  const rsiSignal =
    rsiValue > 70 ? "bearish" : rsiValue < 30 ? "bullish" : rsiValue > 55 ? "bullish" : rsiValue < 45 ? "bearish" : "neutral";

  readings.push({
    key: "rsi",
    label: "RSI (14)",
    value: rsiValue.toFixed(1),
    signal: rsiSignal,
    interpretation:
      rsiValue > 70
        ? `At ${rsiValue.toFixed(0)} the market is technically overbought. That is a sign of strength, not an automatic sell — but it does mean the easy part of the move is behind us and pullbacks get sharper.`
        : rsiValue < 30
          ? `At ${rsiValue.toFixed(0)} the market is oversold. Sellers have been in control long enough that bounces become more likely, though oversold markets can stay oversold in a strong downtrend.`
          : `At ${rsiValue.toFixed(0)} momentum is in the normal band — neither stretched nor exhausted, so RSI is not arguing for a reversal in either direction.`,
  });

  // --- MACD ---
  const { macd: macdLine, histogram } = macd(closes);
  const macdValue = lastValid(macdLine);
  const histValue = lastValid(histogram);
  const macdSignal = histValue > 0 ? "bullish" : histValue < 0 ? "bearish" : "neutral";

  readings.push({
    key: "macd",
    label: "MACD (12, 26, 9)",
    value: `${formatPrice(macdValue, Math.min(p + 2, 5))}`,
    signal: macdSignal,
    interpretation:
      histValue > 0
        ? `MACD is above its signal line, so short-term momentum is running ahead of the medium-term trend. Momentum is currently working for buyers.`
        : histValue < 0
          ? `MACD sits below its signal line — short-term momentum has rolled over relative to the medium-term trend, which typically precedes or confirms a pullback.`
          : `MACD is sitting on its signal line, which means momentum has stalled and is not confirming a direction.`,
  });

  // --- Volume ---
  const volumes = series.candles.map((c) => c.v);
  const avgVol = volumes.reduce((a, b) => a + b, 0) / Math.max(1, volumes.length);

  // Not every source publishes turnover — ECB reference rates are prices only.
  // Saying "participation is normal" when we hold no participation data would
  // be inventing a reading, which is the one thing this engine must never do.
  if (avgVol <= 0) {
    readings.push({
      key: "volume",
      label: "Volume",
      value: "Not published",
      signal: "neutral",
      interpretation: `The data source for ${asset.name} publishes prices but not traded volume, so there is no participation figure to read. That is a gap in the data, not a quiet market — treat any conclusion that would depend on volume as unsupported here.`,
    });
  } else {
    const recentVol =
      volumes.slice(-5).reduce((a, b) => a + b, 0) /
      Math.max(1, volumes.slice(-5).length);
    const volRatio = recentVol / avgVol;
    const rising =
      closes[closes.length - 1] >= closes[Math.max(0, closes.length - 6)];
    const volSignal =
      volRatio > 1.15 ? (rising ? "bullish" : "bearish") : "neutral";

    readings.push({
      key: "volume",
      label: "Volume",
      value: `${volRatio.toFixed(2)}× average`,
      signal: volSignal,
      interpretation:
        volRatio > 1.15
          ? `Recent activity is running ${Math.round((volRatio - 1) * 100)}% above the period average, and price is ${rising ? "rising" : "falling"} into it. Participation confirming the move is what separates a real trend from drift.`
          : volRatio < 0.85
            ? `Activity is ${Math.round((1 - volRatio) * 100)}% below average. Thin participation makes the current move easier to reverse and less reliable as a signal.`
            : `Volume is close to its period average — participation is normal and is neither confirming nor contradicting the price move.`,
    });
  }

  // --- Volatility ---
  const atrSeries = atr(series.candles, 14);
  const atrValue = lastValid(atrSeries);
  const atrPercent = price === 0 ? 0 : (atrValue / price) * 100;

  readings.push({
    key: "volatility",
    label: "Volatility (ATR 14)",
    value: `${formatPrice(atrValue, p)} (${atrPercent.toFixed(2)}%)`,
    signal: "neutral",
    interpretation: `The market has been moving about ${formatPrice(atrValue, p)} per bar, or ${atrPercent.toFixed(2)}% of price. This is the number position sizing and stop placement should be built around — a stop tighter than this will be hit by ordinary noise.`,
  });

  return readings;
}

function buildVolatility(
  closes: number[],
  series: Series,
  asset: Asset,
): VolatilityProfile {
  const spec = TIMEFRAMES[series.timeframe];
  const annualised = realisedVolatility(closes, spec.periodsPerYear);
  const atrValue = lastValid(atr(series.candles, 14));
  const price = closes[closes.length - 1];
  const atrPercent = price === 0 ? 0 : (atrValue / price) * 100;

  // Compare against a rough long-run normal for the asset class.
  const classNormal: Record<string, number> = {
    forex: 9,
    index: 16,
    stock: 28,
    commodity: 18,
    energy: 34,
    crypto: 52,
  };
  const normal = classNormal[asset.assetClass] ?? 20;
  const ratio = normal === 0 ? 1 : annualised / normal;

  const regime =
    ratio > 1.6 ? "high" : ratio > 1.2 ? "elevated" : ratio < 0.7 ? "low" : "normal";

  const description =
    regime === "high"
      ? `Realised volatility is running well above what is normal for ${asset.name}. Ranges are wide, stops need more room, and position sizes should be smaller than usual to keep risk constant.`
      : regime === "elevated"
        ? `Volatility is above its typical level for this market. Expect larger swings than usual in both directions and size positions accordingly.`
        : regime === "low"
          ? `Volatility is compressed relative to normal. Quiet markets tend to precede expansion, so this is a setup for a breakout rather than a reason to expect continued calm.`
          : `Volatility is around its normal level for this market — no particular warning signal from the range itself.`;

  return {
    annualisedPct: annualised,
    atr: atrValue,
    atrPercent,
    regime,
    description,
  };
}

function buildScenarios(
  asset: Asset,
  price: number,
  supports: number[],
  resistances: number[],
  volatility: VolatilityProfile,
  trend: TrendVerdict,
): { bullCase: Scenario; bearCase: Scenario } {
  const p = asset.precision;
  const nearestResistance = resistances[0] ?? price * 1.02;
  const secondResistance = resistances[1] ?? nearestResistance * 1.02;
  const nearestSupport = supports[0] ?? price * 0.98;
  const secondSupport = supports[1] ?? nearestSupport * 0.98;

  const atrText = formatPrice(volatility.atr, p);

  const bullCase: Scenario = {
    title: "Potential bullish scenario",
    trigger: `A daily close above ${formatPrice(nearestResistance, p)} on above-average volume`,
    objective: `${formatPrice(secondResistance, p)} as the next area where sellers have previously stepped in`,
    invalidation: `A move back below ${formatPrice(nearestSupport, p)} would void this idea`,
    narrative: `If buyers can absorb the supply sitting at ${formatPrice(nearestResistance, p)} and hold above it into a close, the path of least resistance opens toward ${formatPrice(secondResistance, p)}. ${
      trend.direction === "bullish"
        ? "The broader trend already supports this, so it would be continuation rather than a reversal."
        : trend.direction === "bearish"
          ? "This would be counter-trend, so it needs stronger confirmation than usual — a single spike through the level is not enough."
          : "In a range-bound market a clean break is what resolves the indecision, so the volume behind it matters more than the break itself."
    } Given the market is moving roughly ${atrText} per bar, allow at least that much room before treating a wick through the level as a real breakout.`,
  };

  const bearCase: Scenario = {
    title: "Potential bearish scenario",
    trigger: `Losing ${formatPrice(nearestSupport, p)} and failing to reclaim it`,
    objective: `${formatPrice(secondSupport, p)}, the next level where buyers previously defended`,
    invalidation: `Reclaiming ${formatPrice(nearestResistance, p)} would void this idea`,
    narrative: `If ${formatPrice(nearestSupport, p)} gives way and the market cannot recover it quickly, the next obvious area of interest is ${formatPrice(secondSupport, p)}. ${
      trend.direction === "bearish"
        ? "This aligns with the prevailing trend, which makes it the higher-probability of the two paths here."
        : trend.direction === "bullish"
          ? "This runs against the prevailing trend, so it would most likely need a catalyst rather than developing on its own."
          : "With no trend in place, a failure at support is as likely to resolve the range as a break higher."
    } ${
      volatility.regime === "high" || volatility.regime === "elevated"
        ? "With volatility elevated, a break can travel a long way quickly — the first move is often the largest."
        : "With volatility contained, expect the move to develop over several bars rather than in one impulse."
    }`,
  };

  return { bullCase, bearCase };
}

const CLASS_RISKS: Record<string, string[]> = {
  forex: [
    "Central bank speakers can reprice the whole curve in seconds, and FX gaps over weekends.",
    "Leverage is typically highest in FX, so ordinary moves produce outsized account impact.",
  ],
  crypto: [
    "Crypto trades 24/7, so a position can move substantially while you are asleep with no session close to protect you.",
    "Liquidity thins dramatically during weekends and holidays, which exaggerates both directions.",
    "Regulatory headlines remain the single largest source of unhedgeable overnight risk.",
  ],
  commodity: [
    "Physical markets are exposed to supply shocks that no chart can anticipate.",
    "Futures roll and contango can erode returns for anyone holding through expiry.",
  ],
  energy: [
    "Geopolitical events move crude faster than any technical level can account for.",
    "Weekly inventory data routinely produces multi-percent moves within minutes of release.",
  ],
  index: [
    "Index moves are increasingly driven by a handful of megacap names, so concentration risk is higher than the diversification implies.",
    "Overnight gaps between the cash close and the next open can jump straight through a stop.",
  ],
  stock: [
    "Single-name equity carries idiosyncratic risk — earnings, guidance and management changes can override any technical picture.",
    "Earnings dates create scheduled gap risk that stops cannot protect against.",
  ],
};

function buildRisks(asset: Asset, volatility: VolatilityProfile, trend: TrendVerdict) {
  const risks: string[] = [];

  risks.push(
    "This analysis reads price history. It cannot anticipate news, and markets reprice on news faster than any indicator updates.",
  );

  if (volatility.regime === "high" || volatility.regime === "elevated") {
    risks.push(
      `Volatility is ${volatility.regime} at roughly ${volatility.annualisedPct.toFixed(0)}% annualised, so the usual position size carries more risk than usual right now.`,
    );
  }

  if (trend.confidence < 50) {
    risks.push(
      "Indicators disagree with each other on this timeframe, which historically means choppy conditions and a higher rate of false signals.",
    );
  }

  risks.push(...(CLASS_RISKS[asset.assetClass] ?? []));

  return risks.slice(0, 5);
}

const CLASS_EVENTS: Record<string, string[]> = {
  forex: [
    "Central bank rate decisions and the accompanying statement language",
    "Monthly inflation (CPI) and employment releases for both currencies in the pair",
    "Scheduled speeches from voting policy committee members",
  ],
  crypto: [
    "Spot ETF flow data, published daily",
    "Exchange reserve balances and large on-chain transfers",
    "Regulatory announcements and enforcement actions in major jurisdictions",
  ],
  commodity: [
    "Central bank reserve reports and official-sector buying data",
    "US real yields and the dollar index, the two dominant macro drivers",
    "Physical demand data from the largest consuming markets",
  ],
  energy: [
    "Weekly crude and product inventory reports",
    "OPEC+ meetings and any change to production guidance",
    "Geopolitical developments in major producing regions",
  ],
  index: [
    "Megacap earnings, which drive a disproportionate share of index moves",
    "Federal Reserve policy decisions and the projection materials",
    "Monthly inflation and labour market data",
  ],
  stock: [
    "The next quarterly earnings date and guidance revisions",
    "Sector-wide news affecting comparable companies",
    "Analyst rating changes and index inclusion or removal",
  ],
};

/**
 * Produce a complete analysis for an asset.
 *
 * Pure with respect to the data it is given: same series in, same verdict out.
 */
export async function analyseAsset(
  symbol: string,
  timeframe: Timeframe = "3M",
): Promise<MarketAnalysis> {
  const asset = requireAsset(symbol);
  const provider = getMarketDataProvider();

  const [series, quote, news] = await Promise.all([
    provider.getSeries(asset.symbol, timeframe),
    provider.getQuote(asset.symbol),
    getNewsProvider().getArticles({ symbol: asset.symbol, limit: 4 }),
  ]);

  const closes = series.candles.map((c) => c.c);
  const price = quote.price;

  const trend = assessTrend(closes, asset);
  // Classify levels against the live quote — the number the page displays —
  // not the last bar's close, which can be a full session stale.
  const { supports, resistances } = findLevels(series.candles, price, 3, 3);
  const indicators = buildIndicators(closes, series, asset);
  const volatility = buildVolatility(closes, series, asset);
  const { bullCase, bearCase } = buildScenarios(
    asset,
    price,
    supports,
    resistances,
    volatility,
    trend,
  );

  const summary = buildSummary({
    asset,
    quote: { price, changePercent: quote.changePercent },
    timeframe,
    trend,
    supports,
    resistances,
    volatility,
    indicators,
  });

  return {
    symbol: asset.symbol,
    assetName: asset.name,
    timeframe,
    generatedAt: Date.now(),
    price,
    changePercent: quote.changePercent,
    trend,
    supports,
    resistances,
    indicators,
    volatility,
    bullCase,
    bearCase,
    risks: buildRisks(asset, volatility, trend),
    eventsToWatch: CLASS_EVENTS[asset.assetClass] ?? [],
    news,
    summary,
    narrator: "rules",
  };
}

function buildSummary(input: {
  asset: Asset;
  quote: { price: number; changePercent: number };
  timeframe: Timeframe;
  trend: TrendVerdict;
  supports: number[];
  resistances: number[];
  volatility: VolatilityProfile;
  indicators: IndicatorReading[];
}): string {
  const { asset, quote, timeframe, trend, supports, resistances, volatility } = input;
  const p = asset.precision;
  const spec = TIMEFRAMES[timeframe];

  // Count the weighted trend signals, not the five display indicators. They are
  // different sets, and quoting one alongside a confidence derived from the
  // other reads as a contradiction ("2 of 5 agree — confidence 88/100").
  const agreeing = trend.contributions.filter(
    (c) => c.signal === trend.direction,
  ).length;
  const totalSignals = trend.contributions.length;

  const directionText =
    trend.direction === "neutral"
      ? "has no clear directional bias"
      : `is leaning ${trend.direction}`;

  return [
    `${asset.name} is trading at ${formatPrice(quote.price, p)}, ${formatSignedPercent(quote.changePercent)} over the last 24 hours. Across the last ${spec.label}, the market ${directionText}, with ${agreeing} of ${totalSignals} signals pointing the same way — a confidence reading of ${trend.confidence} out of 100.`,
    `The level that matters on the downside is ${formatPrice(supports[0] ?? quote.price * 0.98, p)}; on the upside it is ${formatPrice(resistances[0] ?? quote.price * 1.02, p)}. Between those two, the market is doing nothing informative and there is no edge in forcing a position.`,
    volatility.description,
    `What would change this read: a decisive close outside that range on convincing volume, or a scheduled event that reprices the underlying story — ${asset.drivers.slice(0, 2).join(" and ")} are what actually drive ${asset.name}, and no amount of chart reading substitutes for knowing what is on the calendar.`,
  ].join("\n\n");
}
