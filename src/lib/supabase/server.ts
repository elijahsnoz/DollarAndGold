import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./config";

/**
 * Server Supabase client bound to the request's cookies.
 * Returns null in demo mode so server components can branch cleanly.
 */
export async function getSupabaseServerClient(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured()) return null;

  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Session refresh is handled by middleware instead.
        }
      },
    },
  });
}

/** The signed-in user, or null when signed out or in demo mode. */
export async function getCurrentUser() {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** The signed-in user's `profiles` row, or null when signed out or in demo mode. */
export async function getCurrentProfile() {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;

  const user = await getCurrentUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name, plan, is_admin")
    .eq("id", user.id)
    .single();

  return data;
}

/**
 * Gate for `/api/admin/*` and `/api/ai-trader/*` route handlers.
 * RLS enforces the same rule at the database layer — this exists so a
 * rejected request gets a clear status and message instead of an opaque
 * Postgres error.
 *
 * Two failure modes get distinguished from a genuine "not an admin":
 *  - A network hiccup reaching Supabase itself throws — caught below rather
 *    than propagating as an unhandled 500.
 *  - Multiple concurrent auth checks on one page load can trigger Supabase's
 *    own `AuthRefreshDiscardedError` ("session state changed mid-flight"),
 *    which makes a single `getUser()` call transiently see no session even
 *    though one exists. One retry is enough for that race to have settled.
 * Both return a 503 asking the caller to retry, not a 403 — a transient
 * failure to verify is not the same claim as "you are not an admin."
 */
export async function requireAdmin(): Promise<
  | { ok: true; supabase: SupabaseClient }
  | { ok: false; status: number; error: string }
> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, status: 400, error: "Admin isn't configured." };
  }

  let profile;
  try {
    profile = (await getCurrentProfile()) ?? (await getCurrentProfile());
  } catch {
    return {
      ok: false,
      status: 503,
      error: "Couldn't verify admin access right now — please try again.",
    };
  }

  if (!profile?.is_admin) {
    return { ok: false, status: 403, error: "Not authorized." };
  }

  return { ok: true, supabase };
}
