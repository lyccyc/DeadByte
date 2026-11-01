import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { getConfigState } from "@/lib/app-config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Data Access Layer for identity. Every protected read/write re-verifies the
 * session here, next to the data — never trust UI state or the proxy alone.
 */

export interface SessionUser {
  id: string;
  email: string | null;
}

export interface Viewer extends SessionUser {
  username: string;
  avatarUrl: string | null;
  role: "admin" | "player";
}

/** Verified current user (JWT validated by Supabase `getClaims`), or null. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  if (!getConfigState().accountsEnabled) return null;
  // Verifying a session compares the token expiry with the current time
  // (Date.now()), which Cache Components forbids during prerendering. Mark
  // this as request-time work first.
  await connection();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  const claims = data.claims as { sub: string; email?: string; role?: string };
  // Anonymous sign-ins (if ever enabled in Supabase) are not players.
  if (claims.role !== "authenticated") return null;
  return { id: claims.sub, email: claims.email ?? null };
});

/** Role from the private roles table via the service-only function. Defaults to player; fails closed. */
export const getUserRole = cache(async (userId: string): Promise<"admin" | "player"> => {
  const { data, error } = await createSupabaseAdminClient().rpc("svc_get_user_role", { p_user_id: userId });
  if (error) {
    console.error("[auth] role lookup failed", { code: error.code });
    return "player";
  }
  return data === "admin" ? "admin" : "player";
});

/** Current user with public profile and role, or null when signed out. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await createSupabaseServerClient();
  const [{ data: profile }, role] = await Promise.all([
    supabase.from("profiles").select("username, avatar_url").eq("user_id", user.id).maybeSingle(),
    getUserRole(user.id),
  ]);
  return {
    ...user,
    username: (profile?.username as string | undefined) ?? "investigator",
    avatarUrl: (profile?.avatar_url as string | null | undefined) ?? null,
    role,
  };
});

export type AdminCheck =
  | { ok: true; user: SessionUser }
  | { ok: false; status: 401 | 403 | 503; code: string; message: string };

/** Server-side admin authorization for Route Handlers and admin pages. */
export async function checkAdmin(): Promise<AdminCheck> {
  if (!getConfigState().accountsEnabled) {
    return { ok: false, status: 503, code: "not_configured", message: "Accounts are not configured." };
  }
  const user = await getSessionUser();
  if (!user) return { ok: false, status: 401, code: "unauthenticated", message: "Sign in required." };
  if ((await getUserRole(user.id)) !== "admin") {
    return { ok: false, status: 403, code: "forbidden", message: "Administrator access required." };
  }
  return { ok: true, user };
}
