import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

import {
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  isSupabaseConfigured,
} from "@/lib/supabase/config";

/** Routes that must never even begin rendering for a non-admin request. */
const ADMIN_ONLY_PREFIXES = ["/admin", "/ai-trader"];

/**
 * Refreshes the Supabase session cookie on navigation, and gates admin-only
 * routes here rather than leaving that solely to their layouts.
 *
 * The layouts under `/admin` and `/ai-trader` also check `is_admin` and call
 * `redirect()` — but a layout is an async Server Component, and Next.js can
 * begin rendering (and streaming the RSC payload for) a nested page's own
 * data-fetching concurrently with the layout, before the layout's `redirect()`
 * finishes short-circuiting the response. In practice that meant a raw,
 * unauthenticated request could receive computed page data — real figures,
 * not the redirect — inside the response body, even though the browser would
 * correctly follow the 307 and never render it. Blocking here, in
 * middleware, happens before any route segment renders at all, which is the
 * only place this class of leak can't reach.
 */
export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

  if (!isSupabaseConfigured()) return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Touching getUser() is what triggers the refresh.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAdminOnlyRoute = ADMIN_ONLY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (isAdminOnlyRoute) {
    if (!user) {
      return NextResponse.redirect(new URL("/sign-in", request.url));
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image optimisation — those never
     * need a session and would only add latency.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
