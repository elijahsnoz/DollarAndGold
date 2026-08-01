/**
 * End-to-end smoke test.
 *
 * Runs against a server started by `npm run build && npm start`. It checks the
 * invariants the product actually depends on — not that functions were called,
 * but that the numbers on screen are internally consistent and that the
 * compliance language is present.
 *
 *   npm run test              # expects a server on http://localhost:3000
 *   BASE_URL=… npm run test   # or point it somewhere else
 *
 * No test framework, by design: the whole suite is HTTP + assertions, and
 * adding a runner would be more dependency than value at this size.
 */

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

let passed = 0;
const failures = [];

function check(name, condition, detail = "") {
  if (condition) {
    passed++;
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function get(path) {
  const response = await fetch(`${BASE}${path}`);
  return { status: response.status, response };
}

async function getJson(path) {
  const response = await fetch(`${BASE}${path}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return response.json();
}

function section(title) {
  console.log(`\n\x1b[1m${title}\x1b[0m`);
}

// ---------------------------------------------------------------------------

async function testRoutes() {
  section("Routes respond");

  const paths = [
    "/",
    "/markets",
    "/analysis",
    "/analysis/XAUUSD",
    "/analysis/BTCUSD",
    "/desk",
    "/news",
    "/watchlist",
    "/dashboard",
    "/pricing",
    "/sign-in",
    "/sitemap.xml",
    "/robots.txt",
  ];

  for (const path of paths) {
    const { status } = await get(path);
    check(`GET ${path}`, status === 200, `got ${status}`);
  }

  const { status: missing } = await get("/analysis/NOTAREALSYMBOL");
  check("GET /analysis/<unknown> is 404", missing === 404, `got ${missing}`);
}

async function testQuotes() {
  section("Quote invariants");

  const { quotes } = await getJson("/api/markets");
  check("nine featured markets", quotes.length === 9, `got ${quotes.length}`);

  for (const q of quotes) {
    check(
      `${q.symbol} price is a positive finite number`,
      Number.isFinite(q.price) && q.price > 0,
      String(q.price),
    );
    check(
      `${q.symbol} price sits inside the 24h range`,
      q.price >= q.low24h && q.price <= q.high24h,
      `${q.low24h} <= ${q.price} <= ${q.high24h}`,
    );
    check(
      `${q.symbol} 24h high >= low`,
      q.high24h >= q.low24h,
      `${q.high24h} < ${q.low24h}`,
    );
    check(
      `${q.symbol} changePercent agrees with change`,
      Math.sign(q.change) === Math.sign(q.changePercent) || q.change === 0,
      `change ${q.change}, pct ${q.changePercent}`,
    );
  }
}

async function testSeries() {
  section("Candle series integrity");

  for (const timeframe of ["1D", "1M", "1Y"]) {
    const { series } = await getJson(
      `/api/markets/XAUUSD/series?timeframe=${timeframe}`,
    );
    const candles = series.candles;

    check(`${timeframe} returns candles`, candles.length > 20, `${candles.length}`);

    let ohlcOk = true;
    let orderOk = true;
    let volumeOk = true;
    let spacingOk = true;
    const expectedStep = candles.length > 1 ? candles[1].t - candles[0].t : 0;

    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];
      if (c.h < Math.max(c.o, c.c) || c.l > Math.min(c.o, c.c) || c.h < c.l) {
        ohlcOk = false;
      }
      if (!(c.v >= 0) || !Number.isFinite(c.v)) volumeOk = false;
      if (i > 0) {
        if (c.t <= candles[i - 1].t) orderOk = false;
        if (c.t - candles[i - 1].t !== expectedStep) spacingOk = false;
      }
    }

    check(`${timeframe} high/low bound open/close`, ohlcOk);
    check(`${timeframe} timestamps strictly increasing`, orderOk);
    check(`${timeframe} bar spacing is uniform`, spacingOk);
    check(`${timeframe} volume is non-negative`, volumeOk);
  }
}

async function testDeterminism() {
  section("Determinism");

  // The core claim of the simulation: price is a pure function of
  // (symbol, timestamp). Two reads inside the same bar must be byte-identical,
  // or the server and the client would disagree and hydration would break.
  const a = await getJson("/api/markets/BTCUSD/series?timeframe=1M");
  const b = await getJson("/api/markets/BTCUSD/series?timeframe=1M");

  check(
    "repeated series reads are identical",
    JSON.stringify(a.series.candles) === JSON.stringify(b.series.candles),
  );

  // Overlapping timeframes must agree about the same instant.
  const short = await getJson("/api/markets/BTCUSD/series?timeframe=1M");
  const long = await getJson("/api/markets/BTCUSD/series?timeframe=3M");
  const shortByT = new Map(short.series.candles.map((c) => [c.t, c]));

  // Overlapping timeframes must agree about the same instant — but how exactly
  // depends on the source. The simulation is a pure function of time, so it
  // must match to the bit. A live source is queried over two different windows
  // (30 days vs 90) and may return different granularity for each, so the same
  // day's close can differ marginally. Requiring bit-equality there would be
  // testing the vendor's pagination, not our correctness; a tight tolerance
  // still catches a genuine scale or alignment bug.
  const live = short.series.source && short.series.source !== "simulated";
  const tolerance = live ? 0.005 : 1e-9; // 0.5% for live, exact for simulated

  let overlapChecked = 0;
  let worstDrift = 0;
  for (const candle of long.series.candles) {
    const match = shortByT.get(candle.t);
    if (!match) continue;
    overlapChecked++;
    const drift =
      candle.c === 0 ? 0 : Math.abs(match.c - candle.c) / Math.abs(candle.c);
    worstDrift = Math.max(worstDrift, drift);
  }

  check(
    `overlapping timeframes agree (${short.series.source ?? "unknown"})`,
    worstDrift <= tolerance && overlapChecked > 5,
    `${overlapChecked} shared bars, worst drift ${(worstDrift * 100).toFixed(4)}%`,
  );
}

async function testAnalysis() {
  section("Analysis invariants (all markets)");

  const symbols = [
    "XAUUSD", "BTCUSD", "ETHUSD", "EURUSD", "GBPUSD", "USDJPY",
    "NDX", "SPX", "WTIUSD", "XAGUSD", "SOLUSD", "DXY",
    "AUDUSD", "AAPL", "NVDA", "TSLA",
    "BNBUSD", "XRPUSD", "TRXUSD", "DOGEUSD", "ZECUSD", "XMRUSD",
    "ADAUSD", "LINKUSD", "XLMUSD", "BCHUSD", "LTCUSD", "HBARUSD",
    "SHIBUSD", "SUIUSD", "AVAXUSD", "UNIUSD", "NEARUSD", "TAOUSD",
    "AAVEUSD", "DOTUSD",
    "USDCAD", "USDCHF", "NZDUSD", "EURGBP", "EURJPY", "GBPJPY",
    "EURCHF", "EURAUD", "EURCAD", "EURNZD", "GBPAUD", "GBPCAD",
    "GBPCHF", "GBPNZD", "AUDJPY", "AUDCAD", "AUDCHF", "AUDNZD",
    "CADJPY", "CHFJPY", "NZDJPY", "USDSEK", "USDNOK", "USDZAR",
    "USDMXN", "USDSGD", "USDHKD", "USDCNY",
  ];

  for (const symbol of symbols) {
    const { analysis } = await getJson(
      `/api/analysis/${symbol}?narrate=false`,
    );

    check(
      `${symbol} trend direction is valid`,
      ["bullish", "bearish", "neutral"].includes(analysis.trend.direction),
      analysis.trend.direction,
    );

    // Confidence must never imply certainty, and never imply hopelessness.
    check(
      `${symbol} confidence within [30, 88]`,
      analysis.trend.confidence >= 30 && analysis.trend.confidence <= 88,
      String(analysis.trend.confidence),
    );

    check(
      `${symbol} supports all below price`,
      analysis.supports.every((s) => s < analysis.price),
      `price ${analysis.price}, supports ${analysis.supports.join(",")}`,
    );
    check(
      `${symbol} resistances all above price`,
      analysis.resistances.every((r) => r > analysis.price),
      `price ${analysis.price}, resistances ${analysis.resistances.join(",")}`,
    );

    check(
      `${symbol} has five indicators`,
      analysis.indicators.length === 5,
      String(analysis.indicators.length),
    );

    const rsi = analysis.indicators.find((i) => i.key === "rsi");
    const rsiValue = Number(rsi?.value);
    check(
      `${symbol} RSI within [0, 100]`,
      Number.isFinite(rsiValue) && rsiValue >= 0 && rsiValue <= 100,
      String(rsi?.value),
    );

    check(
      `${symbol} volatility is positive`,
      analysis.volatility.annualisedPct > 0 && analysis.volatility.atr > 0,
      `${analysis.volatility.annualisedPct}% / ATR ${analysis.volatility.atr}`,
    );

    // The summary quotes an "X of Y signals agree" fraction. Y must be the
    // trend contributions it came from, not the display indicators — quoting
    // one next to a confidence derived from the other contradicts itself.
    const claimed = /(\d+) of (\d+) signals/.exec(analysis.summary ?? "");
    const agreeing = analysis.trend.contributions.filter(
      (c) => c.signal === analysis.trend.direction,
    ).length;
    check(
      `${symbol} summary's signal count matches the trend contributions`,
      Boolean(claimed) &&
        Number(claimed[1]) === agreeing &&
        Number(claimed[2]) === analysis.trend.contributions.length,
      claimed
        ? `summary says ${claimed[1]}/${claimed[2]}, actual ${agreeing}/${analysis.trend.contributions.length}`
        : "no fraction found in summary",
    );

    check(`${symbol} states its risks`, analysis.risks.length > 0);
    check(`${symbol} lists events to watch`, analysis.eventsToWatch.length > 0);
    check(`${symbol} has a summary`, (analysis.summary ?? "").length > 100);
    check(
      `${symbol} gives both scenarios`,
      Boolean(analysis.bullCase?.trigger) && Boolean(analysis.bearCase?.trigger),
    );
  }
}

async function testCompliance() {
  section("Compliance");

  // The disclaimer is a product requirement, not a nicety. If a refactor ever
  // drops it from the analysis page, this test is what catches it.
  const { response } = await get("/analysis/XAUUSD");
  const html = await response.text();

  check(
    "analysis page carries the required disclaimer",
    html.includes(
      "This analysis is educational and should not be considered financial advice",
    ),
  );
  // The page must state where its numbers came from — either a named live
  // source or an explicit simulation notice. Silence is the failure mode.
  check(
    "analysis page discloses the origin of its data",
    /simulated|live ·|coingecko|twelve data|yahoo finance|european central bank/i.test(
      html,
    ),
  );
  check(
    "confidence is explained as indicator agreement, not win probability",
    html.includes("not") && html.includes("probability that a trade"),
  );

  // No generated copy may promise an outcome.
  const banned = [
    "guaranteed profit",
    "will definitely",
    "risk-free",
    "you should buy",
    "you should sell",
    "sure thing",
  ];

  const { analysis } = await getJson("/api/analysis/XAUUSD?narrate=false");
  const prose = [
    analysis.summary,
    analysis.trend.headline,
    analysis.bullCase.narrative,
    analysis.bearCase.narrative,
    ...analysis.indicators.map((i) => i.interpretation),
    ...analysis.risks,
  ]
    .join(" ")
    .toLowerCase();

  for (const phrase of banned) {
    check(`prose avoids "${phrase}"`, !prose.includes(phrase));
  }
}

async function testProvenance() {
  section("Data provenance");

  const LIVE = ["coingecko", "frankfurter", "twelvedata", "yahoo"];
  const isLive = (s) => LIVE.includes(s);

  const { quotes } = await getJson("/api/markets");

  for (const q of quotes) {
    check(
      `${q.symbol} quote declares a source`,
      typeof q.source === "string" && q.source.length > 0,
      String(q.source),
    );
  }

  // Not an assertion that a specific vendor is up — just that the live path
  // works at all. If every market is simulated, the integration is broken.
  // Set EXPECT_LIVE_DATA=false when running against MARKET_DATA_MODE=simulated.
  const liveCount = quotes.filter((q) => isLive(q.source)).length;
  if (process.env.EXPECT_LIVE_DATA === "false") {
    console.log("  (skipping live-source check: EXPECT_LIVE_DATA=false)");
  } else {
    check(
      "at least one market resolves to a live source",
      liveCount > 0,
      `${liveCount}/${quotes.length} live — set EXPECT_LIVE_DATA=false if intentional`,
    );
  }

  // The bug this guards: an asset whose quote is live but whose chart silently
  // falls back to an unrelated simulated price scale. EUR/USD showed 1.1389
  // and 1.0839 for the same pair on two timeframes.
  for (const symbol of ["BTCUSD", "EURUSD", "XAUUSD"]) {
    const quote = quotes.find((q) => q.symbol === symbol);
    if (!quote) continue;

    for (const timeframe of ["1D", "3M"]) {
      const { series } = await getJson(
        `/api/markets/${symbol}/series?timeframe=${timeframe}`,
      );

      check(
        `${symbol} ${timeframe} series declares a source`,
        typeof series.source === "string" && series.source.length > 0,
        String(series.source),
      );

      if (!isLive(quote.source)) continue;

      // A live quote must never sit above a chart on a different price scale.
      check(
        `${symbol} ${timeframe} chart is not un-anchored simulation under a live quote`,
        series.source !== "simulated",
        `quote ${quote.source}, series ${series.source}`,
      );

      const lastClose = series.candles.at(-1)?.c ?? 0;
      const drift = Math.abs(lastClose - quote.price) / quote.price;
      check(
        `${symbol} ${timeframe} chart ends near the live price`,
        drift < 0.05,
        `close ${lastClose}, quote ${quote.price}, drift ${(drift * 100).toFixed(2)}%`,
      );
    }
  }
}

async function testSearchAndChat() {
  section("Search and assistant");

  const search = await getJson("/api/search?q=gold");
  check(
    "search finds gold",
    search.assets.some((a) => a.symbol === "XAUUSD"),
  );

  const empty = await getJson("/api/search?q=zzzzzzzz");
  check("nonsense query returns no assets", empty.assets.length === 0);

  const response = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [
        { id: "1", role: "user", content: "What is RSI?", createdAt: Date.now() },
      ],
    }),
  });
  const reply = await response.text();
  check("chat answers an indicator question", response.ok && reply.length > 120);
  check("chat explains RSI specifically", reply.toLowerCase().includes("relative strength"));

  const bad = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [] }),
  });
  check("chat rejects an empty conversation", bad.status === 400, `got ${bad.status}`);
}

// ---------------------------------------------------------------------------

async function main() {
  console.log(`Running smoke tests against ${BASE}`);

  try {
    await get("/");
  } catch {
    console.error(
      `\n\x1b[31mCannot reach ${BASE}.\x1b[0m Start the server first:\n  npm run build && npm start\n`,
    );
    process.exit(1);
  }

  await testRoutes();
  await testQuotes();
  await testSeries();
  await testDeterminism();
  // Provenance runs BEFORE the sixteen-symbol analysis sweep, deliberately.
  // That sweep issues enough distinct upstream requests to exhaust a free-tier
  // minute quota, at which point the composite (correctly) benches the live
  // sources and everything reports as simulated — so running provenance after
  // it measured the test suite's own rate limiting rather than the product.
  await testProvenance();
  await testAnalysis();
  await testCompliance();
  await testSearchAndChat();

  console.log(`\n${"-".repeat(52)}`);
  if (failures.length === 0) {
    console.log(`\x1b[32m✓ ${passed} checks passed\x1b[0m`);
    process.exit(0);
  }

  console.log(`\x1b[31m✗ ${failures.length} failed\x1b[0m (${passed} passed)\n`);
  for (const failure of failures) console.log(`  · ${failure}`);
  process.exit(1);
}

main().catch((error) => {
  console.error("\nSmoke test crashed:", error);
  process.exit(1);
});
