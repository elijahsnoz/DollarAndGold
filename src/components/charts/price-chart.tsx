"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatChartTime, formatCompact, formatPrice } from "@/lib/format";
import type { Candle, Timeframe } from "@/lib/market/types";
import { cn } from "@/lib/utils";
import { directionColor, useChartColors } from "./use-chart-colors";

interface Level {
  value: number;
  /** Omit to draw the line without a direct label. */
  label?: string;
  kind: "support" | "resistance";
}

/**
 * The main price chart.
 *
 * One series, one axis. Grid and axes are recessive so the price line is the
 * only thing with visual weight; support and resistance are drawn as dashed
 * reference lines because they are annotations on the price, not data of their
 * own. Hovering gives a crosshair and a tooltip with the full OHLC for the bar.
 */
export function PriceChart({
  candles,
  timeframe,
  precision,
  levels = [],
  height = 320,
  className,
}: {
  candles: Candle[];
  timeframe: Timeframe;
  precision: number;
  levels?: Level[];
  height?: number;
  className?: string;
}) {
  const colors = useChartColors();
  const gradientId = React.useId();

  const intraday = timeframe === "1D" || timeframe === "1W";

  const data = React.useMemo(
    () =>
      candles.map((candle) => ({
        t: candle.t,
        close: candle.c,
        open: candle.o,
        high: candle.h,
        low: candle.l,
        volume: candle.v,
      })),
    [candles],
  );

  if (data.length < 2) {
    return (
      <div
        style={{ height }}
        className={cn(
          "grid place-items-center rounded-2xl border border-border/60 text-sm text-muted-foreground",
          className,
        )}
      >
        Not enough price history to chart.
      </div>
    );
  }

  const first = data[0].close;
  const last = data[data.length - 1].close;
  const stroke = directionColor(last - first, colors);

  // Pad the domain so the line never touches the frame and levels stay visible.
  const lows = data.map((d) => d.low);
  const highs = data.map((d) => d.high);
  const levelValues = levels.map((l) => l.value);
  const min = Math.min(...lows, ...levelValues);
  const max = Math.max(...highs, ...levelValues);
  const padding = (max - min) * 0.08 || max * 0.01;

  return (
    <div className={className} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.22} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid
            stroke={colors.grid}
            strokeDasharray="0"
            vertical={false}
            opacity={0.55}
          />

          <XAxis
            dataKey="t"
            tickFormatter={(value: number) => formatChartTime(value, intraday)}
            tick={{ fill: colors.axis, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            minTickGap={44}
            dy={6}
          />

          <YAxis
            orientation="right"
            domain={[min - padding, max + padding]}
            tickFormatter={(value: number) => formatPrice(value, precision)}
            tick={{ fill: colors.axis, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={72}
          />

          {levels.map((level) => (
            <ReferenceLine
              key={`${level.kind}-${level.value}`}
              y={level.value}
              stroke={level.kind === "support" ? colors.bull : colors.bear}
              strokeDasharray="4 4"
              strokeOpacity={0.65}
              label={
                level.label
                  ? {
                      value: level.label,
                      position: "insideTopLeft",
                      fill: colors.axis,
                      fontSize: 10,
                    }
                  : undefined
              }
            />
          ))}

          <Tooltip
            cursor={{ stroke: colors.axis, strokeWidth: 1, strokeDasharray: "3 3" }}
            content={<PriceTooltip precision={precision} intraday={intraday} />}
          />

          <Area
            type="monotone"
            dataKey="close"
            stroke={stroke}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
            dot={false}
            activeDot={{
              r: 4,
              fill: stroke,
              // 2px surface ring so the marker reads on top of the fill.
              stroke: colors.surface,
              strokeWidth: 2,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

interface TooltipPayload {
  payload: {
    t: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  };
}

function PriceTooltip({
  active,
  payload,
  precision,
  intraday,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  precision: number;
  intraday: boolean;
}) {
  if (!active || !payload?.length) return null;
  const bar = payload[0].payload;

  const rows: [string, string][] = [
    ["Open", formatPrice(bar.open, precision)],
    ["High", formatPrice(bar.high, precision)],
    ["Low", formatPrice(bar.low, precision)],
    ["Close", formatPrice(bar.close, precision)],
    ["Volume", formatCompact(bar.volume)],
  ];

  return (
    <div className="glass rounded-xl px-3 py-2.5 text-xs">
      <p className="mb-1.5 font-medium text-foreground">
        {formatChartTime(bar.t, intraday)}
      </p>
      <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5">
        {rows.map(([label, value]) => (
          <React.Fragment key={label}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="tabular text-right font-medium text-foreground">
              {value}
            </dd>
          </React.Fragment>
        ))}
      </dl>
    </div>
  );
}
