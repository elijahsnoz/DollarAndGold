import { ShieldAlert, TrendingDown, TrendingUp } from "lucide-react";

import { Card } from "@/components/ui/card";
import type { Scenario } from "@/lib/ai/types";
import { cn } from "@/lib/utils";

/**
 * The two conditional paths.
 *
 * Both are always shown, with equal weight, and each states its own
 * invalidation — the product should never present one direction as the answer.
 */
export function ScenarioCards({
  bullCase,
  bearCase,
}: {
  bullCase: Scenario;
  bearCase: Scenario;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ScenarioCard scenario={bullCase} tone="bull" />
      <ScenarioCard scenario={bearCase} tone="bear" />
    </div>
  );
}

function ScenarioCard({
  scenario,
  tone,
}: {
  scenario: Scenario;
  tone: "bull" | "bear";
}) {
  const Icon = tone === "bull" ? TrendingUp : TrendingDown;

  return (
    <Card className="relative overflow-hidden p-6">
      <span
        className={cn(
          "absolute inset-x-0 top-0 h-px",
          tone === "bull" ? "bg-bull/50" : "bg-bear/50",
        )}
      />

      <div className="flex items-center gap-3">
        <span
          className={cn(
            "grid h-9 w-9 place-items-center rounded-lg border",
            tone === "bull"
              ? "border-bull/25 bg-bull/12 text-bull"
              : "border-bear/25 bg-bear/12 text-bear",
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <h3 className="text-base font-semibold tracking-tight">
          {scenario.title}
        </h3>
      </div>

      <dl className="mt-5 space-y-3 text-sm">
        <Row label="Trigger" value={scenario.trigger} />
        <Row label="If it fires" value={scenario.objective} />
        <Row
          label="Invalidation"
          value={scenario.invalidation}
          icon={<ShieldAlert className="h-3.5 w-3.5" />}
        />
      </dl>

      <p className="mt-5 border-t border-border/60 pt-4 text-sm leading-relaxed text-muted-foreground">
        {scenario.narrative}
      </p>
    </Card>
  );
}

function Row({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-3">
      <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="leading-relaxed">{value}</dd>
    </div>
  );
}
