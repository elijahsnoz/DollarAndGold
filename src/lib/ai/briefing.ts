import { formatSignedPercent } from "@/lib/format";
import { FEATURED_SYMBOLS, requireAsset } from "@/lib/market/catalog";
import { getMarketDataProvider } from "@/lib/market/provider";
import { getNewsProvider } from "@/lib/news/provider";
import type { NewsArticle } from "@/lib/news/types";

export interface BriefingMover {
  symbol: string;
  name: string;
  changePercent: number;
}

export interface DailyBriefing {
  generatedAt: number;
  headline: string;
  paragraphs: string[];
  gainers: BriefingMover[];
  losers: BriefingMover[];
  topStory: NewsArticle | null;
}

/**
 * The daily briefing on the dashboard.
 *
 * Built from the same quote and news providers as everything else — no model
 * call — so it is instant, free, and identical for every user on a given day.
 * It answers one question: what should I know before I look at anything else?
 */
export async function buildDailyBriefing(): Promise<DailyBriefing> {
  const provider = getMarketDataProvider();
  const [quotes, articles] = await Promise.all([
    provider.getQuotes([...FEATURED_SYMBOLS]),
    getNewsProvider().getArticles({ limit: 1 }),
  ]);

  const movers: BriefingMover[] = quotes.map((quote) => ({
    symbol: quote.symbol,
    name: requireAsset(quote.symbol).name,
    changePercent: quote.changePercent,
  }));

  const ranked = [...movers].sort((a, b) => b.changePercent - a.changePercent);
  const gainers = ranked.filter((m) => m.changePercent > 0).slice(0, 3);
  const losers = ranked
    .filter((m) => m.changePercent < 0)
    .slice(-3)
    .reverse();

  const advancing = movers.filter((m) => m.changePercent > 0).length;
  const declining = movers.length - advancing;

  const breadth =
    advancing > declining * 2
      ? "broadly risk-on"
      : declining > advancing * 2
        ? "broadly risk-off"
        : "mixed, with no single theme dominating";

  const biggest = ranked[0];
  const weakest = ranked[ranked.length - 1];
  const topStory = articles[0] ?? null;

  const headline =
    advancing > declining
      ? `${advancing} of ${movers.length} markets higher — tone is ${breadth}`
      : `${declining} of ${movers.length} markets lower — tone is ${breadth}`;

  const paragraphs = [
    `Across the nine core markets, ${advancing} are up and ${declining} are down over the last 24 hours. The tone is ${breadth}.`,
    biggest && weakest
      ? `${biggest.name} leads at ${formatSignedPercent(biggest.changePercent)}, while ${weakest.name} lags at ${formatSignedPercent(weakest.changePercent)}. When the extremes sit this far apart, the move is being driven by something specific to those markets rather than by a single macro factor.`
      : "",
    topStory
      ? `The story most likely to matter today: “${topStory.headline}”. ${topStory.whyItMatters}`
      : "",
    `Nothing here is a recommendation. Open any market for the full analysis, including the levels that would confirm or invalidate the current read.`,
  ].filter(Boolean);

  return {
    generatedAt: Date.now(),
    headline,
    paragraphs,
    gainers,
    losers,
    topStory,
  };
}
