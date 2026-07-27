import type { Candle, Timeframe } from "./types";

/**
 * Deterministic market simulation.
 *
 * The MVP ships without paid market-data credentials, so prices come from a
 * synthetic model instead. Two properties matter and both are deliberate:
 *
 *  1. **Deterministic** — price is a pure function of (symbol, timestamp). The
 *     server and the client therefore compute identical values for the same
 *     instant, which means no hydration mismatch and no flicker on refresh.
 *  2. **Continuous** — built from smoothed value noise rather than a fresh
 *     random draw per bar, so the series trends, consolidates and breaks out
 *     the way a real chart does instead of looking like white noise.
 *
 * Swap this for a live feed by implementing `MarketDataProvider` — nothing in
 * the UI or the analysis engine depends on this file.
 */

/** Deterministic 32-bit hash of an integer and a seed, mapped to [0, 1). */
function hash1(n: number, seed: number): number {
  let h = Math.imul(n ^ seed, 0x27d4eb2d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Stable string -> 32-bit seed. */
export function seedFromString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Smoothstep-interpolated 1D value noise. Continuous and differentiable. */
function valueNoise(x: number, seed: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const a = hash1(i, seed);
  const b = hash1(i + 1, seed);
  const t = f * f * (3 - 2 * f);
  return a + (b - a) * t;
}

/** Fractal Brownian motion — layered noise, centred on zero. */
function fbm(x: number, seed: number, octaves = 5): number {
  let amplitude = 1;
  let frequency = 1;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += (valueNoise(x * frequency, seed + o * 7919) - 0.5) * amplitude;
    norm += amplitude;
    amplitude *= 0.55;
    frequency *= 2;
  }
  return sum / norm;
}

export interface AssetModel {
  /** Price the series oscillates around, in quote currency. */
  base: number;
  /** Annualised volatility as a decimal, e.g. 0.16 = 16%. */
  vol: number;
  /** Annualised drift as a decimal. */
  drift: number;
  /** Typical 24h notional volume, used as the scale for volume bars. */
  volume: number;
}

/**
 * Per-asset parameters. Base prices are plausible mid-2026 levels; they anchor
 * the simulation and are not quoted as real market data anywhere in the UI.
 */
export const ASSET_MODELS: Record<string, AssetModel> = {
  XAUUSD: { base: 3320, vol: 0.15, drift: 0.09, volume: 182_000_000_000 },
  BTCUSD: { base: 96_400, vol: 0.48, drift: 0.22, volume: 41_000_000_000 },
  ETHUSD: { base: 3_180, vol: 0.55, drift: 0.14, volume: 19_500_000_000 },
  EURUSD: { base: 1.0865, vol: 0.07, drift: -0.01, volume: 640_000_000_000 },
  GBPUSD: { base: 1.2740, vol: 0.08, drift: 0.012, volume: 310_000_000_000 },
  USDJPY: { base: 151.85, vol: 0.09, drift: 0.03, volume: 480_000_000_000 },
  NDX: { base: 21_450, vol: 0.21, drift: 0.13, volume: 8_900_000_000 },
  SPX: { base: 5_940, vol: 0.14, drift: 0.09, volume: 12_400_000_000 },
  WTIUSD: { base: 71.4, vol: 0.34, drift: -0.04, volume: 3_100_000_000 },
  XAGUSD: { base: 38.2, vol: 0.26, drift: 0.11, volume: 6_400_000_000 },
  SOLUSD: { base: 168.5, vol: 0.72, drift: 0.19, volume: 4_800_000_000 },
  DXY: { base: 104.35, vol: 0.06, drift: 0.005, volume: 0 },
  AUDUSD: { base: 0.6585, vol: 0.09, drift: -0.02, volume: 120_000_000_000 },
  AAPL: { base: 238.4, vol: 0.24, drift: 0.1, volume: 9_200_000_000 },
  NVDA: { base: 141.7, vol: 0.45, drift: 0.28, volume: 24_000_000_000 },
  TSLA: { base: 348.2, vol: 0.52, drift: 0.06, volume: 18_000_000_000 },
};

const DEFAULT_MODEL: AssetModel = {
  base: 100,
  vol: 0.2,
  drift: 0.05,
  volume: 1_000_000_000,
};

export function getModel(symbol: string): AssetModel {
  return ASSET_MODELS[symbol.toUpperCase()] ?? DEFAULT_MODEL;
}

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** Anchor for the simulation's time axis: 2026-01-01T00:00:00Z. */
export const SIM_EPOCH = Date.UTC(2026, 0, 1);

export interface TimeframeSpec {
  /** Bar duration in ms. */
  interval: number;
  /** Number of bars returned. */
  bars: number;
  /** Trading periods per year — feeds annualised volatility. */
  periodsPerYear: number;
  label: string;
}

export const TIMEFRAMES: Record<Timeframe, TimeframeSpec> = {
  "1D": { interval: 15 * MINUTE, bars: 96, periodsPerYear: 252 * 26, label: "24 hours" },
  "1W": { interval: HOUR, bars: 168, periodsPerYear: 252 * 6.5, label: "7 days" },
  "1M": { interval: DAY, bars: 30, periodsPerYear: 252, label: "30 days" },
  "3M": { interval: DAY, bars: 90, periodsPerYear: 252, label: "3 months" },
  "1Y": { interval: DAY, bars: 365, periodsPerYear: 252, label: "1 year" },
};

/**
 * Price of `symbol` at an arbitrary instant.
 *
 * Log-price is a drift term plus multi-scale noise, so the same asset shows
 * short-term chop layered on a slow trend regardless of which timeframe is
 * being rendered — the 1D and 1Y charts stay consistent with each other.
 */
export function priceAt(symbol: string, timestamp: number): number {
  const model = getModel(symbol);
  const seed = seedFromString(symbol.toUpperCase());
  // Years are measured from a fixed recent epoch so the drift term stays small
  // and the base price remains the level the series actually trades around.
  const years = (timestamp - SIM_EPOCH) / (365 * DAY);

  // Three noise scales: a multi-month regime, a multi-day swing, intraday chop.
  const slow = fbm(years * 3.2, seed, 4) * model.vol * 1.9;
  const medium = fbm(years * 52, seed + 101, 4) * model.vol * 0.62;
  const fast = fbm(years * 1460, seed + 337, 3) * model.vol * 0.16;

  const logPrice = Math.log(model.base) + model.drift * years + slow + medium + fast;

  return Math.exp(logPrice);
}

/**
 * Build a candle series ending at `now`.
 *
 * Highs and lows are sampled inside each bar rather than derived from open and
 * close, so wicks behave and ATR is meaningful.
 */
export function generateCandles(
  symbol: string,
  timeframe: Timeframe,
  now: number,
): Candle[] {
  const spec = TIMEFRAMES[timeframe];
  const model = getModel(symbol);
  const seed = seedFromString(symbol.toUpperCase());
  const candles: Candle[] = [];

  // Snap to the bar grid so the series only advances when a bar actually closes.
  const lastBarStart = Math.floor(now / spec.interval) * spec.interval;
  const SUBSTEPS = 6;

  for (let i = spec.bars - 1; i >= 0; i--) {
    const t = lastBarStart - i * spec.interval;
    const o = priceAt(symbol, t);
    const c = priceAt(symbol, t + spec.interval);

    let h = Math.max(o, c);
    let l = Math.min(o, c);
    for (let s = 1; s < SUBSTEPS; s++) {
      const p = priceAt(symbol, t + (spec.interval * s) / SUBSTEPS);
      if (p > h) h = p;
      if (p < l) l = p;
    }

    // Widen the wick slightly so bars aren't perfectly bounded by the samples.
    const wick = (h - l) * (0.12 + hash1(t / spec.interval, seed + 5) * 0.35);
    h += wick * 0.5;
    l -= wick * 0.5;

    // Volume rises with the bar's true range — the usual real-market coupling.
    const barShare = spec.interval / DAY;
    const rangePct = o > 0 ? (h - l) / o : 0;
    const activity =
      0.65 + hash1(t / spec.interval, seed + 11) * 0.7 + rangePct * 14;

    candles.push({
      t,
      o,
      h,
      l,
      c,
      v: Math.max(0, model.volume * barShare * activity),
    });
  }

  return candles;
}
