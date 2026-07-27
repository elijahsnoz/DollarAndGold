"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";

const COLS = 64;
const ROWS = 27;

/**
 * Coarse landmass mask, one entry per row, each a list of inclusive column
 * ranges. Storing ranges rather than a bitmap keeps the map editable by hand
 * and costs a fraction of the bytes of real geometry — at this dot pitch the
 * silhouette is all that reads anyway.
 */
const LAND: Record<number, [number, number][]> = {
  0: [[20, 24]],
  1: [
    [19, 25],
    [44, 56],
  ],
  2: [
    [6, 10],
    [11, 24],
    [32, 35],
    [38, 58],
  ],
  3: [
    [5, 25],
    [30, 36],
    [37, 59],
  ],
  4: [
    [7, 24],
    [29, 37],
    [38, 60],
  ],
  5: [
    [7, 23],
    [29, 36],
    [38, 60],
  ],
  6: [
    [8, 22],
    [29, 35],
    [38, 58],
  ],
  7: [
    [8, 22],
    [29, 34],
    [38, 56],
    [57, 58],
  ],
  8: [
    [9, 21],
    [29, 38],
    [40, 54],
    [57, 57],
  ],
  9: [
    [11, 19],
    [28, 38],
    [38, 42],
    [45, 48],
    [50, 55],
  ],
  10: [
    [12, 18],
    [28, 39],
    [45, 48],
    [51, 56],
  ],
  11: [
    [15, 19],
    [28, 40],
    [45, 47],
    [52, 58],
  ],
  12: [
    [17, 21],
    [29, 40],
    [53, 58],
  ],
  13: [
    [19, 23],
    [30, 40],
  ],
  14: [
    [19, 25],
    [31, 40],
  ],
  15: [
    [19, 26],
    [31, 39],
  ],
  16: [
    [19, 26],
    [32, 38],
  ],
  17: [
    [20, 26],
    [32, 37],
  ],
  18: [
    [20, 26],
    [33, 36],
    [41, 41],
  ],
  19: [
    [20, 26],
    [33, 36],
    [41, 41],
    [54, 60],
  ],
  20: [
    [20, 25],
    [33, 35],
    [53, 61],
  ],
  21: [
    [21, 25],
    [33, 35],
    [53, 61],
  ],
  22: [
    [21, 24],
    [33, 35],
    [54, 60],
  ],
  23: [
    [21, 24],
    [55, 59],
    [62, 63],
  ],
  24: [
    [21, 23],
    [62, 63],
  ],
  25: [[21, 23]],
  26: [[21, 22]],
};

interface Dot {
  x: number;
  y: number;
}

function buildDots(): Dot[] {
  const dots: Dot[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (const [start, end] of LAND[row] ?? []) {
      for (let col = start; col <= end; col++) {
        dots.push({ x: col, y: row });
      }
    }
  }
  return dots;
}

/** Financial centres, positioned in the same grid space as the dots. */
const HUBS = [
  { id: "ny", label: "New York", x: 21, y: 7.5 },
  { id: "ldn", label: "London", x: 31.5, y: 5.5 },
  { id: "fra", label: "Frankfurt", x: 33.5, y: 6.2 },
  { id: "dxb", label: "Dubai", x: 41, y: 9.5 },
  { id: "sgp", label: "Singapore", x: 52, y: 12 },
  { id: "hkg", label: "Hong Kong", x: 54, y: 9.5 },
  { id: "tky", label: "Tokyo", x: 58, y: 7.5 },
  { id: "syd", label: "Sydney", x: 59, y: 20.5 },
] as const;

type HubId = (typeof HUBS)[number]["id"];

/** The routes that light up, in the order capital actually moves each day. */
const ROUTES: [HubId, HubId][] = [
  ["tky", "sgp"],
  ["sgp", "dxb"],
  ["dxb", "ldn"],
  ["ldn", "ny"],
  ["ny", "syd"],
  ["hkg", "fra"],
];

const hubById = new Map<HubId, (typeof HUBS)[number]>(
  HUBS.map((hub) => [hub.id, hub]),
);

/**
 * Quadratic arc between two hubs, bowed toward the top of the frame so routes
 * read as flight paths rather than chords.
 */
function arcPath(from: (typeof HUBS)[number], to: (typeof HUBS)[number]) {
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const lift = Math.abs(to.x - from.x) * 0.28 + 1.5;
  return `M ${from.x} ${from.y} Q ${midX} ${midY - lift} ${to.x} ${to.y}`;
}

/**
 * Hero world map.
 *
 * Purely decorative — it carries no data, so it is hidden from assistive
 * technology entirely. Under `prefers-reduced-motion` the arcs render at rest
 * instead of animating.
 */
export function WorldMap({ className }: { className?: string }) {
  const dots = React.useMemo(buildDots, []);
  const reduceMotion = useReducedMotion();

  return (
    <div className={className} aria-hidden="true">
      <svg
        viewBox={`-1 -1 ${COLS + 2} ${ROWS + 2}`}
        className="h-full w-full"
        fill="none"
      >
        <defs>
          <radialGradient id="dg-map-fade" cx="50%" cy="45%" r="62%">
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="70%" stopColor="white" stopOpacity="0.55" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <mask id="dg-map-mask">
            <rect
              x="-1"
              y="-1"
              width={COLS + 2}
              height={ROWS + 2}
              fill="url(#dg-map-fade)"
            />
          </mask>
          <linearGradient id="dg-arc" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="0" />
            <stop offset="45%" stopColor="hsl(var(--gold))" stopOpacity="0.9" />
            <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0" />
          </linearGradient>
        </defs>

        <g mask="url(#dg-map-mask)">
          {dots.map((dot) => (
            <circle
              key={`${dot.x}-${dot.y}`}
              cx={dot.x}
              cy={dot.y}
              r={0.28}
              fill="currentColor"
              className="text-foreground/25"
            />
          ))}

          {ROUTES.map(([fromId, toId], index) => {
            const from = hubById.get(fromId);
            const to = hubById.get(toId);
            if (!from || !to) return null;
            const d = arcPath(from, to);

            return (
              <g key={`${fromId}-${toId}`}>
                <path
                  d={d}
                  stroke="hsl(var(--gold))"
                  strokeOpacity={0.14}
                  strokeWidth={0.12}
                />
                <motion.path
                  d={d}
                  stroke="url(#dg-arc)"
                  strokeWidth={0.22}
                  strokeLinecap="round"
                  initial={
                    reduceMotion
                      ? { pathLength: 1, opacity: 0.5 }
                      : { pathLength: 0, opacity: 0 }
                  }
                  animate={
                    reduceMotion
                      ? { pathLength: 1, opacity: 0.5 }
                      : { pathLength: [0, 1, 1], opacity: [0, 1, 0] }
                  }
                  transition={
                    reduceMotion
                      ? undefined
                      : {
                          duration: 3.4,
                          times: [0, 0.62, 1],
                          repeat: Infinity,
                          // Stagger so the routes light in sequence, not together.
                          delay: index * 0.85,
                          ease: "easeInOut",
                        }
                  }
                />
              </g>
            );
          })}

          {HUBS.map((hub, index) => (
            <g key={hub.id}>
              {!reduceMotion && (
                <motion.circle
                  cx={hub.x}
                  cy={hub.y}
                  r={0.4}
                  fill="hsl(var(--gold))"
                  initial={{ scale: 0.6, opacity: 0.55 }}
                  animate={{ scale: [0.6, 2.6], opacity: [0.55, 0] }}
                  transition={{
                    duration: 2.8,
                    repeat: Infinity,
                    delay: index * 0.4,
                    ease: "easeOut",
                  }}
                  style={{ transformOrigin: `${hub.x}px ${hub.y}px` }}
                />
              )}
              <circle cx={hub.x} cy={hub.y} r={0.42} fill="hsl(var(--gold))" />
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
