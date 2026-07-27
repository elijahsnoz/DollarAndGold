import type { TrendDirection } from "@/lib/market/types";

/** Everything a signed-in user accumulates. Persisted locally, synced remotely. */

export interface WatchlistItem {
  symbol: string;
  pinned: boolean;
  addedAt: number;
  /** Alert when price rises above this level. */
  alertAbove?: number;
  /** Alert when price falls below this level. */
  alertBelow?: number;
}

export interface Note {
  id: string;
  /** Optional market this note is attached to. */
  symbol?: string;
  title: string;
  body: string;
  updatedAt: number;
}

export type TradeDirection = "long" | "short";
export type TradeOutcome = "open" | "win" | "loss" | "breakeven";

export interface JournalEntry {
  id: string;
  symbol: string;
  direction: TradeDirection;
  entryPrice: number;
  exitPrice?: number;
  /** Position size in units of the base asset. Optional — many users omit it. */
  size?: number;
  thesis: string;
  outcome: TradeOutcome;
  openedAt: number;
  closedAt?: number;
}

export interface RecentAnalysis {
  symbol: string;
  assetName: string;
  trend: TrendDirection;
  confidence: number;
  viewedAt: number;
}

/**
 * One research event, appended every time a market is studied.
 *
 * Distinct from `recentAnalyses`, which is deduplicated by symbol and capped at
 * ten — perfect for "pick up where you left off", useless for "which markets
 * does this person actually follow". Personalisation needs the *frequency* and
 * *recency* of attention, which a deduplicated list throws away by design.
 */
export interface ResearchEvent {
  symbol: string;
  at: number;
  trend: TrendDirection;
  confidence: number;
}

export interface WorkspaceState {
  watchlist: WatchlistItem[];
  notes: Note[];
  journal: JournalEntry[];
  recentAnalyses: RecentAnalysis[];
  /** Append-only attention log. Bounded in the store, not here. */
  researchLog: ResearchEvent[];
  /**
   * State for the daily ritual. Deliberately just two fields — enough to greet
   * someone properly and keep the briefing stable for a day, with nothing that
   * could be turned into a streak counter.
   */
  ritual: {
    lastOpenedAt?: number;
    /** Local day key of the last briefing the user actually saw. */
    lastBriefingDay?: string;
  };
}

export const EMPTY_WORKSPACE: WorkspaceState = {
  watchlist: [],
  notes: [],
  journal: [],
  recentAnalyses: [],
  researchLog: [],
  ritual: {},
};

/** How many research events to retain. Roughly a year of daily use. */
export const RESEARCH_LOG_LIMIT = 750;

/**
 * Storage adapter. Two implementations exist: localStorage for demo mode and
 * Supabase for signed-in users. The store never knows which one it has.
 */
export interface WorkspaceBackend {
  readonly id: "local" | "supabase";
  load(): Promise<WorkspaceState>;
  save(state: WorkspaceState): Promise<void>;
}
