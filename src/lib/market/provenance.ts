/**
 * How a figure is described to the user.
 *
 * This product's whole claim is that it tells you the truth about what it
 * knows. A simulated price rendered in the same style as a live one quietly
 * breaks that, so every source id maps to an explicit, non-euphemistic label.
 * "Sample data" would be marketing; "Simulated" is what it is.
 */

export interface SourceDescriptor {
  /** Short label for badges. */
  label: string;
  /** Sentence used in tooltips and page footers. */
  description: string;
  /** True only when the figure came from a real market feed. */
  live: boolean;
}

const DESCRIPTORS: Record<string, SourceDescriptor> = {
  coingecko: {
    label: "Live · CoinGecko",
    description: "Live market data from CoinGecko.",
    live: true,
  },
  frankfurter: {
    label: "Live · ECB",
    description:
      "European Central Bank reference rates, published once per business day.",
    live: true,
  },
  twelvedata: {
    label: "Live · Twelve Data",
    description: "Live market data from Twelve Data.",
    live: true,
  },
  yahoo: {
    label: "Live · Yahoo Finance",
    description: "Live market data from Yahoo Finance.",
    live: true,
  },
  simulated: {
    label: "Simulated",
    description:
      "No live source is configured for this market, so prices are simulated and do not represent real quotes.",
    live: false,
  },
  "simulated-anchored": {
    label: "Simulated shape",
    description:
      "The current price is live, but no source covers this timeframe — the shape of this chart is simulated and scaled to the live price. Treat the pattern as illustrative, not as real history.",
    live: false,
  },
};

const UNKNOWN: SourceDescriptor = {
  label: "Unknown source",
  description: "The origin of this data could not be determined.",
  live: false,
};

export function describeSource(sourceId: string | undefined): SourceDescriptor {
  if (!sourceId) return UNKNOWN;
  return DESCRIPTORS[sourceId] ?? UNKNOWN;
}

export function isLiveSource(sourceId: string | undefined): boolean {
  return describeSource(sourceId).live;
}

/** One-line summary for a page showing many markets at once. */
export function summariseSources(sourceIds: (string | undefined)[]): string {
  const live = sourceIds.filter(isLiveSource).length;
  const total = sourceIds.length;

  if (total === 0) return "";
  if (live === 0) {
    return "No live market data source is configured — every price on this page is simulated and does not represent a real quote.";
  }
  if (live === total) {
    return "All prices on this page come from live market data.";
  }
  return `${live} of ${total} markets on this page use live data. The rest are simulated because no configured source covers them — each is labelled individually.`;
}
