"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/misc";
import { getGlossaryEntry } from "@/lib/education/glossary";
import { cn } from "@/lib/utils";

/**
 * Learning Mode: wraps a label so hovering (or focusing, via keyboard) it
 * explains the underlying concept — RSI, MACD, support, resistance, and so on.
 * Reads from the same glossary the chat assistant answers from, so the two
 * surfaces can never disagree about what a term means.
 */
export function GlossaryTerm({
  term,
  children,
  className,
}: {
  /** Glossary entry id — see `lib/education/glossary.ts`. */
  term: string;
  children: React.ReactNode;
  className?: string;
}) {
  const entry = getGlossaryEntry(term);
  if (!entry) return <>{children}</>;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "cursor-help underline decoration-dotted decoration-muted-foreground/40 underline-offset-4 outline-none",
            className,
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-medium text-foreground">{entry.term}</p>
        <p className="mt-1 text-muted-foreground">{entry.short}</p>
      </TooltipContent>
    </Tooltip>
  );
}
