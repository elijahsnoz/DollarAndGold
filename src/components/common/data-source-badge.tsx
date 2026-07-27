"use client";

import { Radio, TriangleAlert } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/misc";
import { describeSource } from "@/lib/market/provenance";
import { cn } from "@/lib/utils";

/**
 * States where a figure came from.
 *
 * Live data gets a quiet, unobtrusive treatment; simulated data gets a warning
 * colour. The asymmetry is intentional — the risk to a user is mistaking a
 * simulated price for a real one, never the reverse.
 */
export function DataSourceBadge({
  source,
  className,
  size = "default",
}: {
  source: string | undefined;
  className?: string;
  size?: "default" | "sm";
}) {
  const descriptor = describeSource(source);
  const Icon = descriptor.live ? Radio : TriangleAlert;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border font-medium",
            size === "sm"
              ? "px-2 py-0.5 text-[10px]"
              : "px-2.5 py-1 text-[11px]",
            descriptor.live
              ? "border-bull/25 bg-bull/10 text-bull"
              : "border-gold/30 bg-gold/10 text-gold",
            className,
          )}
        >
          <Icon className={size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"} />
          {descriptor.label}
        </span>
      </TooltipTrigger>
      <TooltipContent>{descriptor.description}</TooltipContent>
    </Tooltip>
  );
}
