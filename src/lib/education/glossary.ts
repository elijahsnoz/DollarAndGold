/**
 * The single source of truth for "what does this mean" copy.
 *
 * Two surfaces read from here: the chat assistant's offline glossary answers
 * (`full`, used when no Anthropic key is configured) and Learning Mode's hover
 * tooltips (`short`, terse enough to fit a popover). Keeping one entry per
 * concept means a chart label and a chat answer can never drift apart, and
 * adding a new term teaches it everywhere at once.
 */

export interface GlossaryEntry {
  id: string;
  term: string;
  /** One or two sentences — sized for a hover tooltip. */
  short: string;
  /** The longer explanation — sized for a chat reply. */
  full: string;
  /** Extra phrases the chat assistant matches on, beyond the term itself. */
  keywords: string[];
}

export const GLOSSARY: GlossaryEntry[] = [
  {
    id: "rsi",
    term: "RSI",
    short:
      "Measures how stretched a recent move is, on a scale of 0–100. Above 70 is 'overbought', below 30 is 'oversold' — not buy or sell signals by themselves.",
    full: `**RSI** — the Relative Strength Index — measures how much of a market's recent movement has been upward versus downward, on a scale of 0 to 100.\n\nAbove 70 is called "overbought": the market has risen hard and fast. Below 30 is "oversold". The common mistake is treating those as buy and sell signals. They are not. A strong trend can hold RSI above 70 for weeks. It is better read as a measure of how stretched the current move is — and therefore how sharp a pullback might be when it comes.`,
    keywords: ["relative strength"],
  },
  {
    id: "macd",
    term: "MACD",
    short:
      "Compares a fast and slow moving average. When the fast one crosses above the slow one, short-term momentum is outrunning the trend — read as bullish, and the reverse for bearish.",
    full: `**MACD** compares two moving averages of price — a fast one and a slow one — and plots the gap between them.\n\nWhen the fast average pulls above the slow one, short-term momentum is running ahead of the medium-term trend, which is read as bullish. When it falls below, the opposite. The "signal line" is a smoothed version of that gap; the bars you see (the histogram) are the distance between the two. Growing bars mean momentum is accelerating, shrinking bars mean it is fading — and momentum usually fades before price turns.`,
    keywords: [],
  },
  {
    id: "volatility",
    term: "ATR",
    short:
      "The average distance a market moves in a given period. It sets what counts as a normal move versus a real break — the basis for the volatility reading here.",
    full: `**ATR** — Average True Range — is the average distance a market travels in a given period, including gaps.\n\nIt is the single most practical number on a chart, because it tells you what "normal" looks like. If a market moves $30 a day on average, a $25 stop will be hit by ordinary noise regardless of whether your directional view was right. Position sizing and stop placement should be built on ATR, not on how much you are willing to lose.`,
    keywords: ["average true range", "atr"],
  },
  {
    id: "ma",
    term: "Moving average",
    short:
      "The average price over recent periods, smoothing out noise. Price holding above a rising average generally means buyers are in control.",
    full: `A **moving average** is the average price over the last N periods, redrawn each bar. It strips out noise so the underlying direction is visible.\n\nAn EMA (exponential) weights recent prices more heavily, so it turns faster than an SMA (simple). The usual read: price above a rising average means buyers are in control; a short average crossing above a longer one is the classic shape of a developing uptrend. They lag by construction — they describe what has happened, not what will.`,
    keywords: ["sma", "ema"],
  },
  {
    id: "support",
    term: "Support",
    short:
      "A price where buyers have repeatedly stepped in before — worth watching for a bounce, not a guaranteed floor.",
    full: `**Support** is a price where buyers have repeatedly stepped in before. It is not a magic line — it is memory: enough participants remember what happened at that level to act there again.\n\nWhat matters is not touching a level but closing beyond it, on real volume. A wick through support that closes back above it is a failed breakdown, and those often reverse hard in the opposite direction.`,
    keywords: [],
  },
  {
    id: "resistance",
    term: "Resistance",
    short:
      "A price where sellers have repeatedly stepped in before — worth watching for a rejection, not a guaranteed ceiling.",
    full: `**Resistance** is a price where sellers have repeatedly stepped in before — the mirror of support. It is not a magic line — it is memory: enough participants remember what happened at that level to act there again.\n\nWhat matters is not touching a level but closing beyond it, on real volume. A wick through resistance that closes back below it is a failed breakout, and those often reverse hard in the opposite direction.`,
    keywords: [],
  },
  {
    id: "volume",
    term: "Volume",
    short:
      "How much trading activity accompanied the move. A price move on high volume is more likely to hold than the same move on thin volume.",
    full: `**Volume** is how much trading activity accompanied a price move — a relative figure here, not a literal exchange count.\n\nA breakout on rising volume means real participation is behind it; the same breakout on thin volume is easier to fade, because it may just be a lack of sellers rather than genuine demand. When a data source publishes rates but not turnover, this reads "Not published" rather than guessing that participation was normal.`,
    keywords: ["trading volume"],
  },
  {
    id: "confidence",
    term: "Confidence",
    short:
      "How much the underlying indicators agree with each other — not a probability that a trade will be profitable.",
    full: `**Confidence** measures how much the six weighted signals behind the trend call agree with each other — long-term moving-average position, EMA cross, MACD momentum, RSI, Bollinger position and market structure.\n\nA high number means the signals are pointing the same way. It is deliberately **not** a probability that a trade will work, and it is floored at 30 and capped at 88 so the product can never imply certainty in either direction.`,
    keywords: ["how confident"],
  },
];

const BY_ID = new Map(GLOSSARY.map((entry) => [entry.id, entry]));

export function getGlossaryEntry(id: string): GlossaryEntry | undefined {
  return BY_ID.get(id);
}

/** Keyword match used by the chat assistant's offline glossary answers. */
export function findGlossaryMatch(question: string): GlossaryEntry | undefined {
  const q = question.toLowerCase();
  return GLOSSARY.find((entry) =>
    [entry.term.toLowerCase(), ...entry.keywords].some((needle) =>
      q.includes(needle),
    ),
  );
}
