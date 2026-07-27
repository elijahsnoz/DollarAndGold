import { cn } from "@/lib/utils";

/**
 * Loading placeholder with a travelling sheen rather than a pulse — it reads as
 * "data is arriving" instead of "something is broken".
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-foreground/[0.06]",
        "after:absolute after:inset-0 after:-translate-x-full after:animate-shimmer",
        "after:bg-gradient-to-r after:from-transparent after:via-foreground/[0.07] after:to-transparent",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
