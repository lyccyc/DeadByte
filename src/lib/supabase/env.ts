/** Supabase connection values. Throws when accounts are not configured (fail closed). */
import { getConfigState } from "@/lib/app-config";

export function getSupabasePublicEnv(): { url: string; publishableKey: string } {
  if (!getConfigState().accountsEnabled) throw new Error("Supabase is not configured");
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!.trim(),
  };
}
