# DollarAndGold.xyz

**AI-powered market intelligence for Forex, Gold, Crypto, Stocks and Indices.**

DollarAndGold is a research terminal. It is **not a broker, not an exchange, and
not a financial adviser**. It helps a trader understand what a market is doing,
which levels would confirm or break that read, and what could go wrong — then
gets out of the way. It never recommends a trade and never promises a profit.

---

## Quick start

```bash
npm install
npm run dev      # http://localhost:3000
```

**No configuration is required.** The app runs completely out of the box:
simulated market data, the deterministic analysis engine, a working assistant,
and a workspace saved in your browser. Every environment variable is an
*upgrade*, not a prerequisite — see [Configuration](#configuration).

```bash
npm run build && npm start   # production build
npm run typecheck            # tsc --noEmit
npm run lint                 # next lint
npm run test                 # smoke suite (needs a running server)
```

### Testing

Two suites:

- **`npm run test:unit`** — [`scripts/unit.ts`](scripts/unit.ts), 25 checks over
  the pure engines. This is where the personalisation engine is held to its
  central promise: *it must refuse to state a pattern it cannot support*. The
  tests assert silence as forcefully as they assert output.
- **`npm run test:smoke`** — [`scripts/smoke.mjs`](scripts/smoke.mjs), 293
  assertions against a running server.

`npm run test` runs both. No test framework: the smoke suite is HTTP plus
assertions, and the unit suite is pure functions plus assertions — a runner
would be more dependency than value at this size.

```bash
npm run build && npm start &
npm run test                        # defaults to http://localhost:3000
BASE_URL=http://localhost:3111 npm run test
```

It checks the things that actually matter and that a refactor could silently
break:

| Group | What it proves |
| --- | --- |
| Routes | Every page returns 200; an unknown symbol returns **404**, not a 200 with a not-found body |
| Quotes | Price is finite and positive, and sits inside the 24h range |
| Series | High/low bound open/close, timestamps strictly increase, bar spacing is uniform |
| Determinism | Repeated reads are byte-identical, and overlapping timeframes agree about the same instant |
| Analysis | Across the whole catalog: confidence within [30, 88], **every support below price and every resistance above it**, RSI within [0, 100], the summary's "X of Y signals" fraction matches the contributions it came from |
| Compliance | The disclaimer is present, simulated data is disclosed, confidence is explained as agreement rather than win probability, and no generated copy contains promise language |
| Search & chat | Search finds markets, nonsense returns nothing, the assistant answers an indicator question, and an empty conversation is rejected |

The suite earned its keep immediately — it caught three real bugs on its first
run, described in [Known issues](#known-issues).

---

## What it does

| Route | What's there |
| --- | --- |
| `/` | Landing page — animated world map, live ticker, featured markets |
| `/markets` | Nine live markets with price, 24h change, session range and sparkline |
| `/analysis` | Market picker, grouped by asset class |
| `/analysis/[symbol]` | **The centrepiece** — full structured analysis |
| `/news` | Feed where every story carries a 30-second summary, why it matters, and likely market impact |
| `/watchlist` | Pin markets, set price alerts, jump into analysis |
| `/dashboard` | Daily briefing, recent analyses, alert centre, notes, trading journal, performance insights |
| `/pricing` | Free / Pro / Enterprise, plus the FAQ that answers "is this financial advice?" |
| `/sign-in` | Supabase auth (or an honest explanation when it isn't configured) |
| `/admin` | Users and news, for accounts with `is_admin` set — see [Admin dashboard](#admin-dashboard) |

Global search (`⌘K` / `Ctrl-K`) covers markets, currencies, stocks, crypto and
news in one pass. The floating assistant is available on every page.

---

## Architecture

The guiding decision: **the analysis is computed, and the language model only
explains it.** Three layers, each swappable without touching the others.

```text
src/lib/market/     data      → what the market did      (deterministic)
src/lib/ai/         analysis  → what that means          (deterministic)
src/lib/ai/narrate  narration → how to say it            (Claude, optional)
```

### 1. Market data — `src/lib/market/`

| File | Role |
| --- | --- |
| `types.ts` | The domain contract everything speaks — `Asset`, `Candle`, `Quote`, `Series` |
| `catalog.ts` | The tradeable universe, plus search |
| `provider.ts` | Resolves the active `MarketDataProvider` |
| `providers/` | Live sources, cache, and the composite that routes between them |
| `simulation.ts` | Deterministic price model — the always-succeeds floor |
| `indicators.ts` | Real technical-analysis math (SMA, EMA, RSI, MACD, Bollinger, ATR, pivots) |
| `provenance.ts` | How each source is described to the user |

#### Live data

Sources are tried **per symbol** in priority order, and the app falls back to
the simulation only when none can answer:

| Priority | Source | Key | Covers |
| --- | --- | --- | --- |
| 1 | Twelve Data | required | **Everything** — metals, FX, crypto, indices, equities |
| 2 | CoinGecko | none | Crypto |
| 3 | Frankfurter (ECB) | none | Major FX, daily granularity only |
| 4 | Yahoo Finance | none | Broad, best-effort, no SLA |
| — | Simulation | none | Whatever is left |

Out of the box, with **no keys at all**, crypto and major FX are already live.
Setting `TWELVE_DATA_API_KEY` (free tier) makes the entire catalog live.

Three details that matter more than they look:

- **Caching is a correctness feature, not an optimisation.** Free tiers throttle
  aggressively — Yahoo started returning 429 after sixteen rapid requests during
  development and stayed there for minutes. `providers/cache.ts` adds a TTL
  *and* de-duplicates in-flight requests, so nine market cards rendering at once
  produce one upstream call, not nine.
- **A failing source is benched**, not retried on every request. Otherwise one
  rate-limited upstream turns every page load into a slow cascade of doomed
  calls.
- **Degradation is anchored.** If an asset's quote is live but no source covers
  the requested timeframe, the simulated series is rescaled to end at the live
  price. Without this the same pair showed 1.1389 on one chart and 1.0839 on
  another. It is still simulated and still labelled — this fixes the
  contradiction, not the gap.

#### Provenance

Every `Quote` and `Series` carries a `source`, and the UI always states it: a
live badge naming the feed, or a warning badge reading **Simulated**. Simulated
markets are flagged on their card; live ones are not, because the risk is
mistaking a simulated price for a real one, never the reverse.

The same principle runs into the analysis: the ECB publishes rates but not
turnover, so for those pairs the Volume indicator reads **"Not published"**
rather than asserting participation is normal. The engine does not invent a
reading it does not have.

**To add a source**, implement `MarketDataSource` (four methods, allowed to
decline a symbol and allowed to fail) and add it to the list in
`providers/composite.ts`. Nothing in the UI or the analysis engine changes.

### 2. Analysis engine — `src/lib/ai/analysis.ts`

Derives the entire verdict from the candle series alone:

- **Trend** from six weighted signals (long-MA position, EMA cross, MACD
  momentum, RSI, Bollinger position, market structure).
- **Confidence** measures *how much the indicators agree with each other* —
  explicitly **not** a probability that a trade succeeds. Floored at 30 and
  capped at 88, because the product must never imply certainty.
- **Support and resistance** from fractal pivots, clustered within a
  volatility-scaled tolerance and ranked by how often price respected them.
- **Scenarios, risks and events** derived from the levels, the volatility
  regime and the asset class.

Same series in, same verdict out.

### 3. Narration — `src/lib/ai/narrate.ts` *(optional)*

With `ANTHROPIC_API_KEY` set, Claude rewrites the prose. It receives the
computed figures as a factsheet and is **forbidden from inventing numbers** —
which is what keeps the writing consistent with the chart on screen. Every
failure path (no key, refusal, timeout, malformed JSON) returns the rules-engine
analysis unchanged, so the AI layer is never on the critical path.

The UI labels which layer wrote the text: *"Written by Claude"* or
*"Rules engine"*.

### The Market Desk — `src/lib/briefing/`

The surface this product exists to be opened at. Four ideas hold it together.

**The Silence Engine.** Materiality is scored **relative to how a market
normally behaves**, never as a fixed percentage — a 2% day in EUR/USD is
extraordinary, a 2% day in Bitcoin is a Tuesday, and any percentage threshold is
therefore wrong for most of the catalog at once. Scoring in units of the asset's
own ATR makes one rule correct everywhere. The bar is set high on purpose:
being wrong by staying quiet costs a user nothing, while crying wolf costs their
trust in everything else the platform says. When nothing clears the floor the
briefing says **"Nothing needs your attention this morning"** and means it.

**Persistent states are not events.** A market that is quiet today was quiet
yesterday. Volatility regime therefore never appears in *Today* — it would put
the same line in front of the user every morning until they stopped reading the
section — and lives in Risk Intelligence, which is about standing conditions.

**Personalisation decides what is looked at, not just what is ranked.** Only the
user's own markets are examined. A briefing about markets someone does not
follow is noise however well written, and evaluating five markets properly costs
less than evaluating sixteen badly.

**Composition is split for privacy.** The server is handed a list of symbols and
nothing else; notes, journal, profile and archive never leave the browser. See
`loadMarketContexts` (server) and `composeBriefing` (client, pure, unit-tested).

#### The Daily Ritual Engine — `briefing/ritual.ts`

A ritual is not a feed. The briefing is **stable for the whole day** — open it at
07:00 and again at 11:00 and it reads the same, because a morning paper that
rewrote itself every time you glanced at it would train you to keep glancing.

Deliberately absent: streaks, badges, counters, "you're on fire". Those
manufacture obligation, and a product that makes people feel guilty for missing a
day is one they eventually resent. The only pull is that the briefing is worth
reading.

#### Risk Intelligence — `briefing/risk.ts`

Describes conditions; never instructs. *"Reduce your position size"* is advice,
which this platform does not give. *"Gold is moving about $54 in a typical day,
so any level closer than that will be reached by ordinary movement"* is a fact
that leaves the decision where it belongs. A test asserts the copy contains no
instruction verbs.

### Personalisation — `src/lib/personalisation/`

What the system believes about a user, derived from what they actually did.

The load-bearing constraint is **evidence gating**. Every belief carries an
observation count and a confidence grade, and the renderer may not display
anything below `emerging` (5 observations). A platform that announces "you
trade Gold better than Crypto" off three positions is guessing with someone's
money at stake — and once a user catches it doing that, every later claim
inherits the doubt.

So the engine is built to refuse:

- Comparative claims need a real sample **in both things being compared**, not
  just in total.
- A difference below a meaningful threshold is noise, and is dropped.
- Withheld patterns are **counted and surfaced** — "3 patterns are forming but
  not yet supported by enough history" is both honest and a real reason to come
  back.
- Every displayed insight states its basis, so a claim can be audited rather
  than taken on faith.
- Language hedges automatically while a pattern is `emerging`.

Attention decays with a 21-day half-life. A market someone studied daily three
months ago is not their focus market today, and a briefing that leads with it is
wrong in the way that makes people stop opening the product.

### Market Memories — `src/lib/memory/`

The user's personal archive: notes, trades, research, derived patterns and
milestones, on one timeline. Not conversational memory, and not a second place
to file things — it assembles itself from activity the user was doing anyway.

**Derived, not stored.** A parallel memories collection would drift from the
records it describes (delete a trade, its memory outlives it) and would need a
migration every time a capture rule changed. Deriving keeps the archive
consistent with the truth, and means a rule written today applies retroactively
to a year of history.

Two rules keep it worth reading:

- **A user's own words are never paraphrased.** An observation is preserved
  verbatim — that is the entire value of an archive.
- **Research collapses to one memory per market per day.** A memory per click
  would bury the handful of things the user actually wrote, which is the exact
  information overload the product exists to remove.

`resurface()` returns an observation old enough to have been genuinely
forgotten (21+ days) — the "four months ago you wrote…" moment.

### Workspace — `src/lib/workspace/`

Watchlist, notes, trading journal and recent analyses sit behind a
`WorkspaceBackend` interface with two implementations: `LocalBackend`
(localStorage) and `SupabaseBackend`. The store swaps backends when the auth
state changes, so **every dashboard feature works before the user has an
account, and keeps working after they create one**.

---

## Configuration

Copy `.env.example` to `.env.local`. Every variable is optional.

| Variable | Without it | With it |
| --- | --- | --- |
| `TWELVE_DATA_API_KEY` | Crypto and major FX are live; metals, indices, oil and equities are simulated and labelled | **The entire catalog is live.** The highest-value variable here |
| `ANTHROPIC_API_KEY` | Analyses written by the rules engine; assistant answers from its glossary and the analysis engine | Claude writes the prose and powers the assistant |
| `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Demo mode — workspace saved in the browser | Real accounts, workspace synced across devices |
| `NEXT_PUBLIC_SITE_URL` | Defaults to `https://dollarandgold.xyz` | Canonical origin for metadata, sitemap and robots |

### Enabling accounts

1. Create a project at [supabase.com](https://supabase.com).
2. Run [`supabase/schema.sql`](supabase/schema.sql) in the SQL editor. It creates
   `profiles`, `workspaces` and `news_articles`, enables row-level security with
   self-access-only policies, and adds the sign-up trigger.
3. Add the URL and anon key to `.env.local`.

### Admin dashboard

`/admin` manages users (plan, admin access) and news (the articles that
replace the sample feed). It needs Supabase configured, and needs an admin to
already exist — nobody starts as one, so bootstrap the first admin once in the
SQL editor:

```sql
update public.profiles set is_admin = true where email = 'you@example.com';
```

From there, admins can promote or demote other accounts from the Users tab.
`news_articles` is checked category-by-category: a published article there
takes over its category, and any category with nothing published keeps
showing the bundled sample stories — the same per-symbol fallback shape
`providers/composite.ts` uses for market data. See `is_admin()` and the
`protect_privileged_profile_fields` trigger in `supabase/schema.sql` for how
`plan`/`is_admin` are protected from being self-granted.

### Model

Requests use `claude-opus-5` with adaptive thinking, structured outputs for the
narration, and server-side refusal fallbacks enabled — see
`src/lib/ai/client.ts`.

---

## Design

Dark-mode-first, built to read like a terminal that an Apple designer got hold
of: near-black canvas, a single gold accent, and semantic bull/bear colours
reserved exclusively for market data.

- **One glass recipe** (`.glass` in `globals.css`) used by every elevated
  surface, so cards, popovers and the chat dock cannot drift apart.
- **Tabular numerals** on every price, so digits don't reflow as they tick.
- **Direction is never colour-alone** — arrows on change pills, position
  relative to zero on charts, text labels on signals.
- **Charts follow one-axis discipline**, thin marks, recessive grid, selective
  direct labels, and a crosshair tooltip with full OHLC.
- `prefers-reduced-motion` disables animation globally; the hero's entrance is
  CSS-only so the headline never depends on JavaScript to be visible.

---

## Project structure

```text
src/
├── app/
│   ├── api/               markets · analysis · chat · news · search · admin
│   ├── analysis/[symbol]/ the analysis page
│   ├── admin/             users · news (gated on `is_admin`)
│   └── …                  markets · news · watchlist · dashboard · pricing · sign-in
├── components/
│   ├── admin/             users table · news editor
│   ├── analysis/          trend verdict · indicators · scenarios
│   ├── charts/            price chart · sparkline · token→SVG colour bridge
│   ├── chat/              floating assistant
│   ├── dashboard/         briefing · journal · notes · insights
│   ├── landing/           hero · world map · sections
│   ├── markets/           card · grid · ticker
│   ├── news/              card · feed
│   ├── search/            ⌘K command palette
│   └── ui/                shadcn/ui primitives
└── lib/
    ├── ai/                analysis · narrate · chat · briefing
    ├── market/            types · catalog · simulation · provider · indicators
    ├── news/              types · provider (sample + Supabase, with fallback)
    ├── supabase/          browser · server · public · config
    └── workspace/         store · backends · types
```

---

## Built for extension

Each roadmap module plugs into an existing seam rather than requiring a rewrite:

| Module | Seam |
| --- | --- |
| Live market data | `MarketDataProvider` |
| Real newswire | `NewsProvider` |
| Portfolio tracker | `WorkspaceState` + backend |
| Economic calendar | New provider, rendered by the existing analysis page |
| Broker integrations | New route group; the data layer is already abstracted |
| Public API | The `/api` routes are already the internal contract |

---

## Deploying

Deploys to Vercel with no configuration. Add the environment variables you want
in the project settings; the build works with none of them. The Supabase session
refresh runs in `src/middleware.ts`.

---

## Known issues

### Dependency advisories — no upstream fix available

`npm audit` reports 12 high-severity advisories. **Do not run
`npm audit fix --force`**: npm's suggested "fix" for the Next.js entries is
`next@9.3.3`, a destructive downgrade that would break the entire app.

| Advisory | Reality |
| --- | --- |
| `postcss`, `sharp` (via `next`) | The advisory range covers **every** published Next.js release, including 16.x. There is no version to upgrade to. |
| `minimatch` / `brace-expansion` (via `eslint`) | Dev tooling only — never runs in production. The fix requires ESLint 10, which `eslint-config-next@15` does not support. |

Both are worth re-checking when Next.js ships a release outside the advisory
range.

### Bugs the smoke suite caught

All fixed; listed because each is a trap worth knowing about in this codebase.

1. **Unknown symbols returned HTTP 200.** A `loading.tsx` at the app root puts a
   Suspense boundary above *every* route. With dynamic rendering, Next flushes a
   200 shell before the page component runs, so a later `notFound()` could swap
   the body but not the status — `/analysis/NOPE` served the not-found page while
   telling crawlers it existed. The boundary is now scoped to routes without
   dynamic params; `/analysis` uses an in-page `<Suspense>` instead, because a
   segment-level file would also wrap `[symbol]`.
2. **Support levels above the current price.** Levels were classified against the
   series' last *candle close* while the page displays the live *quote*. Those
   diverge whenever price has moved since the bar closed, which put "support"
   above price on 4 of 16 markets. `findLevels` now takes the reference price
   explicitly, and classifies by position rather than by pivot origin — which is
   also the correct model, since a broken support becomes resistance.
3. **A self-contradicting summary.** The sentence quoted "X of 5 indicators
   agree" next to a confidence derived from the 6 weighted trend signals — two
   different sets, producing lines like *"2 of 5 indicators pointing the same way
   — a confidence reading of 88 out of 100"*. It now counts the contributions the
   confidence actually came from, and a test asserts the two agree.

---

## Disclaimer

DollarAndGold is a research and education platform. Nothing it produces is
financial advice or a recommendation to buy or sell any instrument. Analysis is
derived from historical price data and can be wrong; markets reprice on news
faster than any indicator updates. Trading carries risk, including the total
loss of your capital.

Market data provenance is stated in the interface for every figure. Markets
without a configured live source are **simulated** and labelled as such; they
do not represent real quotes. Headlines are an editorial sample set
demonstrating the summary format, not a live newswire.
