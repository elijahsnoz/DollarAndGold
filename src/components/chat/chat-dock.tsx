"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { ArrowUp, Bot, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import type { ChatMemoryContext, ChatMessage } from "@/lib/ai/types";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace/store";

/** Caps how much of the Market Memories archive rides along with a chat request. */
const MAX_MEMORIES = 10;

const SUGGESTIONS = [
  "Analyse Gold.",
  "Why is Bitcoin falling?",
  "What happened to the Dollar today?",
  "What is RSI?",
  "Explain MACD.",
];

const GREETING: ChatMessage = {
  id: "greeting",
  role: "assistant",
  content:
    "I'm the DollarAndGold assistant. Ask me to analyse a market, explain an indicator, or make sense of what moved today.\n\nI read the same computed data the analysis pages use, so the numbers I quote are the numbers on your screen.",
  createdAt: 0,
};

/**
 * Floating assistant.
 *
 * Conversation state lives in this component for the session — it is
 * intentionally not persisted, so a reload gives a clean slate rather than
 * resurrecting stale market talk with prices that have since moved.
 */
export function ChatDock() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = React.useState("");
  const [streaming, setStreaming] = React.useState(false);
  const { memories } = useWorkspace();

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  // The dock would sit on top of the sign-in form, and it has nothing to add there.
  const hidden = pathname.startsWith("/sign-in");

  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, open]);

  React.useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const send = React.useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streaming) return;

      const userMessage: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        content: trimmed,
        createdAt: Date.now(),
      };
      const assistantId = `a-${Date.now()}`;

      // The history sent to the API excludes the canned greeting.
      const history = [...messages.filter((m) => m.id !== "greeting"), userMessage];

      setMessages((prev) => [
        ...prev,
        userMessage,
        { id: assistantId, role: "assistant", content: "", createdAt: Date.now() },
      ]);
      setInput("");
      setStreaming(true);

      // Only non-milestone kinds carry context worth sending — a milestone is
      // congratulatory, not something the assistant needs to reason about.
      const memoryContext: ChatMemoryContext[] = memories
        .filter(
          (m): m is typeof m & { kind: ChatMemoryContext["kind"] } =>
            m.kind !== "milestone",
        )
        .slice(0, MAX_MEMORIES)
        .map((m) => ({
          symbol: m.symbol,
          kind: m.kind,
          title: m.title,
          body: m.body,
          occurredAt: m.occurredAt,
        }));

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history, memories: memoryContext }),
        });

        if (!response.ok || !response.body) {
          throw new Error("chat request failed");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        // Append each chunk to the placeholder message as it arrives.
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: m.content + chunk } : m,
            ),
          );
        }
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content:
                    "I couldn't reach the analysis engine. Check your connection and try again.",
                }
              : m,
          ),
        );
      } finally {
        setStreaming(false);
      }
    },
    [messages, streaming, memories],
  );

  if (hidden) return null;

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open AI assistant"
          className="group fixed bottom-5 right-5 z-40 flex items-center gap-2.5 rounded-full bg-gradient-to-br from-gold-soft to-gold py-3 pl-4 pr-5 text-sm font-semibold text-primary-foreground shadow-[0_12px_40px_-12px_hsl(var(--gold)/0.85)] transition-transform hover:scale-[1.03] active:scale-100"
        >
          <span className="relative flex h-5 w-5 items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-primary-foreground/30 animate-pulse-ring" />
            <Sparkles className="relative h-4 w-4" />
          </span>
          Ask AI
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label="AI assistant"
          className="glass animate-fade-up fixed bottom-4 right-4 z-40 flex h-[min(34rem,calc(100dvh-2rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-[var(--radius)]"
        >
          <header className="flex items-center gap-2.5 border-b border-border/70 px-4 py-3">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-gold-soft to-gold">
              <Bot className="h-4 w-4 text-primary-foreground" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight">AI Assistant</p>
              <p className="text-[11px] leading-tight text-muted-foreground">
                Research only — never financial advice
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              className="ml-auto"
              onClick={() => setOpen(false)}
              aria-label="Close assistant"
            >
              <X />
            </Button>
          </header>

          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                pending={streaming && message.content === ""}
              />
            ))}

            {messages.length === 1 && (
              <div className="space-y-2 pt-1">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => void send(suggestion)}
                    className="block w-full rounded-xl border border-border/70 px-3 py-2 text-left text-[13px] text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form
            className="border-t border-border/70 p-3"
            onSubmit={(event) => {
              event.preventDefault();
              void send(input);
            }}
          >
            <div className="relative">
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  // Enter sends; Shift+Enter adds a newline.
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void send(input);
                  }
                }}
                rows={1}
                placeholder="Ask about any market…"
                aria-label="Message the assistant"
                className="max-h-28 min-h-[44px] resize-none pr-12"
              />
              <Button
                type="submit"
                size="icon-sm"
                disabled={!input.trim() || streaming}
                className="absolute bottom-1.5 right-1.5"
                aria-label="Send message"
              >
                <ArrowUp />
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

function MessageBubble({
  message,
  pending,
}: {
  message: ChatMessage;
  pending: boolean;
}) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground"
            : "border border-border/70 bg-foreground/[0.03]",
        )}
      >
        {pending ? <TypingDots /> : <RichText text={message.content} />}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="flex gap-1 py-1" aria-label="Assistant is typing">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground"
          style={{ animationDelay: `${i * 120}ms` }}
        />
      ))}
    </span>
  );
}

/**
 * Minimal formatter for the assistant's output: paragraphs and **bold**.
 * A full markdown renderer would be more surface area than the replies need.
 */
function RichText({ text }: { text: string }) {
  const paragraphs = text.split(/\n{2,}/);

  return (
    <>
      {paragraphs.map((paragraph, index) => (
        <p key={index} className={index > 0 ? "mt-2.5" : undefined}>
          {paragraph.split(/(\*\*[^*]+\*\*)/g).map((part, partIndex) =>
            part.startsWith("**") && part.endsWith("**") ? (
              <strong key={partIndex} className="font-semibold">
                {part.slice(2, -2)}
              </strong>
            ) : (
              <React.Fragment key={partIndex}>{part}</React.Fragment>
            ),
          )}
        </p>
      ))}
    </>
  );
}
