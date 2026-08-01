import { findGlossaryMatch } from "@/lib/education/glossary";
import { formatPrice, formatSignedPercent } from "@/lib/format";
import { ASSETS, getAsset } from "@/lib/market/catalog";
import { getMarketDataProvider } from "@/lib/market/provider";
import { getNewsProvider } from "@/lib/news/provider";
import { analyseAsset } from "./analysis";
import { FALLBACK_BETA, HOUSE_RULES, MODEL, getAnthropic } from "./client";
import type { ChatMessage } from "./types";

/**
 * The floating assistant.
 *
 * Rather than giving the model tools and running an agent loop, we resolve the
 * market context *before* the call: whichever assets the user mentioned get
 * their live quote and full analysis injected into the prompt. For a question
 * like "why is Bitcoin falling?" that is both faster and more reliable than a
 * round trip, and it guarantees the model is never answering from memory about
 * a price it cannot see.
 */

const MAX_CONTEXT_ASSETS = 2;

/** Find catalog assets referenced by name, ticker or symbol in free text. */
export function detectSymbols(text: string): string[] {
  const haystack = ` ${text.toLowerCase()} `;
  const hits: { symbol: string; index: number }[] = [];

  for (const asset of ASSETS) {
    const needles = [
      asset.symbol.toLowerCase(),
      asset.ticker.toLowerCase(),
      asset.name.toLowerCase(),
    ];

    // Common colloquial names that don't appear in the catalog fields.
    const aliases: Record<string, string[]> = {
      XAUUSD: ["gold", "bullion"],
      BTCUSD: ["bitcoin", "btc"],
      ETHUSD: ["ethereum", "ether", "eth"],
      EURUSD: ["euro", "eurusd"],
      GBPUSD: ["sterling", "pound", "cable"],
      USDJPY: ["yen", "usdjpy"],
      NDX: ["nasdaq"],
      SPX: ["s&p", "sp500", "s and p"],
      WTIUSD: ["oil", "crude", "wti"],
      DXY: ["dollar index", "the dollar", "us dollar"],
      XAGUSD: ["silver"],
    };
    needles.push(...(aliases[asset.symbol] ?? []));

    for (const needle of needles) {
      if (needle.length < 3) continue;
      const index = haystack.indexOf(needle);
      if (index !== -1) {
        hits.push({ symbol: asset.symbol, index });
        break;
      }
    }
  }

  return hits
    .sort((a, b) => a.index - b.index)
    .slice(0, MAX_CONTEXT_ASSETS)
    .map((h) => h.symbol);
}

/** Build the live market context block for the assets a question touches. */
async function buildContext(question: string): Promise<string> {
  const symbols = detectSymbols(question);
  if (symbols.length === 0) return "";

  const blocks = await Promise.all(
    symbols.map(async (symbol) => {
      const asset = getAsset(symbol);
      if (!asset) return "";

      const [analysis, news] = await Promise.all([
        analyseAsset(symbol, "3M"),
        getNewsProvider().getArticles({ symbol, limit: 2 }),
      ]);

      const p = asset.precision;
      const lines = [
        `### ${asset.name} (${asset.symbol})`,
        `Price: ${formatPrice(analysis.price, p)} | 24h: ${formatSignedPercent(analysis.changePercent)}`,
        `Trend: ${analysis.trend.direction}, confidence ${analysis.trend.confidence}/100 (indicator agreement, not a win rate)`,
        `Support: ${analysis.supports.map((s) => formatPrice(s, p)).join(", ") || "n/a"}`,
        `Resistance: ${analysis.resistances.map((r) => formatPrice(r, p)).join(", ") || "n/a"}`,
        `Volatility: ${analysis.volatility.annualisedPct.toFixed(1)}% annualised (${analysis.volatility.regime})`,
        `Indicators: ${analysis.indicators.map((i) => `${i.label} ${i.value} [${i.signal}]`).join("; ")}`,
        `Known drivers: ${asset.drivers.join(", ")}`,
      ];

      if (news.length > 0) {
        lines.push(
          `Recent headlines: ${news.map((n) => `"${n.headline}" (${n.impact.direction})`).join("; ")}`,
        );
      }

      return lines.join("\n");
    }),
  );

  const body = blocks.filter(Boolean).join("\n\n");
  if (!body) return "";

  return `\n\n<live_market_data>\nThese are the current computed readings for the markets mentioned in the question. They are the only figures you may quote.\n\n${body}\n</live_market_data>`;
}

const CHAT_SYSTEM = `${HOUSE_RULES}

You are answering questions inside the DollarAndGold app's chat panel.

How to answer:
- If a <live_market_data> block is present, it is the current truth. Quote figures only from there. If the user asks about a market that is not in the block, say you do not have live data for it rather than guessing.
- If the question is educational ("what is RSI?", "explain MACD"), just teach it clearly. Use a concrete example. No live data needed.
- If the question is "why is X falling/rising?", connect the computed readings and the listed drivers into a causal story, and be explicit that this is interpretation rather than a confirmed cause.
- Keep answers short — two or three short paragraphs at most. This is a chat panel, not a report.
- Do not append a disclaimer to every message; the interface already displays one.`;

export interface ChatRequest {
  messages: ChatMessage[];
}

/**
 * Stream an assistant reply as plain text chunks.
 * Throws if the AI layer is not configured — callers should check `isAIEnabled`.
 */
export async function streamChatReply(
  history: ChatMessage[],
): Promise<ReadableStream<Uint8Array>> {
  const client = getAnthropic();
  if (!client) throw new Error("AI is not configured");

  const latest = history[history.length - 1];
  const context = latest?.role === "user" ? await buildContext(latest.content) : "";

  const stream = client.beta.messages.stream({
    model: MODEL,
    // Chat replies are deliberately short — this is a side panel, not a report.
    max_tokens: 2048,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    system: CHAT_SYSTEM + context,
    messages: history.map((m) => ({ role: m.role, content: m.content })),
  } as never);

  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }

        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") {
          controller.enqueue(
            encoder.encode(
              "I can't help with that particular request. Try asking about a market, an indicator, or what moved today.",
            ),
          );
        }
      } catch {
        controller.enqueue(
          encoder.encode(
            "\n\nSomething went wrong reaching the analysis engine. Please try again.",
          ),
        );
      } finally {
        controller.close();
      }
    },
  });
}

/**
 * Offline answer used when no API key is configured.
 *
 * This keeps the assistant genuinely useful in a zero-config demo: it answers
 * the indicator questions from a small glossary and answers market questions
 * straight from the analysis engine.
 */
export async function ruleBasedReply(question: string): Promise<string> {
  const glossaryMatch = findGlossaryMatch(question);
  if (glossaryMatch) return glossaryMatch.full;

  const symbols = detectSymbols(question);
  if (symbols.length > 0) {
    const symbol = symbols[0];
    const asset = getAsset(symbol)!;
    const analysis = await analyseAsset(symbol, "3M");
    const p = asset.precision;

    return [
      `**${asset.name}** is at ${formatPrice(analysis.price, p)}, ${formatSignedPercent(analysis.changePercent)} over 24 hours.`,
      analysis.trend.headline + ".",
      `Support sits at ${formatPrice(analysis.supports[0] ?? analysis.price * 0.98, p)} and resistance at ${formatPrice(analysis.resistances[0] ?? analysis.price * 1.02, p)}. ${analysis.volatility.description}`,
      `What actually drives ${asset.name}: ${asset.drivers.join(", ")}. Open the full analysis for the complete breakdown.`,
    ].join("\n\n");
  }

  const quote = await getMarketDataProvider().getQuote("XAUUSD");
  return [
    `I can help you analyse a market, explain an indicator, or summarise what moved today.`,
    `Try asking: "Analyse Gold", "Why is Bitcoin falling?", "What is RSI?" or "Explain MACD".`,
    `For reference, gold is currently at ${formatPrice(quote.price, 2)} (${formatSignedPercent(quote.changePercent)} today).`,
  ].join("\n\n");
}
