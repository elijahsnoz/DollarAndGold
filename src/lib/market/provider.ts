import { CompositeProvider } from "./providers/composite";
import { SimulatedProvider } from "./simulated-provider";
import type { MarketDataProvider } from "./types";

/**
 * Resolves the active market data provider.
 *
 * The contract this file exposes has not changed — callers still ask for a
 * `MarketDataProvider` and get one. What changed is what sits behind it: a
 * composite that routes each symbol through the real sources it has, and falls
 * back to the simulation only when none of them can answer.
 *
 * Set `MARKET_DATA_MODE=simulated` to pin the old behaviour, which is useful
 * for deterministic screenshots, demos and tests.
 */

let cached: MarketDataProvider | null = null;

export function getMarketDataProvider(): MarketDataProvider {
  if (!cached) {
    cached =
      process.env.MARKET_DATA_MODE === "simulated"
        ? new SimulatedProvider()
        : new CompositeProvider();
  }
  return cached;
}

/** Test seam — drops the memoised provider so env changes take effect. */
export function resetMarketDataProvider() {
  cached = null;
}

/** Sources that are configured right now, for the provenance UI. */
export function describeMarketDataSources() {
  const provider = getMarketDataProvider();
  return provider instanceof CompositeProvider ? provider.describeSources() : [];
}

/** True when the app is pinned to simulated data for every symbol. */
export function isSimulatedOnly(): boolean {
  return getMarketDataProvider() instanceof SimulatedProvider;
}

export { SimulatedProvider };
