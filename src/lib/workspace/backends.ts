"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

import { EMPTY_WORKSPACE, type WorkspaceBackend, type WorkspaceState } from "./types";

const STORAGE_KEY = "dg:workspace:v1";

/** Demo-mode persistence. Survives reloads, scoped to the browser. */
export class LocalBackend implements WorkspaceBackend {
  readonly id = "local" as const;

  async load(): Promise<WorkspaceState> {
    if (typeof window === "undefined") return EMPTY_WORKSPACE;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return EMPTY_WORKSPACE;
      // Merge over the empty shape so an older payload can't drop a collection.
      return { ...EMPTY_WORKSPACE, ...(JSON.parse(raw) as Partial<WorkspaceState>) };
    } catch {
      return EMPTY_WORKSPACE;
    }
  }

  async save(state: WorkspaceState): Promise<void> {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Quota exceeded or storage blocked — the in-memory state is still valid.
    }
  }
}

/**
 * Signed-in persistence.
 *
 * The workspace is small and always read and written as a whole, so it is
 * stored as one row per user rather than four normalised tables. That keeps
 * saves atomic — a watchlist edit can't half-commit against a journal edit —
 * and means the client needs a single round trip instead of four.
 */
export class SupabaseBackend implements WorkspaceBackend {
  readonly id = "supabase" as const;

  constructor(
    private readonly client: SupabaseClient,
    private readonly userId: string,
  ) {}

  async load(): Promise<WorkspaceState> {
    const { data, error } = await this.client
      .from("workspaces")
      .select("data")
      .eq("user_id", this.userId)
      .maybeSingle();

    if (error || !data?.data) return EMPTY_WORKSPACE;
    return { ...EMPTY_WORKSPACE, ...(data.data as Partial<WorkspaceState>) };
  }

  async save(state: WorkspaceState): Promise<void> {
    await this.client.from("workspaces").upsert(
      {
        user_id: this.userId,
        data: state,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  }
}
