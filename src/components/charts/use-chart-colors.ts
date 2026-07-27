"use client";

import * as React from "react";
import { useTheme } from "next-themes";

/**
 * Resolve the design tokens into concrete colour strings for SVG.
 *
 * Recharts writes colours as SVG attributes, where `var(--token)` support is
 * inconsistent across browsers. Reading the computed values once per theme
 * keeps `globals.css` the single source of truth without relying on that.
 */

export interface ChartColors {
  bull: string;
  bear: string;
  neutral: string;
  gold: string;
  accent: string;
  grid: string;
  axis: string;
  surface: string;
}

const FALLBACK: ChartColors = {
  bull: "hsl(158 72% 45%)",
  bear: "hsl(4 82% 62%)",
  neutral: "hsl(218 12% 62%)",
  gold: "hsl(41 84% 60%)",
  accent: "hsl(217 91% 62%)",
  grid: "hsl(218 18% 18%)",
  axis: "hsl(218 12% 62%)",
  surface: "hsl(220 26% 5%)",
};

function read(styles: CSSStyleDeclaration, token: string, fallback: string) {
  const value = styles.getPropertyValue(token).trim();
  return value ? `hsl(${value})` : fallback;
}

export function useChartColors(): ChartColors {
  const { resolvedTheme } = useTheme();
  const [colors, setColors] = React.useState<ChartColors>(FALLBACK);

  React.useEffect(() => {
    const styles = getComputedStyle(document.documentElement);
    setColors({
      bull: read(styles, "--bull", FALLBACK.bull),
      bear: read(styles, "--bear", FALLBACK.bear),
      neutral: read(styles, "--neutral", FALLBACK.neutral),
      gold: read(styles, "--gold", FALLBACK.gold),
      accent: read(styles, "--accent", FALLBACK.accent),
      grid: read(styles, "--border", FALLBACK.grid),
      axis: read(styles, "--muted-foreground", FALLBACK.axis),
      surface: read(styles, "--background", FALLBACK.surface),
    });
  }, [resolvedTheme]);

  return colors;
}

/** The mark colour for a series, chosen by its net direction over the window. */
export function directionColor(change: number, colors: ChartColors): string {
  if (change > 0.0001) return colors.bull;
  if (change < -0.0001) return colors.bear;
  return colors.neutral;
}
