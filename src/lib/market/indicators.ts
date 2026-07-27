import type { Candle, IndicatorSignal } from "./types";

/**
 * Technical indicator math.
 *
 * These are real calculations over the candle series — the AI narrator is only
 * ever handed numbers produced here, never asked to invent them. That is what
 * keeps the written analysis consistent with the chart the user is looking at.
 */

export function sma(values: number[], period: number): number[] {
  const out: number[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    out.push(i >= period - 1 ? sum / period : NaN);
  }
  return out;
}

export function ema(values: number[], period: number): number[] {
  const out: number[] = [];
  const k = 2 / (period + 1);
  let prev = NaN;

  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      out.push(NaN);
      continue;
    }
    if (i === period - 1) {
      // Seed the EMA with the SMA of the first full window.
      let sum = 0;
      for (let j = 0; j < period; j++) sum += values[i - j];
      prev = sum / period;
    } else {
      prev = values[i] * k + prev * (1 - k);
    }
    out.push(prev);
  }
  return out;
}

/** Wilder's RSI. Returns values in 0–100, NaN until the first full window. */
export function rsi(values: number[], period = 14): number[] {
  const out: number[] = new Array(values.length).fill(NaN);
  if (values.length <= period) return out;

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) avgGain += diff;
    else avgLoss -= diff;
  }
  avgGain /= period;
  avgLoss /= period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    // Wilder smoothing.
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

export interface MacdResult {
  macd: number[];
  signal: number[];
  histogram: number[];
}

export function macd(
  values: number[],
  fast = 12,
  slow = 26,
  signalPeriod = 9,
): MacdResult {
  const fastEma = ema(values, fast);
  const slowEma = ema(values, slow);
  const macdLine = values.map((_, i) => fastEma[i] - slowEma[i]);

  // The signal line is an EMA of the MACD line, so it must ignore the leading
  // NaNs rather than propagate them.
  const firstValid = macdLine.findIndex((v) => Number.isFinite(v));
  const trimmed = firstValid === -1 ? [] : macdLine.slice(firstValid);
  const signalTrimmed = ema(trimmed, signalPeriod);

  const signal = new Array<number>(values.length).fill(NaN);
  if (firstValid !== -1) {
    for (let i = 0; i < signalTrimmed.length; i++) {
      signal[firstValid + i] = signalTrimmed[i];
    }
  }

  const histogram = macdLine.map((v, i) => v - signal[i]);
  return { macd: macdLine, signal, histogram };
}

export interface BollingerResult {
  upper: number[];
  middle: number[];
  lower: number[];
}

export function bollinger(
  values: number[],
  period = 20,
  multiplier = 2,
): BollingerResult {
  const middle = sma(values, period);
  const upper: number[] = [];
  const lower: number[] = [];

  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      upper.push(NaN);
      lower.push(NaN);
      continue;
    }
    let variance = 0;
    for (let j = 0; j < period; j++) {
      variance += (values[i - j] - middle[i]) ** 2;
    }
    const sd = Math.sqrt(variance / period);
    upper.push(middle[i] + multiplier * sd);
    lower.push(middle[i] - multiplier * sd);
  }
  return { upper, middle, lower };
}

/** Average True Range (Wilder), the volatility measure used across the app. */
export function atr(candles: Candle[], period = 14): number[] {
  const out: number[] = new Array(candles.length).fill(NaN);
  if (candles.length <= period) return out;

  const trueRanges: number[] = [0];
  for (let i = 1; i < candles.length; i++) {
    const prevClose = candles[i - 1].c;
    trueRanges.push(
      Math.max(
        candles[i].h - candles[i].l,
        Math.abs(candles[i].h - prevClose),
        Math.abs(candles[i].l - prevClose),
      ),
    );
  }

  let avg = 0;
  for (let i = 1; i <= period; i++) avg += trueRanges[i];
  avg /= period;
  out[period] = avg;

  for (let i = period + 1; i < candles.length; i++) {
    avg = (avg * (period - 1) + trueRanges[i]) / period;
    out[i] = avg;
  }
  return out;
}

/** Annualised realised volatility from close-to-close log returns, in %. */
export function realisedVolatility(values: number[], periodsPerYear = 252): number {
  const returns: number[] = [];
  for (let i = 1; i < values.length; i++) {
    if (values[i - 1] > 0) returns.push(Math.log(values[i] / values[i - 1]));
  }
  if (returns.length < 2) return 0;

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance =
    returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(periodsPerYear) * 100;
}

export interface PivotLevels {
  supports: number[];
  resistances: number[];
}

/**
 * Swing-based support and resistance.
 *
 * We collect fractal pivots (a high/low that dominates `lookback` bars on both
 * sides), cluster them within a volatility-scaled tolerance so near-identical
 * touches count as one level, and rank by how often price respected each.
 *
 * Levels are classified against `reference` — the price the user is actually
 * looking at — rather than against the series' own last close. Those two differ
 * whenever the live quote has moved since the last bar closed, and classifying
 * against the wrong one puts "support" above the current price. A level that
 * price has traded through simply flips role, which is how support-turned-
 * resistance works in practice, so origin (pivot high vs low) does not decide
 * the label; position relative to price does.
 */
export function findLevels(
  candles: Candle[],
  reference: number,
  lookback = 3,
  maxLevels = 3,
): PivotLevels {
  if (candles.length < lookback * 2 + 1) return { supports: [], resistances: [] };

  const last = Number.isFinite(reference) && reference > 0
    ? reference
    : candles[candles.length - 1].c;
  const range = Math.max(...candles.map((c) => c.h)) - Math.min(...candles.map((c) => c.l));
  const tolerance = Math.max(range * 0.012, last * 0.0015);

  const highs: number[] = [];
  const lows: number[] = [];

  for (let i = lookback; i < candles.length - lookback; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = 1; j <= lookback; j++) {
      if (candles[i].h <= candles[i - j].h || candles[i].h <= candles[i + j].h) {
        isHigh = false;
      }
      if (candles[i].l >= candles[i - j].l || candles[i].l >= candles[i + j].l) {
        isLow = false;
      }
    }
    if (isHigh) highs.push(candles[i].h);
    if (isLow) lows.push(candles[i].l);
  }

  const cluster = (points: number[]) => {
    const clusters: { level: number; touches: number }[] = [];
    for (const p of points.sort((a, b) => a - b)) {
      const existing = clusters.find((c) => Math.abs(c.level - p) <= tolerance);
      if (existing) {
        // Running mean keeps the level centred on all its touches.
        existing.level =
          (existing.level * existing.touches + p) / (existing.touches + 1);
        existing.touches += 1;
      } else {
        clusters.push({ level: p, touches: 1 });
      }
    }
    return clusters;
  };

  // Highs and lows are clustered separately (they are different events), then
  // merged so a level confirmed by both a pivot high and a pivot low counts
  // once, with its touches combined.
  const merged: { level: number; touches: number }[] = [];
  for (const candidate of [...cluster(highs), ...cluster(lows)]) {
    const existing = merged.find(
      (m) => Math.abs(m.level - candidate.level) <= tolerance,
    );
    if (existing) {
      const total = existing.touches + candidate.touches;
      existing.level =
        (existing.level * existing.touches +
          candidate.level * candidate.touches) /
        total;
      existing.touches = total;
    } else {
      merged.push({ ...candidate });
    }
  }

  const resistances = merged
    .filter((c) => c.level > last)
    .sort((a, b) => b.touches - a.touches || a.level - b.level)
    .slice(0, maxLevels)
    .map((c) => c.level)
    .sort((a, b) => a - b);

  const supports = merged
    .filter((c) => c.level < last)
    .sort((a, b) => b.touches - a.touches || b.level - a.level)
    .slice(0, maxLevels)
    .map((c) => c.level)
    .sort((a, b) => b - a);

  // At an extreme there may be no pivot on one side. Fall back to the window's
  // own high/low — but only if it is actually beyond the current price, since
  // at a breakout it will not be. Otherwise offset from price by the window's
  // typical range, so the level is always on the side it claims to be on.
  const recent = candles.slice(-60);
  const offset = Math.max(range * 0.05, last * 0.005);

  if (resistances.length === 0) {
    const windowHigh = Math.max(...recent.map((c) => c.h));
    resistances.push(windowHigh > last ? windowHigh : last + offset);
  }
  if (supports.length === 0) {
    const windowLow = Math.min(...recent.map((c) => c.l));
    supports.push(windowLow < last ? windowLow : last - offset);
  }

  return { supports, resistances };
}

/** Last finite value in a series produced by the functions above. */
export function lastValid(values: number[]): number {
  for (let i = values.length - 1; i >= 0; i--) {
    if (Number.isFinite(values[i])) return values[i];
  }
  return NaN;
}

export function signalFrom(score: number, threshold = 0.15): IndicatorSignal {
  if (score > threshold) return "bullish";
  if (score < -threshold) return "bearish";
  return "neutral";
}
