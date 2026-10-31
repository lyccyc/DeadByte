/**
 * Application configuration state (CLAUDE.md §11).
 *
 * - `demo`: no backend credentials — browse demo content only.
 * - `configured`: all required variables present.
 * - `misconfigured`: some but not all required variables present (fail closed).
 *
 * NOTE: As of Phase 1 the persistent backend (Supabase auth, submissions, R2
 * downloads) is not implemented, so `backendFeaturesEnabled` is false in every
 * state. Phase 2/3 will flip it once the integrations exist and are verified.
 */

export type AppMode = "demo" | "configured" | "misconfigured";

export const REQUIRED_BACKEND_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
  "FLAG_HMAC_SECRET",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
] as const;

export interface ConfigState {
  mode: AppMode;
  missing: string[];
  backendFeaturesEnabled: boolean;
}

/** Whether the backend integration code has shipped. Flip in Phase 2. */
export const BACKEND_IMPLEMENTED = false;

export function getConfigState(env: Record<string, string | undefined> = process.env): ConfigState {
  const missing = REQUIRED_BACKEND_ENV.filter((key) => !env[key]?.trim());
  const mode: AppMode =
    missing.length === REQUIRED_BACKEND_ENV.length ? "demo" : missing.length === 0 ? "configured" : "misconfigured";
  return { mode, missing, backendFeaturesEnabled: BACKEND_IMPLEMENTED && mode === "configured" };
}
