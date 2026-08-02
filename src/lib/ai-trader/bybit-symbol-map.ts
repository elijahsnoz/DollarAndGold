import { getAsset } from "@/lib/market/catalog";

/**
 * Catalog symbol → Bybit USDT-perpetual symbol.
 *
 * Only crypto has a real Bybit instrument — forex, commodities, indices and
 * equities have nothing to map to, so this returns null for them rather than
 * guessing a symbol Bybit would just reject. A wrong guess here would fail
 * safely anyway (Bybit's own error surfaces through `BybitClient`), but there
 * is no reason to offer a trade this exchange cannot place.
 */
export function bybitSymbolFor(catalogSymbol: string): string | null {
  const asset = getAsset(catalogSymbol);
  if (!asset || asset.assetClass !== "crypto") return null;
  return `${asset.ticker}USDT`;
}
