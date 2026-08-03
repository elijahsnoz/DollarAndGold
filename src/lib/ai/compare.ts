import { getAsset } from "@/lib/market/catalog";
import { logReturns, pearsonCorrelation } from "@/lib/market/correlation";
import { getMarketDataProvider } from "@/lib/market/provider";
import type { Timeframe, TrendDirection } from "@/lib/market/types";
import { analyseAsset } from "./analysis";
import type { VolatilityRegime } from "./types";

/**
 * Market Comparison Workspace: several assets, side by side.
 *
 * Reuses `analyseAsset` entirely for trend, confidence, volatility, levels
 * and summary — this is a different arrangement of the same deterministic
 * analysis, not a second engine. Correlation is the one genuinely new
 * calculation, computed from the same candle series the analysis itself
 * already fetched.
 */

export interface ComparisonRow {
  symbol: string;
  name: string;
  precision: number;
  price: number;
  changePercent: number;
  trend: TrendDirection;
  confidence: number;
  /** -100..100 — confidence signed by direction, so assets rank on one axis. */
  strengthScore: number;
  volatilityRegime: VolatilityRegime;
  atrPercent: number;
  supports: number[];
  resistances: number[];
  summary: string;
}

export interface CorrelationPair {
  a: string;
  b: string;
  /** -1..1. Pearson correlation of daily log returns over the comparison window. */
  value: number;
}

export interface ComparisonResult {
  timeframe: Timeframe;
  generatedAt: number;
  rows: ComparisonRow[];
  correlations: CorrelationPair[];
}

function strengthScoreFrom(direction: TrendDirection, confidence: number): number {
  if (direction === "bullish") return confidence;
  if (direction === "bearish") return -confidence;
  return 0;
}

export async function buildComparison(
  symbols: string[],
  timeframe: Timeframe = "3M",
): Promise<ComparisonResult> {
  const validSymbols = symbols.filter((symbol) => getAsset(symbol));
  const provider = getMarketDataProvider();

  const [analyses, seriesList] = await Promise.all([
    Promise.all(validSymbols.map((symbol) => analyseAsset(symbol, timeframe))),
    Promise.all(validSymbols.map((symbol) => provider.getSeries(symbol, timeframe))),
  ]);

  const rows: ComparisonRow[] = analyses.map((analysis) => {
    const asset = getAsset(analysis.symbol);
    return {
      symbol: analysis.symbol,
      name: asset?.name ?? analysis.assetName,
      precision: asset?.precision ?? 2,
      price: analysis.price,
      changePercent: analysis.changePercent,
      trend: analysis.trend.direction,
      confidence: analysis.trend.confidence,
      strengthScore: strengthScoreFrom(analysis.trend.direction, analysis.trend.confidence),
      volatilityRegime: analysis.volatility.regime,
      atrPercent: analysis.volatility.atrPercent,
      supports: analysis.supports,
      resistances: analysis.resistances,
      summary: analysis.summary,
    };
  });

  const returnsBySymbol = new Map(
    seriesList.map((series) => [series.symbol, logReturns(series.candles.map((c) => c.c))]),
  );

  const correlations: CorrelationPair[] = [];
  for (let i = 0; i < validSymbols.length; i++) {
    for (let j = i + 1; j < validSymbols.length; j++) {
      const a = validSymbols[i];
      const b = validSymbols[j];
      correlations.push({
        a,
        b,
        value: pearsonCorrelation(returnsBySymbol.get(a) ?? [], returnsBySymbol.get(b) ?? []),
      });
    }
  }

  return { timeframe, generatedAt: Date.now(), rows, correlations };
}
