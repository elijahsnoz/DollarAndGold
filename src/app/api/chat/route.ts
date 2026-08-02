import { z } from "zod";

import { ruleBasedReply, streamChatReply } from "@/lib/ai/chat";
import { isAIEnabled } from "@/lib/ai/client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BodySchema = z.object({
  messages: z
    .array(
      z.object({
        id: z.string(),
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
        createdAt: z.number(),
      }),
    )
    .min(1)
    // Keep the context window bounded — the assistant only needs recent turns.
    .max(24),
  // Market Memories live client-side only (see `WorkspaceState`) — this is the
  // one way the server ever sees them, and only for the current request.
  memories: z
    .array(
      z.object({
        symbol: z.string().optional(),
        kind: z.enum(["observation", "trade", "research", "behaviour"]),
        title: z.string().max(200),
        body: z.string().max(1000),
        occurredAt: z.number(),
      }),
    )
    .max(12)
    .optional(),
});

/**
 * POST /api/chat — streams a plain-text reply.
 *
 * Text rather than SSE: the client renders tokens as they arrive and has no
 * need for event framing, so a raw stream keeps both ends simple.
 */
export async function POST(request: Request) {
  let parsed;
  try {
    parsed = BodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const headers = {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Narrator": isAIEnabled() ? "claude" : "rules",
  };

  // Without an API key the assistant still answers, from the glossary and the
  // analysis engine. Same interface, narrower range.
  if (!isAIEnabled()) {
    const last = parsed.messages[parsed.messages.length - 1];
    const reply = await ruleBasedReply(last.content, parsed.memories);
    return new Response(reply, { headers });
  }

  try {
    const stream = await streamChatReply(parsed.messages, parsed.memories);
    return new Response(stream, { headers });
  } catch {
    return Response.json(
      { error: "The assistant is unavailable right now." },
      { status: 502 },
    );
  }
}
