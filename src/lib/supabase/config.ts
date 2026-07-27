/**
 * Supabase is optional.
 *
 * With credentials set, the app uses real auth and persists the workspace to
 * Postgres. Without them it runs in "demo mode": the same features work, backed
 * by localStorage, so the product is fully explorable with zero configuration.
 * Every Supabase call site must therefore tolerate a null client.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function isSupabaseConfigured(): boolean {
  return SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
}
