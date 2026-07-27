import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { formatSignedPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Percentage change, colour-coded.
 *
 * The arrow carries the direction independently of hue, so the value is still
 * readable to anyone who can't distinguish the bull/bear colours.
 */
export function ChangePill({
  value,
  className,
  size = "default",
}: {
  value: number;
  className?: string;
  size?: "default" | "sm" | "lg";
}) {
  const direction = value > 0.0001 ? "up" : value < -0.0001 ? "down" : "flat";
  const Icon =
    direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Minus;

  return (
    <span
      className={cn(
        "tabular inline-flex items-center gap-1 rounded-lg font-medium",
        size === "sm" && "px-1.5 py-0.5 text-xs",
        size === "default" && "px-2 py-0.5 text-[13px]",
        size === "lg" && "px-2.5 py-1 text-sm",
        direction === "up" && "bg-bull/12 text-bull",
        direction === "down" && "bg-bear/12 text-bear",
        direction === "flat" && "bg-foreground/[0.05] text-muted-foreground",
        className,
      )}
    >
      <Icon
        className={cn("shrink-0", size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5")}
        aria-hidden="true"
      />
      {formatSignedPercent(value)}
    </span>
  );
}
