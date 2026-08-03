/**
 * How closely two markets actually move together — the one genuinely new
 * calculation the Market Comparison Workspace needed. Everything else it
 * shows is the existing analysis engine, differently arranged.
 */

/** Day-to-day log returns from a close series — the standard input for correlation, not raw price. */
export function logReturns(closes: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0) out.push(Math.log(closes[i] / closes[i - 1]));
  }
  return out;
}

/**
 * Pearson correlation coefficient, -1 to 1. Aligns to the shorter series
 * from its most recent end, so two windows of slightly different length
 * (a symbol with a few extra or missing bars) still compare fairly.
 */
export function pearsonCorrelation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;

  const aSlice = a.slice(-n);
  const bSlice = b.slice(-n);
  const meanA = aSlice.reduce((sum, v) => sum + v, 0) / n;
  const meanB = bSlice.reduce((sum, v) => sum + v, 0) / n;

  let covariance = 0;
  let varianceA = 0;
  let varianceB = 0;
  for (let i = 0; i < n; i++) {
    const da = aSlice[i] - meanA;
    const db = bSlice[i] - meanB;
    covariance += da * db;
    varianceA += da * da;
    varianceB += db * db;
  }

  if (varianceA === 0 || varianceB === 0) return 0;
  return covariance / Math.sqrt(varianceA * varianceB);
}
