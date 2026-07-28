"use client";

import * as React from "react";
import type { User } from "@supabase/supabase-js";

import type { MarketConditions } from "@/lib/context/types";
import { timeline } from "@/lib/memory/derive";
import type { DatedMemory } from "@/lib/memory/types";
import { deriveProfile } from "@/lib/personalisation/profile";
import type { UserProfile } from "@/lib/personalisation/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { LocalBackend, SupabaseBackend } from "./backends";
import {
  EMPTY_WORKSPACE,
  RESEARCH_LOG_LIMIT,
  type JournalEntry,
  type Note,
  type RecentAnalysis,
  type WatchlistItem,
  type WorkspaceBackend,
  type WorkspaceState,
} from "./types";

/**
 * The single client-side store for auth + user data.
 *
 * It deliberately does not distinguish "demo" from "signed in" at the API
 * surface — components call `addToWatchlist` and it persists to whichever
 * backend is active. That is what lets every dashboard feature work before the
 * user has an account, and keep working after they create one.
 */

interface WorkspaceContextValue {
  user: User | null;
  /** True once the initial auth check and workspace load have finished. */
  ready: boolean;
  /** True when running without Supabase credentials. */
  demoMode: boolean;
  state: WorkspaceState;
  /**
   * What the system understands about this user, derived from `state`.
   * Recomputed rather than stored, so improvements to the derivation apply
   * retroactively to the whole history.
   */
  profile: UserProfile;
  /** The Market Memories archive, newest first. */
  memories: DatedMemory[];

  // --- Watchlist ---
  isWatched(symbol: string): boolean;
  toggleWatch(symbol: string): void;
  togglePin(symbol: string): void;
  removeFromWatchlist(symbol: string): void;
  setAlert(symbol: string, alert: { above?: number; below?: number }): void;

  // --- Notes ---
  saveNote(note: Omit<Note, "id" | "updatedAt"> & { id?: string }): void;
  deleteNote(id: string): void;

  // --- Journal ---
  saveTrade(
    entry: Omit<JournalEntry, "id" | "openedAt"> & { id?: string; openedAt?: number },
  ): void;
  deleteTrade(id: string): void;

  // --- Analyses ---
  /** `conditions` is the Market Context snapshot, when one is available. */
  recordAnalysis(analysis: RecentAnalysis, conditions?: MarketConditions): void;

  /** Records that today's briefing was seen. Drives the ritual greeting. */
  markBriefingSeen(day: string): void;

  signOut(): Promise<void>;
}

const WorkspaceContext = React.createContext<WorkspaceContextValue | null>(null);

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [state, setState] = React.useState<WorkspaceState>(EMPTY_WORKSPACE);
  const [ready, setReady] = React.useState(false);

  const demoMode = !isSupabaseConfigured();

  // The active backend follows the auth state: local until signed in, then
  // Supabase. Recreated (and reloaded) whenever the user changes.
  const backend = React.useMemo<WorkspaceBackend>(() => {
    const client = getSupabaseBrowserClient();
    if (client && user) return new SupabaseBackend(client, user.id);
    return new LocalBackend();
  }, [user]);

  // --- Auth ---
  React.useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) return;

    let active = true;
    client.auth.getUser().then(({ data }) => {
      if (active) setUser(data.user ?? null);
    });

    const { data: sub } = client.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // --- Load ---
  React.useEffect(() => {
    let active = true;
    setReady(false);

    backend.load().then((loaded) => {
      if (!active) return;
      setState(loaded);
      setReady(true);
    });

    return () => {
      active = false;
    };
  }, [backend]);

  // --- Persist ---
  // Debounced so a burst of edits (typing a note) becomes one write.
  React.useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => void backend.save(state), 400);
    return () => clearTimeout(timer);
  }, [state, ready, backend]);

  const update = React.useCallback(
    (fn: (prev: WorkspaceState) => WorkspaceState) => setState(fn),
    [],
  );

  // Derived separately so editing a note doesn't recompute the whole archive
  // on every keystroke — these only change when the underlying records do.
  const profile = React.useMemo(() => deriveProfile(state), [state]);
  const memories = React.useMemo(() => timeline(state), [state]);

  const value = React.useMemo<WorkspaceContextValue>(() => {
    const watchedSymbols = new Set(state.watchlist.map((w) => w.symbol));

    return {
      user,
      ready,
      demoMode,
      state,
      profile,
      memories,

      isWatched: (symbol) => watchedSymbols.has(symbol.toUpperCase()),

      toggleWatch: (symbol) =>
        update((prev) => {
          const s = symbol.toUpperCase();
          const exists = prev.watchlist.some((w) => w.symbol === s);
          return {
            ...prev,
            watchlist: exists
              ? prev.watchlist.filter((w) => w.symbol !== s)
              : [
                  ...prev.watchlist,
                  { symbol: s, pinned: false, addedAt: Date.now() },
                ],
          };
        }),

      togglePin: (symbol) =>
        update((prev) => ({
          ...prev,
          watchlist: prev.watchlist.map((w) =>
            w.symbol === symbol.toUpperCase() ? { ...w, pinned: !w.pinned } : w,
          ),
        })),

      removeFromWatchlist: (symbol) =>
        update((prev) => ({
          ...prev,
          watchlist: prev.watchlist.filter(
            (w) => w.symbol !== symbol.toUpperCase(),
          ),
        })),

      setAlert: (symbol, alert) =>
        update((prev) => ({
          ...prev,
          watchlist: prev.watchlist.map((w) =>
            w.symbol === symbol.toUpperCase()
              ? { ...w, alertAbove: alert.above, alertBelow: alert.below }
              : w,
          ),
        })),

      saveNote: (note) =>
        update((prev) => {
          const now = Date.now();
          if (note.id) {
            return {
              ...prev,
              notes: prev.notes.map((n) =>
                n.id === note.id ? { ...n, ...note, updatedAt: now } : n,
              ),
            };
          }
          const created: Note = { ...note, id: newId(), updatedAt: now };
          return { ...prev, notes: [created, ...prev.notes] };
        }),

      deleteNote: (id) =>
        update((prev) => ({
          ...prev,
          notes: prev.notes.filter((n) => n.id !== id),
        })),

      saveTrade: (entry) =>
        update((prev) => {
          if (entry.id) {
            return {
              ...prev,
              journal: prev.journal.map((t) =>
                t.id === entry.id ? { ...t, ...entry, id: t.id } : t,
              ),
            };
          }
          const created: JournalEntry = {
            ...entry,
            id: newId(),
            openedAt: entry.openedAt ?? Date.now(),
          };
          return { ...prev, journal: [created, ...prev.journal] };
        }),

      deleteTrade: (id) =>
        update((prev) => ({
          ...prev,
          journal: prev.journal.filter((t) => t.id !== id),
        })),

      recordAnalysis: (analysis, conditions) =>
        update((prev) => {
          const withoutDuplicate = prev.recentAnalyses.filter(
            (a) => a.symbol !== analysis.symbol,
          );

          return {
            ...prev,
            // Unchanged: deduplicated and capped, for "pick up where you left off".
            recentAnalyses: [analysis, ...withoutDuplicate].slice(0, 10),
            // Added: the append-only attention log. Personalisation needs how
            // often and how recently a market was studied, which the
            // deduplicated list above discards by design.
            researchLog: [
              ...prev.researchLog,
              {
                symbol: analysis.symbol,
                at: analysis.viewedAt,
                trend: analysis.trend,
                confidence: analysis.confidence,
                conditions,
              },
            ].slice(-RESEARCH_LOG_LIMIT),
          };
        }),

      markBriefingSeen: (day) =>
        update((prev) => {
          // Only the first visit of a day advances `lastOpenedAt`, so the
          // "since you were here" greeting reflects the previous *day* rather
          // than resetting every time the page is opened.
          if (prev.ritual.lastBriefingDay === day) return prev;
          return {
            ...prev,
            ritual: { lastOpenedAt: Date.now(), lastBriefingDay: day },
          };
        }),

      signOut: async () => {
        const client = getSupabaseBrowserClient();
        if (client) await client.auth.signOut();
        setUser(null);
      },
    };
  }, [state, user, ready, demoMode, update, profile, memories]);

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = React.useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used inside <WorkspaceProvider>");
  }
  return ctx;
}

export type { WatchlistItem, Note, JournalEntry, RecentAnalysis };
