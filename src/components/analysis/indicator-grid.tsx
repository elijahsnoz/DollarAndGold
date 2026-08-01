import { GlossaryTerm } from "@/components/education/glossary-term";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { IndicatorReading } from "@/lib/market/types";

const SIGNAL_VARIANT = {
  bullish: "bull",
  bearish: "bear",
  neutral: "neutral",
} as const;

/**
 * Technical indicators.
 *
 * Each reading carries its own plain-English interpretation from the engine, so
 * a reader who has never seen MACD before still learns something rather than
 * being shown a number and left to look it up.
 */
export function IndicatorGrid({ indicators }: { indicators: IndicatorReading[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {indicators.map((indicator) => (
        <Card key={indicator.key} className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                <GlossaryTerm term={indicator.key}>{indicator.label}</GlossaryTerm>
              </p>
              <p className="tabular mt-1 text-lg font-semibold tracking-tight">
                {indicator.value}
              </p>
            </div>
            <Badge variant={SIGNAL_VARIANT[indicator.signal]} className="capitalize">
              {indicator.signal}
            </Badge>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {indicator.interpretation}
          </p>
        </Card>
      ))}
    </div>
  );
}
