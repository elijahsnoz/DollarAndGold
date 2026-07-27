import { Info } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The compliance line that must appear on every surface carrying analysis.
 * Centralised so the wording cannot drift between pages.
 */
export function Disclaimer({
  className,
  variant = "default",
}: {
  className?: string;
  variant?: "default" | "inline";
}) {
  if (variant === "inline") {
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>
        This analysis is educational and should not be considered financial
        advice.
      </p>
    );
  }

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-2xl border border-border/70 bg-foreground/[0.025] p-4",
        className,
      )}
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <p className="text-xs leading-relaxed text-muted-foreground">
        <strong className="font-medium text-foreground/85">
          This analysis is educational and should not be considered financial
          advice.
        </strong>{" "}
        It is generated from historical price data and can be wrong. Markets
        reprice on news faster than any indicator updates. Never risk money you
        cannot afford to lose.
      </p>
    </div>
  );
}
