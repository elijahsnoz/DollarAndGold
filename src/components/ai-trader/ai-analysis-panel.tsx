"use client";

import * as React from "react";
import { ArrowUp, Loader2 } from "lucide-react";

import { GlossaryTerm } from "@/components/education/glossary-term";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { formatPrice, formatSignedPercent } from "@/lib/format";
import type { TradeAnalysis } from "@/lib/ai-trader/types";
import { cn } from "@/lib/utils";

const SIGNAL_VARIANT = { buy: "bull", sell: "bear", hold: "neutral" } as const;
const SIGNAL_LABEL = { buy: "Buy", sell: "Sell", hold: "Hold" } as const;
const SUGGESTIONS = ["Analyze BTC", "Analyze Gold", "Analyze EURUSD"];

/**
 * Section 3: AI Analysis.
 *
 * Every number in the result traces back to the deterministic engine —
 * `compose.ts` never calls an LLM for the figures. "Never simply output BUY
 * or SELL" is satisfied by always attaching `reasons` and `suggestion.note`,
 * not by generating free-form prose that could drift from the numbers above it.
 */
export function AiAnalysisPanel() {
  const [question, setQuestion] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [analysis, setAnalysis] = React.useState<TradeAnalysis | null>(null);

  const analyze = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/ai-trader/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Something went wrong.");
      setAnalysis(data.analysis as TradeAnalysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section>
      <h2 className="text-lg font-semibold tracking-tight">AI Analysis</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Ask about a market. Every figure below is computed — see each
        section&apos;s reasoning rather than taking a signal on faith.
      </p>

      <Card className="mt-5 p-5">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void analyze(question);
          }}
          className="flex gap-2"
        >
          <Textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void analyze(question);
              }
            }}
            rows={1}
            placeholder="Analyze BTC"
            aria-label="Ask about a market"
            className="min-h-[44px] resize-none"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!question.trim() || loading}
            aria-label="Analyze"
          >
            {loading ? <Loader2 className="animate-spin" /> : <ArrowUp />}
          </Button>
        </form>

        {!analysis && !loading && (
          <div className="mt-4 flex flex-wrap gap-2">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => {
                  setQuestion(suggestion);
                  void analyze(suggestion);
                }}
                className="rounded-full border border-border/70 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {error && <p className="mt-4 text-sm text-bear">{error}</p>}
      </Card>

      {analysis && <AnalysisResult analysis={analysis} />}
    </section>
  );
}

function AnalysisResult({ analysis }: { analysis: TradeAnalysis }) {
  const p = analysis.precision;
  const { suggestion } = analysis;

  return (
    <div className="mt-5 space-y-4">
      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              {analysis.assetName}
            </p>
            <div className="mt-1 flex items-baseline gap-3">
              <span className="tabular text-2xl font-semibold tracking-tight">
                {formatPrice(analysis.price, p)}
              </span>
              <span
                className={cn(
                  "tabular text-sm font-medium",
                  analysis.changePercent > 0 && "text-bull",
                  analysis.changePercent < 0 && "text-bear",
                )}
              >
                {formatSignedPercent(analysis.changePercent)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={SIGNAL_VARIANT[suggestion.signal]} className="text-sm">
              {SIGNAL_LABEL[suggestion.signal]}
            </Badge>
            <GlossaryTerm term="confidence">
              <Badge variant="outline">{analysis.confidenceScore}/100 confidence</Badge>
            </GlossaryTerm>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Confidence measures indicator agreement, not a probability this
          trade works. {analysis.narrator === "claude" ? "Written by Claude." : "Rules engine."}
        </p>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <SectionLabel>Trend &amp; momentum</SectionLabel>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Trend" value={<span className="capitalize">{analysis.trend}</span>} />
            <Row
              label={<GlossaryTerm term="macd">Momentum</GlossaryTerm>}
              value={analysis.momentum.value}
            />
            <Row
              label={<GlossaryTerm term="volume">Volume</GlossaryTerm>}
              value={analysis.volumeAnalysis.value}
            />
          </dl>
        </Card>

        <Card className="p-5">
          <SectionLabel>Levels &amp; risk</SectionLabel>
          <dl className="mt-3 space-y-2 text-sm">
            <Row
              label={<GlossaryTerm term="support">Support</GlossaryTerm>}
              value={analysis.support.map((value) => formatPrice(value, p)).join(", ") || "n/a"}
            />
            <Row
              label={<GlossaryTerm term="resistance">Resistance</GlossaryTerm>}
              value={
                analysis.resistance.map((value) => formatPrice(value, p)).join(", ") || "n/a"
              }
            />
            <Row
              label={<GlossaryTerm term="volatility">Risk</GlossaryTerm>}
              value={<span className="capitalize">{analysis.risk.regime}</span>}
            />
          </dl>
        </Card>
      </div>

      <Card className="p-5">
        <SectionLabel>Reasons</SectionLabel>
        <ul className="mt-3 space-y-2">
          {analysis.reasons.map((reason) => (
            <li key={reason} className="flex gap-2.5 text-sm leading-relaxed">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-gold" />
              {reason}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-6">
        <SectionLabel>Suggested trade</SectionLabel>
        {suggestion.entry === null ? (
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{suggestion.note}</p>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Entry" value={formatPrice(suggestion.entry, p)} />
              <Stat
                label="Stop loss"
                value={formatPrice(suggestion.stopLoss as number, p)}
                tone="bear"
              />
              <Stat
                label="Take profit"
                value={formatPrice(suggestion.takeProfit as number, p)}
                tone="bull"
              />
              <Stat
                label="Risk : reward"
                value={`${(suggestion.riskRewardRatio as number).toFixed(2)} : 1`}
              />
            </div>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{suggestion.note}</p>
          </>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <SectionLabel>News summary</SectionLabel>
          {analysis.newsSummary.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No recent headlines for this market.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {analysis.newsSummary.map((article) => (
                <li key={article.headline} className="text-sm">
                  <p className="font-medium leading-snug">{article.headline}</p>
                  <p className="mt-1 leading-relaxed text-muted-foreground">{article.summary}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <SectionLabel>Macro events</SectionLabel>
          {analysis.macroEvents.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Nothing flagged.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {analysis.macroEvents.map((event) => (
                <li key={event} className="text-sm leading-relaxed">
                  {event}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <UnavailableCard title="Whale activity" note={analysis.whaleActivityNote} />
        <UnavailableCard title="Funding rate" note={analysis.fundingRateNote} />
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
      {children}
    </p>
  );
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "bull" | "bear";
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "tabular mt-1 text-base font-semibold",
          tone === "bull" && "text-bull",
          tone === "bear" && "text-bear",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function UnavailableCard({ title, note }: { title: string; note: string }) {
  return (
    <Card className="p-5">
      <SectionLabel>{title}</SectionLabel>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{note}</p>
    </Card>
  );
}
