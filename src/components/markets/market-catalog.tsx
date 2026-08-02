import { MarketGrid } from "@/components/markets/market-grid";
import { ASSET_CLASS_LABEL } from "@/lib/market/catalog";
import type { MarketSnapshot } from "@/lib/market/snapshot";
import type { AssetClass } from "@/lib/market/types";

const CLASS_ORDER: AssetClass[] = [
  "commodity",
  "crypto",
  "forex",
  "index",
  "energy",
  "stock",
];

/**
 * The catalog, grouped by asset class — one `MarketGrid` per group rather
 * than one flat wall of cards, so breadth (32 forex pairs, 23 crypto tokens)
 * reads as sections instead of an undifferentiated scroll. Used by both
 * `/markets` (the full catalog) and the homepage (a smaller preview slice),
 * so the two surfaces can never drift into two different grid renderers.
 */
export function MarketCatalog({ snapshots }: { snapshots: MarketSnapshot[] }) {
  const grouped = CLASS_ORDER.map((assetClass) => ({
    assetClass,
    items: snapshots.filter((s) => s.asset.assetClass === assetClass),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="space-y-12">
      {grouped.map((group) => (
        <section key={group.assetClass}>
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {ASSET_CLASS_LABEL[group.assetClass]}
          </h2>
          <div className="mt-4">
            <MarketGrid snapshots={group.items} />
          </div>
        </section>
      ))}
    </div>
  );
}
