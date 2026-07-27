import { cn } from "@/lib/utils";

/**
 * The mark: a dollar stroke and a gold arc sharing one axis — the two halves of
 * the name, and the two forces the product tracks against each other.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span className="relative grid h-8 w-8 place-items-center rounded-[10px] bg-gradient-to-br from-gold-soft via-gold to-gold/60 shadow-[0_6px_20px_-8px_hsl(var(--gold)/0.9)]">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className="h-[18px] w-[18px]"
        >
          <path
            d="M12 3v18"
            stroke="hsl(var(--primary-foreground))"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M16 7.5C16 5.6 14.2 4.5 12 4.5S8 5.6 8 7.5c0 4.5 8 2.5 8 7 0 1.9-1.8 3-4 3s-4-1.1-4-3"
            stroke="hsl(var(--primary-foreground))"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="text-[15px] font-semibold tracking-tight">
        Dollar<span className="text-gold">And</span>Gold
      </span>
    </span>
  );
}
