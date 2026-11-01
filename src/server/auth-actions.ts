"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { getConfigState } from "@/lib/app-config";
import { safeNextPath } from "@/lib/safe-redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/server/auth";
import { LEADERBOARD_TAG } from "@/server/leaderboard";

export interface FormState {
  status: "idle" | "error" | "success";
  message: string;
  fieldErrors?: Record<string, string[] | undefined>;
}

const USERNAME = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_]{3,24}$/, "3–24 characters: letters, digits and underscores.");
const EMAIL = z.string().trim().toLowerCase().email("Enter a valid email address.").max(254);
const PASSWORD = z.string().min(8, "Use at least 8 characters.").max(72, "Use at most 72 characters.");

function notConfigured(): FormState {
  return { status: "error", message: "Accounts are not connected on this deployment." };
}

async function siteUrl(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!getConfigState().accountsEnabled) return notConfigured();
  const parsed = z.object({ email: EMAIL, password: z.string().min(1, "Enter your password.").max(72) }).safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { status: "error", message: "Check the highlighted fields.", fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    const unconfirmed = error.code === "email_not_confirmed";
    return {
      status: "error",
      message: unconfirmed ? "Confirm your email address first — check your inbox for the link." : "Invalid email or password.",
    };
  }
  redirect(safeNextPath(formData.get("next")));
}

export async function signUpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!getConfigState().accountsEnabled) return notConfigured();
  const parsed = z
    .object({ username: USERNAME, email: EMAIL, password: PASSWORD })
    .safeParse({ username: formData.get("username"), email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { status: "error", message: "Check the highlighted fields.", fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const supabase = await createSupabaseServerClient();
  const { data: taken } = await supabase.from("profiles").select("user_id").ilike("username", parsed.data.username.replace(/_/g, "\\_")).limit(1);
  if (taken && taken.length > 0) {
    return { status: "error", message: "Check the highlighted fields.", fieldErrors: { username: ["That username is taken."] } };
  }

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { username: parsed.data.username },
      emailRedirectTo: `${await siteUrl()}/auth/confirm?next=/profile`,
    },
  });
  if (error) {
    if (error.code === "weak_password") return { status: "error", message: error.message };
    if (error.code === "over_email_send_rate_limit" || error.status === 429) {
      return { status: "error", message: "Too many sign-up attempts. Try again in a few minutes." };
    }
    console.error("[auth] sign-up failed", { code: error.code, status: error.status });
    return { status: "error", message: "Could not create the account. Try again." };
  }
  // Email confirmation disabled in Supabase -> a session exists immediately.
  if (data.session) redirect("/profile");
  // Same message whether or not the email was already registered (no account enumeration).
  return { status: "success", message: "Check your inbox to confirm your email address, then sign in." };
}

export async function requestPasswordResetAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!getConfigState().accountsEnabled) return notConfigured();
  const parsed = z.object({ email: EMAIL }).safeParse({ email: formData.get("email") });
  if (!parsed.success) return { status: "error", message: "Enter a valid email address.", fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await siteUrl()}/auth/confirm?next=/reset-password/update`,
  });
  if (error && error.status === 429) return { status: "error", message: "Too many requests. Try again in a few minutes." };
  if (error) console.error("[auth] reset request failed", { code: error.code, status: error.status });
  return { status: "success", message: "If an account exists for that email, a reset link is on its way." };
}

export async function updatePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!getConfigState().accountsEnabled) return notConfigured();
  if (!(await getSessionUser())) return { status: "error", message: "Your reset link has expired. Request a new one." };
  const parsed = z
    .object({ password: PASSWORD, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match." })
    .safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) return { status: "error", message: "Check the highlighted fields.", fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { status: "error", message: error.code === "same_password" ? "Choose a different password." : "Could not update the password." };
  }
  redirect("/profile?password=updated");
}

export async function updateUsernameAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!getConfigState().accountsEnabled) return notConfigured();
  const user = await getSessionUser();
  if (!user) return { status: "error", message: "Sign in again to edit your profile." };
  const parsed = z.object({ username: USERNAME }).safeParse({ username: formData.get("username") });
  if (!parsed.success) return { status: "error", message: "Check the highlighted fields.", fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const supabase = await createSupabaseServerClient();
  // RLS + column grants: a player can only change username/avatar_url of their own row.
  const { error } = await supabase.from("profiles").update({ username: parsed.data.username }).eq("user_id", user.id);
  if (error) {
    if (error.code === "23505") return { status: "error", message: "That username is taken.", fieldErrors: { username: ["That username is taken."] } };
    return { status: "error", message: "Could not update your username." };
  }
  revalidateTag(LEADERBOARD_TAG, { expire: 0 });
  return { status: "success", message: "Username updated." };
}
