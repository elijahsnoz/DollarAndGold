import { z } from "zod";
import { formatPrice, formatSignedPercent } from "@/lib/format";
import { requireAsset } from "@/lib/market/catalog";
import { TIMEFRAMES } from "@/lib/market/simulation";
import { FALLBACK_BETA, HOUSE_RULES, MODEL, getAnthropic, textFrom } from "./client";
import type { MarketAnalysis } from "./types";

/**
 * Optional narration layer.
 *
 * The rules engine has already decided *what is true* — trend, levels, signals,
 * volatility. Claude's only job here is to say it well. It receives the computed
 * figures as structured input and is explicitly forbidden from inventing others,
 * which is what keeps the prose consistent with the chart.
 *
 * Every failure path returns the analysis unchanged. A missing API key, a
 * refusal, a timeout, or malformed JSON must never break the page.
 */

const NarrationSchema = z.object({
  headline: z.string().min(8).max(160),
  summary: z.string().min(80),
  bullNarrative: z.string().min(60),
  bearNarrative: z.string().min(60),
});

type Narration = z.infer<typeof NarrationSchema>;

/** JSON Schema mirror of the zod shape above, for `output_config.format`. */
const NARRATION_JSON_SCHEMA = {
  type: "object",
  properties: {
    headline: {
      type: "string",
      description:
        "One sentence, under 140 characters, stating the current read. No price predictions.",
    },
    summary: {
      type: "string",
      description:
        "Three or four short paragraphs in plain English explaining what the market is doing, why the levels matter, and what would change the picture. Separate paragraphs with a blank line.",
    },
    bullNarrative: {
      type: "string",
      description:
        "One paragraph on the conditional path higher: what has to happen first, what it would open up, and what would invalidate it.",
    },
    bearNarrative: {
      type: "string",
      description:
        "One paragraph on the conditional path lower, with the same structure as the bullish case.",
    },
  },
  required: ["headline", "summary", "bullNarrative", "bearNarrative"],
  additionalProperties: false,
} as const;

/** Compact, unambiguous facts sheet. The model may use nothing beyond this. */
function buildFactsheet(analysis: MarketAnalysis): string {
  const asset = requireAsset(analysis.symbol);
  const p = asset.precision;
  const spec = TIMEFRAMES[analysis.timeframe];

  const lines = [
    `Asset: ${asset.name} (${asset.symbol}), a ${asset.assetClass} instrument quoted in ${asset.currency}.`,
    `What actually drives it: ${asset.drivers.join(", ")}.`,
    `Timeframe analysed: the last ${spec.label}.`,
    ``,
    `Current price: ${formatPrice(analysis.price, p)}`,
    `24h change: ${formatSignedPercent(analysis.changePercent)}`,
    ``,
    `Computed trend: ${analysis.trend.direction} (confidence ${analysis.trend.confidence}/100, where confidence measures how much the indicators agree with each other — NOT a probability of profit).`,
    `Signals behind that verdict:`,
    ...analysis.trend.contributions.map(
      (c) => `  - ${c.label}: ${c.signal} (weight ${(c.weight * 100).toFixed(0)}%)`,
    ),
    ``,
    `Support levels (below price): ${analysis.supports.map((s) => formatPrice(s, p)).join(", ") || "none identified"}`,
    `Resistance levels (above price): ${analysis.resistances.map((r) => formatPrice(r, p)).join(", ") || "none identified"}`,
    ``,
    `Indicator readings:`,
    ...analysis.indicators.map(
      (i) => `  - ${i.label}: ${i.value} — signal ${i.signal}`,
    ),
    ``,
    `Volatility: ${analysis.volatility.annualisedPct.toFixed(1)}% annualised, ATR ${formatPrice(analysis.volatility.atr, p)} (${analysis.volatility.atrPercent.toFixed(2)}% of price). Regime: ${analysis.volatility.regime}.`,
    ``,
    `Bullish trigger already computed: ${analysis.bullCase.trigger}. Objective: ${analysis.bullCase.objective}. Invalidation: ${analysis.bullCase.invalidation}.`,
    `Bearish trigger already computed: ${analysis.bearCase.trigger}. Objective: ${analysis.bearCase.objective}. Invalidation: ${analysis.bearCase.invalidation}.`,
  ];

  if (analysis.news.length > 0) {
    lines.push("", "Relevant recent headlines:");
    for (const article of analysis.news.slice(0, 3)) {
      lines.push(`  - ${article.headline} (${article.impact.direction} impact)`);
    }
  }

  return lines.join("\n");
}

const NARRATION_PROMPT = `${HOUSE_RULES}

You will be given a factsheet of pre-computed technical readings for one market. Write the human-readable analysis for it.

Absolute constraints:
- Use ONLY the numbers in the factsheet. Do not compute, extrapolate, round differently, or invent any figure.
- Do not contradict the computed trend verdict. You may explain nuance within it, but the direction stands.
- Explain what each concept means as you use it. Assume the reader has never heard of ATR or MACD.
- Confidence is indicator agreement, not a win rate. Never describe it as a probability that a trade succeeds.

Return only the structured object.`;

/**
 * Rewrite an analysis's prose with Claude. Returns the input unchanged if the
 * AI layer is unavailable or anything goes wrong.
 */
export async function narrateAnalysis(
  analysis: MarketAnalysis,
): Promise<MarketAnalysis> {
  const client = getAnthropic();
  if (!client) return analysis;

  try {
    const message = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      system: NARRATION_PROMPT,
      output_config: {
        format: { type: "json_schema", schema: NARRATION_JSON_SCHEMA },
      },
      messages: [{ role: "user", content: buildFactsheet(analysis) }],
    } as never);

    const raw = textFrom(message as never);
    if (!raw) return analysis;

    const parsed = NarrationSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return analysis;

    return applyNarration(analysis, parsed.data);
  } catch {
    // Network error, rate limit, malformed JSON — the rules narration stands.
    return analysis;
  }
}

function applyNarration(
  analysis: MarketAnalysis,
  narration: Narration,
): MarketAnalysis {
  return {
    ...analysis,
    narrator: "claude",
    summary: narration.summary,
    trend: { ...analysis.trend, headline: narration.headline },
    bullCase: { ...analysis.bullCase, narrative: narration.bullNarrative },
    bearCase: { ...analysis.bearCase, narrative: narration.bearNarrative },
  };
}
