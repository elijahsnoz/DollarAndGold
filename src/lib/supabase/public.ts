import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./config";

let cached: SupabaseClient | null = null;

/**
 * Anon Supabase client with no cookies and no session.
 *
 * For reads that are public by RLS design (published news articles) and have
 * no per-user data — server code that isn't inside a request's cookie scope
 * (a cached provider, a cron job) can use this instead of
 * `getSupabaseServerClient()`.
 */
export function getSupabasePublicClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!cached) cached = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return cached;
}
