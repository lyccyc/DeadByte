import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "./env";

/**
 * Cookieless client with the publishable key, i.e. the `anon` role under RLS.
 * Safe inside `"use cache"` scopes because it never reads the request.
 */
export function createSupabasePublicClient(): SupabaseClient {
  const { url, publishableKey } = getSupabasePublicEnv();
  return createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
