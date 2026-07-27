import Anthropic from "@anthropic-ai/sdk";

/**
 * Anthropic client, resolved lazily.
 *
 * The AI layer is strictly optional: without `ANTHROPIC_API_KEY` the product
 * still works end to end using the deterministic rules engine. Every caller
 * must therefore handle `null` rather than assuming a client exists.
 */

let client: Anthropic | null = null;
let resolved = false;

export function getAnthropic(): Anthropic | null {
  if (!resolved) {
    resolved = true;
    const apiKey = process.env.ANTHROPIC_API_KEY;
    client = apiKey ? new Anthropic({ apiKey }) : null;
  }
  return client;
}

export function isAIEnabled(): boolean {
  return getAnthropic() !== null;
}

/** The model every request in this app uses. */
export const MODEL = "claude-opus-5";

/**
 * Server-side refusal fallback. Claude Opus 5's safety classifiers can decline
 * a request and return `stop_reason: "refusal"` rather than an error; opting in
 * re-runs the request on Anthropic's recommended fallback inside the same call.
 */
export const FALLBACK_BETA = "server-side-fallback-2026-07-01";

/**
 * The house rules every prompt inherits.
 *
 * This is the compliance boundary for the whole product: DollarAndGold is a
 * research tool, not a broker or an advisor, and nothing the model writes may
 * read as a recommendation or a promise.
 */
export const HOUSE_RULES = `You are the analyst voice of DollarAndGold, an AI market research platform.

Non-negotiable rules:
- You are NOT a financial adviser and this is NOT financial advice. Never tell anyone to buy, sell, or hold.
- Never predict a price with certainty, never promise a profit, and never imply an outcome is guaranteed or "sure".
- Never invent numbers. Use only the figures you are given. If a figure is not provided, describe the idea qualitatively instead of guessing.
- Always frame moves as conditional and probabilistic: "if X holds, then Y becomes more likely" — not "X will happen".
- Acknowledge what could invalidate the read. A good analyst states the conditions under which they would be wrong.

Voice: plain English, no jargon without explaining it, direct and unhedged in tone but honest about uncertainty. Write for an intelligent person who does not yet know what RSI stands for. Short paragraphs. No bullet-point spam, no emoji, no marketing language.`;

/**
 * Extract plain text from a response, ignoring thinking and tool blocks.
 * Returns null when the model refused or produced no text.
 */
export function textFrom(message: {
  stop_reason?: string | null;
  content: Array<{ type: string; text?: string }>;
}): string | null {
  if (message.stop_reason === "refusal") return null;

  const text = message.content
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text as string)
    .join("")
    .trim();

  return text.length > 0 ? text : null;
}
