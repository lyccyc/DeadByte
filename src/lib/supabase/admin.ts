import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "./env";

/**
 * PRIVILEGED client using SUPABASE_SECRET_KEY (`service_role`, bypasses RLS).
 * Server-only: used for the svc_* functions (scoring, roles, admin writes,
 * leaderboard aggregates). Never pass its results to the client unfiltered.
 */
export function createSupabaseAdminClient(): SupabaseClient {
  const { url } = getSupabasePublicEnv();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!secret) throw new Error("SUPABASE_SECRET_KEY is not set");
  return createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
