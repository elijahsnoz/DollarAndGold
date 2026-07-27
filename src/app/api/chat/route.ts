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
    const reply = await ruleBasedReply(last.content);
    return new Response(reply, { headers });
  }

  try {
    const stream = await streamChatReply(parsed.messages);
    return new Response(stream, { headers });
  } catch {
    return Response.json(
      { error: "The assistant is unavailable right now." },
      { status: 502 },
    );
  }
}
