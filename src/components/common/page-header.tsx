import { cn } from "@/lib/utils";

/** Shared page title block, so every route opens with the same rhythm. */
export function PageHeader({
  eyebrow,
  title,
  lede,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-6", className)}>
      <div className="max-w-2xl">
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-2.5 text-3xl font-semibold tracking-tight sm:text-4xl">
          {title}
        </h1>
        {lede && (
          <p className="mt-3 text-pretty leading-relaxed text-muted-foreground">
            {lede}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
