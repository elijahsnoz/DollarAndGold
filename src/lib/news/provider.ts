import { HOUR, seedFromString } from "@/lib/market/simulation";
import { getSupabasePublicClient } from "@/lib/supabase/public";
import type {
  ImpactDirection,
  ImpactMagnitude,
  NewsArticle,
  NewsCategory,
  NewsProvider,
} from "./types";

/**
 * Editorial sample feed.
 *
 * The MVP has no newswire licence, so the feed is a fixed editorial set written
 * to look like the real thing: every story already carries the three AI fields
 * the product promises (30-second summary, why it matters, likely impact).
 * Publish times are offset from "now" so the feed always reads as current, and
 * the UI labels the source as sample data rather than implying a live wire.
 *
 * Swapping in a real feed means implementing `NewsProvider` against a wire API
 * and running each article through `summariseArticle` in `lib/ai/news.ts`.
 */

type Seed = Omit<NewsArticle, "id" | "publishedAt"> & { hoursAgo: number };

const SEEDS: Seed[] = [
  {
    headline: "Fed holds rates steady but trims 2026 cut projections to two",
    source: "Market Wire",
    category: "economy",
    symbols: ["SPX", "NDX", "XAUUSD", "EURUSD", "USDJPY", "DXY"],
    hoursAgo: 2,
    summary:
      "The Federal Reserve left its policy rate unchanged and the updated dot plot now shows two cuts this year instead of three. The statement kept the language on inflation being 'somewhat elevated' and the Chair pushed back on questions about an earlier start to easing.",
    whyItMatters:
      "Fewer expected cuts means the front end of the curve stays higher for longer, which supports the dollar and raises the opportunity cost of holding assets that pay no yield.",
    impact: {
      direction: "bearish",
      magnitude: "high",
      note: "Higher-for-longer rates typically lift the dollar and weigh on gold and long-duration equities.",
    },
  },
  {
    headline: "Gold pushes to fresh record as central bank buying accelerates",
    source: "Metals Desk",
    category: "commodities",
    symbols: ["XAUUSD", "XAGUSD"],
    hoursAgo: 4,
    summary:
      "Official-sector demand ran above trend for a fourth straight quarter, with emerging-market central banks the dominant buyers. Spot gold cleared its previous high in thin Asian trade before consolidating.",
    whyItMatters:
      "Central bank buying is price-insensitive and slow to reverse, so it acts as a structural floor underneath the market rather than a short-term flow.",
    impact: {
      direction: "bullish",
      magnitude: "moderate",
      note: "Persistent official demand absorbs supply and tends to shallow out corrections.",
    },
  },
  {
    headline: "Bitcoin ETFs log largest weekly inflow since launch",
    source: "Digital Assets Daily",
    category: "crypto",
    symbols: ["BTCUSD", "ETHUSD", "SOLUSD"],
    hoursAgo: 3,
    summary:
      "Spot Bitcoin ETFs took in net new money across every session last week, led by two of the largest issuers. Ether products saw smaller but positive flows for the third week running.",
    whyItMatters:
      "ETF flows are the clearest read on institutional allocation. Sustained inflows shrink the free float available to sellers and have led price on a multi-week lag.",
    impact: {
      direction: "bullish",
      magnitude: "high",
      note: "Consistent primary-market creation tightens available supply into any rally.",
    },
  },
  {
    headline: "Dollar slips as eurozone PMIs beat expectations",
    source: "FX Report",
    category: "forex",
    symbols: ["EURUSD", "GBPUSD", "DXY"],
    hoursAgo: 6,
    summary:
      "Composite PMI for the bloc came in above consensus, with the services component driving the beat and manufacturing stabilising just under the expansion line. The euro rallied through the session high on the release.",
    whyItMatters:
      "The euro has been trading on relative growth rather than absolute levels. A narrowing growth gap with the US reduces one of the main structural arguments for dollar strength.",
    impact: {
      direction: "bullish",
      magnitude: "moderate",
      note: "Better eurozone data narrows rate-differential expectations in the euro's favour.",
    },
  },
  {
    headline: "OPEC+ signals it will unwind voluntary cuts more slowly",
    source: "Energy Intel",
    category: "commodities",
    symbols: ["WTIUSD"],
    hoursAgo: 8,
    summary:
      "Delegates indicated the group will phase supply back into the market at a slower pace than the schedule published earlier this year, citing softer demand indicators from Asia.",
    whyItMatters:
      "The pace of the unwind, not the headline quota, is what actually sets the balance for the next two quarters. A slower return of barrels tightens the second-half picture.",
    impact: {
      direction: "bullish",
      magnitude: "moderate",
      note: "Less supply returning near-term supports the front of the crude curve.",
    },
  },
  {
    headline: "Megacap earnings lift index futures as AI capex guidance raised",
    source: "Equities Wire",
    category: "stocks",
    symbols: ["NDX", "SPX", "NVDA", "AAPL"],
    hoursAgo: 5,
    summary:
      "Two of the largest cloud providers raised full-year capital expenditure guidance and pointed to capacity constraints rather than demand as the limiting factor. Semiconductor names traded higher in sympathy.",
    whyItMatters:
      "Index performance remains concentrated in a handful of names, so their capex plans move the whole benchmark and set the revenue outlook for the AI hardware chain.",
    impact: {
      direction: "bullish",
      magnitude: "high",
      note: "Raised capex flows straight through to the earnings estimates of the index's heaviest weights.",
    },
  },
  {
    headline: "Yen weakens past intervention watch level, officials issue warning",
    source: "Asia Markets",
    category: "forex",
    symbols: ["USDJPY"],
    hoursAgo: 9,
    summary:
      "The currency slid to a level that has previously drawn official action, prompting the finance ministry to repeat that it is watching moves with a 'high sense of urgency' and will not rule out steps against excessive volatility.",
    whyItMatters:
      "Verbal warnings usually precede actual intervention by days to weeks. Positioning is heavily one-sided, which makes any action sharp and disorderly when it lands.",
    impact: {
      direction: "mixed",
      magnitude: "high",
      note: "Trend is higher, but intervention risk creates the potential for a violent two-figure reversal.",
    },
  },
  {
    headline: "US core CPI cools to slowest annual pace in three years",
    source: "Macro Brief",
    category: "economy",
    symbols: ["SPX", "NDX", "XAUUSD", "EURUSD", "DXY"],
    hoursAgo: 26,
    summary:
      "Core inflation excluding food and energy rose less than forecast on the month, with shelter finally decelerating and core services ex-housing flat. Headline was in line.",
    whyItMatters:
      "Shelter has been the main thing keeping core inflation sticky. Its rollover is the piece the central bank said it needed before it could ease with confidence.",
    impact: {
      direction: "bullish",
      magnitude: "high",
      note: "Softer core inflation pulls forward expected cuts, which typically weakens the dollar and supports risk assets.",
    },
  },
  {
    headline: "Ethereum layer-2 activity hits record as fees compress further",
    source: "Digital Assets Daily",
    category: "crypto",
    symbols: ["ETHUSD"],
    hoursAgo: 12,
    summary:
      "Aggregate transactions across major rollups set a new high while median fees fell again following the latest data-availability upgrade. Mainnet settlement revenue rose despite lower per-transaction costs.",
    whyItMatters:
      "The bear case on Ether has been that rollups capture the value while the base layer earns less. Rising settlement revenue alongside falling fees undercuts that argument.",
    impact: {
      direction: "bullish",
      magnitude: "moderate",
      note: "Improving fundamentals support the relative case for Ether against other large caps.",
    },
  },
  {
    headline: "Bank of England splits three ways on the policy path",
    source: "FX Report",
    category: "forex",
    symbols: ["GBPUSD"],
    hoursAgo: 14,
    summary:
      "The rate decision passed with an unusually fragmented vote, including one dissent for a cut and one for a hold with hawkish guidance. Sterling round-tripped the move within the hour.",
    whyItMatters:
      "A split committee makes the next decision genuinely data-dependent, which raises the market's sensitivity to every UK inflation and wage print between now and then.",
    impact: {
      direction: "mixed",
      magnitude: "moderate",
      note: "Higher event risk around UK data releases, with two-way volatility rather than a clear direction.",
    },
  },
  {
    headline: "Crude inventories build more than expected for second week",
    source: "Energy Intel",
    category: "commodities",
    symbols: ["WTIUSD"],
    hoursAgo: 20,
    summary:
      "Commercial crude stocks rose well above the consensus draw, while gasoline inventories also built ahead of the seasonal demand peak. Refinery utilisation ticked lower.",
    whyItMatters:
      "Two consecutive builds against expectations suggests demand is softer than the supply-side narrative implies, which challenges the bullish case being priced into the curve.",
    impact: {
      direction: "bearish",
      magnitude: "moderate",
      note: "Rising inventories argue for a looser balance than the market has positioned for.",
    },
  },
  {
    headline: "China stimulus package larger than expected, targets property",
    source: "Asia Markets",
    category: "economy",
    symbols: ["WTIUSD", "AUDUSD", "SPX", "XAGUSD"],
    hoursAgo: 30,
    summary:
      "Authorities announced a fiscal package above the size flagged in state media, with a meaningful share directed at completing stalled residential projects and recapitalising local government financing vehicles.",
    whyItMatters:
      "Chinese property is the largest single swing factor for industrial commodity demand. Support aimed at completions matters more for raw material consumption than demand-side measures.",
    impact: {
      direction: "bullish",
      magnitude: "high",
      note: "Commodity-linked currencies and industrial metals are the most direct beneficiaries.",
    },
  },
  {
    headline: "Semiconductor export restrictions widened to more chip tiers",
    source: "Equities Wire",
    category: "stocks",
    symbols: ["NVDA", "NDX", "SPX"],
    hoursAgo: 34,
    summary:
      "New rules extend licensing requirements to additional accelerator performance tiers and add several entities to the restricted list. Affected vendors said the revenue impact is already largely reflected in guidance.",
    whyItMatters:
      "Each widening removes a slice of addressable market, but the more important effect is the uncertainty premium it puts on forward orders from every affected region.",
    impact: {
      direction: "bearish",
      magnitude: "moderate",
      note: "Caps the addressable market and adds a discount to forward revenue visibility.",
    },
  },
  {
    headline: "Gold-silver ratio compresses to two-year low",
    source: "Metals Desk",
    category: "commodities",
    symbols: ["XAGUSD", "XAUUSD"],
    hoursAgo: 40,
    summary:
      "Silver outperformed gold for a fifth consecutive week, driven by industrial demand from solar manufacturing alongside the same monetary bid supporting the wider complex.",
    whyItMatters:
      "The ratio compressing usually marks the later, higher-beta phase of a precious metals move, when industrial and speculative demand join the defensive bid.",
    impact: {
      direction: "bullish",
      magnitude: "low",
      note: "Signals broadening participation across the complex rather than a purely defensive bid.",
    },
  },
  {
    headline: "Treasury yields climb after soft long-bond auction",
    source: "Macro Brief",
    category: "economy",
    symbols: ["SPX", "NDX", "XAUUSD", "USDJPY", "DXY"],
    hoursAgo: 46,
    summary:
      "A 30-year auction tailed against the when-issued level with weak indirect participation, pushing yields higher across the curve into the close.",
    whyItMatters:
      "Auction demand is the cleanest available signal on the market's appetite to fund large deficits. Repeated tails would put a term premium back into long rates.",
    impact: {
      direction: "bearish",
      magnitude: "moderate",
      note: "Higher long yields pressure equity valuations and lift the dollar against low-yielders.",
    },
  },
  {
    headline: "Bitcoin network hashrate reaches all-time high",
    source: "Digital Assets Daily",
    category: "crypto",
    symbols: ["BTCUSD"],
    hoursAgo: 52,
    summary:
      "Mining capacity set a new record following the latest difficulty adjustment, with newer-generation machines making up an increasing share of the network.",
    whyItMatters:
      "Rising hashrate reflects miner confidence in forward profitability and increases the network's security budget, though it also raises the price level miners need to stay cash-flow positive.",
    impact: {
      direction: "mixed",
      magnitude: "low",
      note: "Structurally healthy, but higher production costs can add sell pressure if price stalls.",
    },
  },
  {
    headline: "Eurozone inflation undershoots as energy base effects fade",
    source: "Macro Brief",
    category: "economy",
    symbols: ["EURUSD"],
    hoursAgo: 58,
    summary:
      "Flash HICP came in below forecast on both the headline and core measures, with services inflation decelerating for the first time in four months.",
    whyItMatters:
      "Services inflation has been the central bank's stated obstacle to further easing. A genuine turn there changes the near-term policy calculus.",
    impact: {
      direction: "bearish",
      magnitude: "moderate",
      note: "Faster expected easing narrows rate support for the single currency.",
    },
  },
  {
    headline: "Index rebalance to shift meaningful weight toward technology",
    source: "Equities Wire",
    category: "stocks",
    symbols: ["SPX", "NDX", "AAPL", "NVDA", "TSLA"],
    hoursAgo: 66,
    summary:
      "The scheduled quarterly rebalance is expected to move index weight toward the technology sector, with passive funds needing to trade a large notional at the close on the effective date.",
    whyItMatters:
      "Rebalance flows are mechanical and predictable, which produces outsized volume and short-lived dislocations around the effective date rather than a lasting directional signal.",
    impact: {
      direction: "mixed",
      magnitude: "low",
      note: "Expect a volume and volatility spike into the close, with limited follow-through afterwards.",
    },
  },
];

export class SampleNewsProvider implements NewsProvider {
  readonly id = "sample";

  async getArticles(options?: {
    category?: NewsCategory;
    symbol?: string;
    limit?: number;
  }): Promise<NewsArticle[]> {
    const { category, symbol, limit } = options ?? {};

    // Bucket to the hour so publish times stay stable within a render pass.
    const now = Math.floor(Date.now() / HOUR) * HOUR;

    let articles: NewsArticle[] = SEEDS.map((seed) => {
      const { hoursAgo, ...rest } = seed;
      return {
        ...rest,
        id: `n-${seedFromString(seed.headline).toString(36)}`,
        publishedAt: now - hoursAgo * HOUR,
      };
    });

    if (category) articles = articles.filter((a) => a.category === category);
    if (symbol) {
      const s = symbol.toUpperCase();
      articles = articles.filter((a) => a.symbols.includes(s));
    }

    articles.sort((a, b) => b.publishedAt - a.publishedAt);
    return limit ? articles.slice(0, limit) : articles;
  }
}

interface NewsArticleRow {
  id: string;
  headline: string;
  source: string;
  category: NewsCategory;
  symbols: string[];
  summary: string;
  why_it_matters: string;
  impact_direction: ImpactDirection;
  impact_magnitude: ImpactMagnitude;
  impact_note: string;
  url: string | null;
  published_at: string;
}

function rowToArticle(row: NewsArticleRow): NewsArticle {
  return {
    id: row.id,
    headline: row.headline,
    source: row.source,
    publishedAt: new Date(row.published_at).getTime(),
    category: row.category,
    symbols: row.symbols,
    summary: row.summary,
    whyItMatters: row.why_it_matters,
    impact: {
      direction: row.impact_direction,
      magnitude: row.impact_magnitude,
      note: row.impact_note,
    },
    url: row.url ?? undefined,
  };
}

/**
 * Admin-authored articles, published through `/admin/news`.
 *
 * Reads with the anon client: RLS already restricts this to `published =
 * true` rows for an unauthenticated request, so no session is needed.
 */
export class SupabaseNewsProvider implements NewsProvider {
  readonly id = "supabase";

  async getArticles(options?: {
    category?: NewsCategory;
    symbol?: string;
    limit?: number;
  }): Promise<NewsArticle[]> {
    const client = getSupabasePublicClient();
    if (!client) return [];

    let query = client
      .from("news_articles")
      .select(
        "id, headline, source, category, symbols, summary, why_it_matters, impact_direction, impact_magnitude, impact_note, url, published_at",
      )
      .eq("published", true)
      .order("published_at", { ascending: false });

    const { category, symbol, limit } = options ?? {};
    if (category) query = query.eq("category", category);
    if (symbol) query = query.contains("symbols", [symbol.toUpperCase()]);
    if (limit) query = query.limit(limit);

    const { data, error } = await query;
    if (error) throw error;

    return (data as NewsArticleRow[]).map(rowToArticle);
  }
}

/**
 * Tries each source in order and keeps the first non-empty result — the same
 * per-request fallback shape `providers/composite.ts` uses for market data.
 * An admin who has published nothing yet for a given category should still
 * see the sample feed for it, not an empty page.
 */
class CompositeNewsProvider implements NewsProvider {
  readonly id = "composite";

  constructor(private readonly sources: NewsProvider[]) {}

  async getArticles(options?: {
    category?: NewsCategory;
    symbol?: string;
    limit?: number;
  }): Promise<NewsArticle[]> {
    for (const source of this.sources) {
      try {
        const articles = await source.getArticles(options);
        if (articles.length > 0) return articles;
      } catch {
        // Benched for this call — fall through to the next source.
      }
    }
    return [];
  }
}

let cached: NewsProvider | null = null;

export function getNewsProvider(): NewsProvider {
  if (!cached) {
    cached = new CompositeNewsProvider([
      new SupabaseNewsProvider(),
      new SampleNewsProvider(),
    ]);
  }
  return cached;
}
