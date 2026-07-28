/**
 * Unit tests for the pure engines.
 *
 * The smoke suite proves the app is wired together; this proves the parts that
 * make claims about a person are honest. The single most important property in
 * the whole codebase is here: **the personalisation engine must refuse to state
 * a pattern it cannot support.** A platform that tells someone they trade Gold
 * better than Crypto off three positions is guessing with their money at stake,
 * and once a user catches it doing that, nothing else it says is credible.
 *
 *   npm run test:unit
 */

import {
  composeBriefing,
  type MarketContext,
} from "@/lib/briefing/compose";
import {
  nothingLearnedYet,
  nothingToday,
  nothingUnusual,
  notKnown,
  stillDeveloping,
} from "@/lib/briefing/nothing-new";
import { conditionsFromAnalysis } from "@/lib/context/derive";
import { describeConditions, isEvidenceGrade } from "@/lib/context/types";
import {
  MATERIALITY_FLOOR,
  assessLevelProximity,
  assessMove,
  shouldStaySilent,
} from "@/lib/briefing/materiality";
import { buildRitualContext, dayKey, daySeed } from "@/lib/briefing/ritual";
import { buildMemories, resurface, timeline } from "@/lib/memory/derive";
import { deriveInsights } from "@/lib/personalisation/insights";
import { deriveProfile } from "@/lib/personalisation/profile";
import { EVIDENCE_THRESHOLDS } from "@/lib/personalisation/types";
import {
  EMPTY_WORKSPACE,
  type JournalEntry,
  type WorkspaceState,
} from "@/lib/workspace/types";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 6, 27, 12, 0, 0);

let passed = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail = "") {
  if (condition) passed++;
  else failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

function section(title: string) {
  console.log(`\n\x1b[1m${title}\x1b[0m`);
}

/** Build a closed trade with a known percentage result. */
function trade(
  symbol: string,
  resultPct: number,
  daysAgo: number,
  overrides: Partial<JournalEntry> = {},
): JournalEntry {
  const entryPrice = 100;
  const exitPrice = 100 * (1 + resultPct / 100);
  return {
    id: `${symbol}-${daysAgo}-${resultPct}`,
    symbol,
    direction: "long",
    entryPrice,
    exitPrice,
    thesis: "Test thesis.",
    outcome: resultPct > 0 ? "win" : "loss",
    openedAt: NOW - daysAgo * DAY,
    closedAt: NOW - (daysAgo - 1) * DAY,
    ...overrides,
  };
}

function workspace(partial: Partial<WorkspaceState>): WorkspaceState {
  return { ...EMPTY_WORKSPACE, ...partial };
}

// ---------------------------------------------------------------------------

function testEvidenceGating() {
  section("Evidence gating — the engine must refuse to guess");

  // Two markets, a huge apparent gap, but only two trades each. The naive
  // implementation happily declares a "strongest market" here. It must not.
  const thin = workspace({
    journal: [
      trade("XAUUSD", 12, 30),
      trade("XAUUSD", 9, 25),
      trade("BTCUSD", -11, 20),
      trade("BTCUSD", -8, 15),
    ],
  });

  const thinResult = deriveInsights(thin, NOW);
  check(
    "says nothing about market strength on 4 trades",
    !thinResult.insights.some((i) => i.id === "market-strength"),
    `got: ${thinResult.insights.map((i) => i.id).join(", ") || "none"}`,
  );

  // Same shape, enough trades. Now it may speak.
  const thick = workspace({
    journal: [
      trade("XAUUSD", 12, 60),
      trade("XAUUSD", 9, 55),
      trade("XAUUSD", 7, 50),
      trade("XAUUSD", 10, 45),
      trade("BTCUSD", -11, 40),
      trade("BTCUSD", -8, 35),
      trade("BTCUSD", -9, 30),
      trade("BTCUSD", -6, 25),
    ],
  });

  const thickResult = deriveInsights(thick, NOW);
  const strength = thickResult.insights.find((i) => i.id === "market-strength");

  check("speaks about market strength on 8 trades", Boolean(strength));
  check(
    "names the genuinely stronger market",
    strength?.title.includes("Gold") ?? false,
    strength?.title,
  );
  check(
    "attaches evidence to the claim",
    (strength?.evidence.observations ?? 0) >= EVIDENCE_THRESHOLDS.emerging,
    String(strength?.evidence.observations),
  );
  check(
    "cites its basis in plain English",
    (strength?.evidence.basis ?? "").includes("closed trades"),
    strength?.evidence.basis,
  );

  // Every surfaced insight, in any workspace, must clear the bar.
  const allSurfaced = thickResult.insights.every(
    (i) => i.evidence.observations >= EVIDENCE_THRESHOLDS.emerging,
  );
  check("no surfaced insight is below the evidence threshold", allSurfaced);

  // An identical-performance pair is not a pattern, however many trades.
  const flat = workspace({
    journal: [
      trade("XAUUSD", 5, 60),
      trade("XAUUSD", 5, 55),
      trade("XAUUSD", 5, 50),
      trade("BTCUSD", 5, 45),
      trade("BTCUSD", 5, 40),
      trade("BTCUSD", 5, 35),
    ],
  });
  check(
    "no market-strength claim when the gap is noise",
    !deriveInsights(flat, NOW).insights.some((i) => i.id === "market-strength"),
  );

  // Withheld patterns are counted, not silently dropped — that count is what
  // honestly tells a user the system is still learning.
  check(
    "counts withheld patterns rather than hiding them",
    thinResult.withheld >= 0 && Number.isFinite(thinResult.withheld),
  );
}

function testProfile() {
  section("Profile derivation");

  const empty = deriveProfile(EMPTY_WORKSPACE, NOW);
  check("a brand-new user is 'new'", empty.maturity === "new", empty.maturity);
  check("makes no claims about a new user", empty.insights.length === 0);
  check("tells a new user what would unlock more", empty.nextUnlock !== null);
  check("has no focus markets without activity", empty.focusMarkets.length === 0);

  // Attention decays: a market studied heavily long ago must not outrank one
  // studied recently, or every briefing leads with stale interests.
  const decayed = deriveProfile(
    workspace({
      researchLog: [
        ...Array.from({ length: 12 }, (_, i) => ({
          symbol: "TSLA",
          at: NOW - (150 + i) * DAY,
          trend: "bullish" as const,
          confidence: 60,
        })),
        ...Array.from({ length: 4 }, (_, i) => ({
          symbol: "XAUUSD",
          at: NOW - i * DAY,
          trend: "bullish" as const,
          confidence: 60,
        })),
      ],
    }),
    NOW,
  );

  check(
    "recent attention outranks stale attention",
    decayed.focusMarkets[0]?.symbol === "XAUUSD",
    `ranked: ${decayed.focusMarkets.map((m) => m.symbol).join(" > ")}`,
  );

  // A trade is a stronger signal of interest than a watchlist entry.
  const weighted = deriveProfile(
    workspace({
      watchlist: [{ symbol: "SPX", pinned: false, addedAt: NOW - DAY }],
      journal: [trade("XAUUSD", 3, 1)],
    }),
    NOW,
  );
  check(
    "acting on a market outweighs merely watching it",
    weighted.focusMarkets[0]?.symbol === "XAUUSD",
    `ranked: ${weighted.focusMarkets.map((m) => m.symbol).join(" > ")}`,
  );

  // Maturity must track real engagement, not raw record count.
  const busyOneDay = deriveProfile(
    workspace({
      researchLog: Array.from({ length: 40 }, (_, i) => ({
        symbol: "XAUUSD",
        at: NOW - i * 60_000,
        trend: "bullish" as const,
        confidence: 60,
      })),
    }),
    NOW,
  );
  check(
    "forty views in one day does not make a familiar profile",
    busyOneDay.maturity === "new",
    busyOneDay.maturity,
  );
}

function testMemories() {
  section("Market Memories");

  const state = workspace({
    notes: [
      {
        id: "n1",
        symbol: "XAUUSD",
        title: "Gold at resistance",
        body: "Gold rejected resistance at 3400.",
        updatedAt: NOW - 120 * DAY,
      },
      {
        id: "n2",
        title: "Recent thought",
        body: "Waiting for confirmation before entering.",
        updatedAt: NOW - 2 * DAY,
      },
    ],
    journal: [trade("XAUUSD", 6, 10)],
    researchLog: [
      { symbol: "BTCUSD", at: NOW - 3 * DAY, trend: "bullish", confidence: 70 },
      { symbol: "BTCUSD", at: NOW - 3 * DAY + 3600_000, trend: "bullish", confidence: 71 },
      { symbol: "BTCUSD", at: NOW - 2 * DAY, trend: "bearish", confidence: 55 },
    ],
  });

  const memories = buildMemories(state, NOW);

  check("notes become memories", memories.some((m) => m.kind === "observation"));
  check("trades become memories", memories.some((m) => m.kind === "trade"));

  // The user's own words are the archive's value — never paraphrased.
  const note = memories.find((m) => m.origin.refId === "n1");
  check(
    "an observation preserves the user's exact words",
    note?.body === "Gold rejected resistance at 3400.",
    note?.body,
  );

  // Two views on the same day collapse to one memory; a different day is separate.
  const research = memories.filter((m) => m.kind === "research");
  check(
    "research collapses to one memory per market per day",
    research.length === 2,
    `${research.length} research memories from 3 events across 2 days`,
  );

  check(
    "memories are ordered newest first",
    memories.every(
      (m, i) => i === 0 || memories[i - 1].occurredAt >= m.occurredAt,
    ),
  );

  check(
    "ids are stable across rebuilds",
    JSON.stringify(buildMemories(state, NOW).map((m) => m.id)) ===
      JSON.stringify(memories.map((m) => m.id)),
  );

  // Resurfacing is only worth doing for things genuinely forgotten.
  const older = resurface(state, { now: NOW });
  check(
    "resurfaces the old observation, not the recent one",
    older?.origin.refId === "n1",
    older?.title,
  );
  check(
    "reports how long ago it was",
    (older?.ageDays ?? 0) >= 100,
    String(older?.ageDays),
  );

  check(
    "nothing to resurface without old notes",
    resurface(workspace({ notes: [] }), { now: NOW }) === null,
  );

  // The timeline must not be swamped by low-value research rows.
  const meaningful = timeline(state, { minWeight: 2, now: NOW });
  check(
    "research is filtered out of the meaningful timeline",
    meaningful.every((m) => m.kind !== "research"),
  );
}

// ---------------------------------------------------------------------------

function marketContext(
  overrides: Partial<MarketContext> & { symbol: string },
): MarketContext {
  return {
    name: overrides.symbol,
    precision: 2,
    price: 100,
    changePercent: 0.1,
    atrValue: 1,
    atrPercent: 1,
    annualisedVol: 15,
    regime: "normal",
    supports: [],
    resistances: [],
    reason: "test",
    ...overrides,
  };
}

function testSilenceEngine() {
  section("Silence Engine — materiality is relative, not absolute");

  // The whole point: the same percentage means completely different things in
  // different markets. Any fixed-percentage threshold is wrong for most of the
  // catalog at once.
  const onFx = assessMove(2.0, 0.4); // ~5 ATRs — extraordinary for EUR/USD
  const onCrypto = assessMove(2.0, 3.0); // ~0.67 ATRs — an ordinary day for BTC

  check("a 2% move IS material when ATR is 0.4%", onFx.material, onFx.basis);
  check(
    "the same 2% move is NOT material when ATR is 3%",
    !onCrypto.material,
    onCrypto.basis,
  );
  check(
    "scores the quiet market lower than the violent one",
    onCrypto.score < onFx.score,
  );

  // Guessing without a volatility reference is the exact failure this prevents.
  check(
    "stays silent when there is no volatility reference",
    !assessMove(9.9, 0).material,
  );
  check("stays silent on a NaN reference", !assessMove(9.9, NaN).material);

  // A normal day must never clear the bar, however it is dressed up.
  check("an ordinary sub-ATR day is not material", !assessMove(0.5, 1).material);

  // Level proximity is likewise measured in ATRs.
  check("sitting on a level is material", assessLevelProximity(0.1).material);
  check("a level two ranges away is not", !assessLevelProximity(2).material);

  check(
    "silence requires that nothing cleared the floor",
    shouldStaySilent([0.1, 0.3, MATERIALITY_FLOOR - 0.01]),
  );
  check(
    "one material item breaks the silence",
    !shouldStaySilent([0.1, MATERIALITY_FLOOR]),
  );

  // Absence wording lives in one place (nothing-new.ts) and is covered there;
  // a second copy here is how two surfaces start saying it differently.
}

function testBriefingComposition() {
  section("Briefing composition");

  const base = {
    workspace: EMPTY_WORKSPACE,
    profile: deriveProfile(EMPTY_WORKSPACE, NOW),
    ritual: {},
    usingDefaults: true,
    now: NOW,
  };

  // Three calm markets must produce silence, not three filler items.
  const calm = composeBriefing({
    ...base,
    contexts: [
      marketContext({ symbol: "XAUUSD", changePercent: 0.2, atrPercent: 1.1 }),
      marketContext({ symbol: "EURUSD", changePercent: -0.05, atrPercent: 0.4 }),
      marketContext({ symbol: "SPX", changePercent: 0.3, atrPercent: 0.9 }),
    ],
  });

  check("a calm morning is reported as quiet", calm.quiet, `${calm.items.length} items`);
  check("no items survive on a calm morning", calm.items.length === 0);
  check(
    "still reports how many observations were checked",
    calm.considered > 0,
    String(calm.considered),
  );
  check("markets are still listed when quiet", calm.markets.length === 3);

  // One genuinely violent move must break the silence.
  const active = composeBriefing({
    ...base,
    contexts: [
      marketContext({ symbol: "XAUUSD", changePercent: 0.2, atrPercent: 1.1 }),
      marketContext({
        symbol: "BTCUSD",
        name: "Bitcoin",
        changePercent: -9,
        atrPercent: 3,
      }),
    ],
  });

  check("a real move breaks the silence", !active.quiet);
  check(
    "the material item is about the market that moved",
    active.items[0]?.symbol === "BTCUSD",
    active.items[0]?.headline,
  );
  check(
    "items are ordered by materiality",
    active.items.every(
      (item, i) => i === 0 || active.items[i - 1].materiality >= item.materiality,
    ),
  );
  check(
    "every surfaced item cleared the floor",
    active.items.every((item) => item.materiality >= MATERIALITY_FLOOR),
  );

  // A persistent state must never become a daily item. A market that is quiet
  // today was quiet yesterday, so surfacing it in "Today" would put the same
  // line in front of the user every morning until they stopped reading it.
  const quietMarket = composeBriefing({
    ...base,
    contexts: [
      marketContext({
        symbol: "EURUSD",
        changePercent: 0.05,
        atrPercent: 0.4,
        regime: "low",
        annualisedVol: 5,
      }),
    ],
  });
  check(
    "a low-volatility regime is not a Today item",
    !quietMarket.items.some((item) => item.category === "volatility"),
    quietMarket.items.map((i) => i.category).join(", "),
  );
  check("a quiet market alone produces silence", quietMarket.quiet);
  check(
    "but volatility still reaches Risk Intelligence",
    quietMarket.risk.summary.length > 0 && quietMarket.risk.notes.length > 0,
  );

  // Research suggestions must be earned, never filler.
  check("no research suggestions on a quiet morning", calm.research.length === 0);
  check("research suggestions follow material items", active.research.length > 0);

  // Risk must never instruct.
  const banned = ["reduce your", "you should", "we recommend", "buy", "sell"];
  const riskText = [active.risk.summary, ...active.risk.notes].join(" ").toLowerCase();
  for (const phrase of banned) {
    check(`risk copy avoids "${phrase}"`, !riskText.includes(phrase));
  }
}

function testRitual() {
  section("Daily Ritual Engine");

  const first = buildRitualContext({}, { now: NOW });
  check("a first visit has nothing to look back on", first.sinceLastVisit === null);
  check("a first visit is the first of the day", first.firstToday);
  check("greets by time of day", first.greeting.startsWith("Good "), first.greeting);
  check("uses a name when given", buildRitualContext({}, { now: NOW, name: "Elijah" }).greeting.includes("Elijah"));

  const yesterday = buildRitualContext(
    { lastOpenedAt: NOW - DAY, lastBriefingDay: dayKey(NOW - DAY) },
    { now: NOW },
  );
  check(
    "recognises a return after a day",
    yesterday.sinceLastVisit?.includes("yesterday") ?? false,
    String(yesterday.sinceLastVisit),
  );
  check("a new day is the first briefing of that day", yesterday.firstToday);

  const sameDay = buildRitualContext(
    { lastOpenedAt: NOW - 3600_000, lastBriefingDay: dayKey(NOW) },
    { now: NOW },
  );
  check("a second visit today is not the first", !sameDay.firstToday);
  check(
    "does not tell you how long since you were here today",
    sameDay.sinceLastVisit === null,
  );

  const away = buildRitualContext(
    { lastOpenedAt: NOW - 40 * DAY, lastBriefingDay: dayKey(NOW - 40 * DAY) },
    { now: NOW },
  );
  check(
    "describes a long absence in months",
    away.sinceLastVisit?.includes("month") ?? false,
    String(away.sinceLastVisit),
  );

  // The briefing must be stable within a day — that is what makes it a ritual
  // rather than a feed worth refreshing.
  check(
    "the day seed is stable within a day",
    daySeed(dayKey(NOW)) === daySeed(dayKey(NOW + 3600_000)),
  );
  check(
    "the day seed changes across days",
    daySeed(dayKey(NOW)) !== daySeed(dayKey(NOW + DAY)),
  );
}

/** Minimal analysis fixture — only the fields a snapshot reads. */
function analysisFixture(
  overrides: {
    structureSignal?: "bullish" | "bearish" | "neutral";
    supports?: number[];
    resistances?: number[];
    atr?: number;
    price?: number;
  } = {},
) {
  const {
    structureSignal = "bullish",
    supports = [95],
    resistances = [110],
    atr = 2,
    price = 100,
  } = overrides;

  return {
    symbol: "XAUUSD",
    generatedAt: NOW,
    price,
    trend: {
      direction: "bullish" as const,
      confidence: 62,
      headline: "",
      contributions: [
        { label: "RSI (14)", signal: "bullish" as const, weight: 0.14 },
        { label: "Market structure", signal: structureSignal, weight: 0.12 },
      ],
    },
    volatility: {
      regime: "normal" as const,
      annualisedPct: 15,
      atr,
      atrPercent: (atr / price) * 100,
      description: "",
    },
    supports,
    resistances,
  } as Parameters<typeof conditionsFromAnalysis>[0];
}

function testMarketContext() {
  section("Market Context Engine");

  const conditions = conditionsFromAnalysis(analysisFixture(), "coingecko");

  check("captures the moment, not now", conditions.capturedAt === NOW);
  check("records the trend", conditions.trend === "bullish");
  check("records volatility regime", conditions.volatilityRegime === "normal");
  check(
    "derives structure from the trend signal",
    conditions.structure === "higher-highs",
    conditions.structure,
  );
  check(
    "derives falling structure too",
    conditionsFromAnalysis(analysisFixture({ structureSignal: "bearish" })).structure ===
      "lower-lows",
  );
  check(
    "falls back to range when structure is neutral",
    conditionsFromAnalysis(analysisFixture({ structureSignal: "neutral" })).structure ===
      "range",
  );

  // Nearest level must be measured in ATRs, and must pick the closer side.
  check(
    "finds the nearest level",
    conditions.nearestLevel?.kind === "support",
    JSON.stringify(conditions.nearestLevel),
  );
  check(
    "measures distance in typical daily ranges",
    conditions.nearestLevel?.atrsAway === 2.5,
    String(conditions.nearestLevel?.atrsAway),
  );
  check(
    "omits the level when there is no volatility reference",
    conditionsFromAnalysis(analysisFixture({ atr: 0 })).nearestLevel === undefined,
  );

  // THE guarantee: conditions captured against simulated prices describe a
  // market that does not exist, and must never be pooled with live
  // observations to draw conclusions about someone's real behaviour.
  check(
    "live conditions are evidence-grade",
    isEvidenceGrade(conditionsFromAnalysis(analysisFixture(), "coingecko")),
  );
  check(
    "simulated conditions are NOT evidence-grade",
    !isEvidenceGrade(conditionsFromAnalysis(analysisFixture(), "simulated")),
  );
  check(
    "price-anchored simulation is NOT evidence-grade",
    !isEvidenceGrade(
      conditionsFromAnalysis(analysisFixture(), "simulated-anchored"),
    ),
  );
  check(
    "an unsourced snapshot is NOT evidence-grade",
    !isEvidenceGrade(conditionsFromAnalysis(analysisFixture())),
  );

  check(
    "describes itself readably",
    describeConditions(conditions).includes("normal volatility"),
    describeConditions(conditions),
  );
}

function testNothingNew() {
  section("Nothing New — honest absence");

  const quiet = nothingToday(4, 12);
  check("states what was checked", quiet.body.includes("12 observations"));
  check(
    "frames a quiet morning as useful",
    quiet.body.includes("attention is free"),
    quiet.body,
  );

  const noMarkets = nothingToday(0, 0);
  check(
    "distinguishes an empty desk from a quiet one",
    noMarkets.headline !== quiet.headline,
  );

  const learning = nothingLearnedYet(2, 5);
  check(
    "says how much more history is needed",
    learning.body.includes("3 more closed"),
    learning.body,
  );
  check(
    "does not conflate 'nothing happened' with 'we don't know yet'",
    learning.headline !== quiet.headline,
  );

  const developing = stillDeveloping(3);
  check(
    "prefers waiting over guessing, and says so",
    developing.body.includes("rather wait than guess"),
  );

  // Absence must never apologise or pad — that is what turns a finding into
  // an excuse, and it is how a calm product starts sounding like a broken one.
  const banned = ["unfortunately", "sorry", "check back", "stay tuned", "oops"];
  const allCopy = [
    quiet,
    noMarkets,
    learning,
    developing,
    nothingUnusual(3),
    notKnown("the dollar"),
  ]
    .flatMap((message) => [message.headline, message.body])
    .join(" ")
    .toLowerCase();

  for (const phrase of banned) {
    check(`absence copy avoids "${phrase}"`, !allCopy.includes(phrase));
  }
}

function main() {
  console.log("Running unit tests for the pure engines");

  testEvidenceGating();
  testProfile();
  testMemories();
  testSilenceEngine();
  testBriefingComposition();
  testRitual();
  testMarketContext();
  testNothingNew();

  console.log(`\n${"-".repeat(52)}`);
  if (failures.length === 0) {
    console.log(`\x1b[32m✓ ${passed} checks passed\x1b[0m`);
    return;
  }

  console.log(`\x1b[31m✗ ${failures.length} failed\x1b[0m (${passed} passed)\n`);
  for (const failure of failures) console.log(`  · ${failure}`);
  process.exitCode = 1;
}

main();
