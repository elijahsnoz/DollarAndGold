"use client";

import * as React from "react";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";

import { directionColor, useChartColors } from "./use-chart-colors";

/**
 * Card-scale price trace.
 *
 * Deliberately chrome-free — no axes, grid, labels or tooltip. It exists to
 * show the shape of the last session next to a number that already states the
 * magnitude; anything more would compete with the price for attention. The
 * y-domain is the data's own range so small moves stay legible.
 */
export function Sparkline({
  data,
  change,
  height = 44,
  className,
}: {
  /** Close prices, oldest first. */
  data: number[];
  /** Net change over the window — decides the mark colour. */
  change: number;
  height?: number;
  className?: string;
}) {
  const colors = useChartColors();
  const gradientId = React.useId();

  const points = React.useMemo(
    () => data.map((value, index) => ({ index, value })),
    [data],
  );

  if (points.length < 2) {
    return <div style={{ height }} className={className} aria-hidden="true" />;
  }

  const stroke = directionColor(change, colors);

  return (
    <div className={className} style={{ height }} aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.28} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          {/* Zoom to the window's own range — a full-zero domain would flatten it. */}
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={stroke}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
            dot={false}
            activeDot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
