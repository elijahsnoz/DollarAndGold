import type { Asset } from "@/lib/market/types";

/**
 * Display formatting.
 *
 * Every number the user sees goes through here. Formatting lives in one module
 * so a price rendered in the ticker, the market card and the analysis header
 * can never disagree about decimals or separators.
 */

const LOCALE = "en-US";

export function formatPrice(value: number, precision = 2): string {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString(LOCALE, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
}

export function formatAssetPrice(value: number, asset: Pick<Asset, "precision">) {
  return formatPrice(value, asset.precision);
}

export function formatSignedPercent(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

export function formatSigned(value: number, precision = 2): string {
  if (!Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${formatPrice(Math.abs(value), precision)}`;
}

/** Compact notional: 1.2T / 41.0B / 950.4M / 12.3K. */
export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const units: [number, string][] = [
    [1e12, "T"],
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"],
  ];
  for (const [threshold, suffix] of units) {
    if (abs >= threshold) return `${(value / threshold).toFixed(1)}${suffix}`;
  }
  return value.toFixed(0);
}

export function formatCurrencyCompact(value: number, currency = "USD"): string {
  const symbol = currency === "USD" ? "$" : "";
  return `${symbol}${formatCompact(value)}`;
}

/** "2m ago", "4h ago", "3d ago". Relative to now unless `from` is given. */
export function formatRelativeTime(timestamp: number, from = Date.now()): string {
  const seconds = Math.round((from - timestamp) / 1000);
  if (seconds < 45) return "just now";
  if (seconds < 90) return "1m ago";

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;

  return new Date(timestamp).toLocaleDateString(LOCALE, {
    month: "short",
    day: "numeric",
  });
}

/**
 * Axis/tooltip label for a candle timestamp. Intraday timeframes want a clock,
 * longer ones want a date.
 */
export function formatChartTime(timestamp: number, intraday: boolean): string {
  const d = new Date(timestamp);
  return intraday
    ? d.toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString(LOCALE, { month: "short", day: "numeric" });
}

export function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString(LOCALE, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
