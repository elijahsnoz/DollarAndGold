import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-level loading placeholder: a page header above a card grid.
 *
 * Shared by the per-route `loading.tsx` files. Note there is deliberately no
 * `loading.tsx` at the app root — a Suspense boundary above every route makes
 * Next flush a 200 shell before the page component runs, so a later
 * `notFound()` can swap the body but not the status, and unknown symbols
 * answer 200. Scoping the boundary to routes without dynamic params keeps the
 * skeletons and the correct 404s.
 */
export function PageSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div className="container py-12 sm:py-16">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-4 h-9 w-72 max-w-full" />
      <Skeleton className="mt-4 h-4 w-full max-w-xl" />

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: cards }).map((_, index) => (
          <div key={index} className="glass rounded-[var(--radius)] p-5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-4 h-7 w-32" />
            <Skeleton className="mt-4 h-12 w-full" />
            <Skeleton className="mt-4 h-3 w-40" />
          </div>
        ))}
      </div>
    </div>
  );
}
