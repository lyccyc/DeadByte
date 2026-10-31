/**
 * Application configuration state (CLAUDE.md §11).
 *
 * Accounts / scoring (Phase 2) and evidence storage (Phase 3) are configured
 * independently so the CTF can run before R2 exists:
 *
 * - `demo`: no Supabase variables — browse the demo catalogue only.
 * - `configured`: all Supabase + flag variables present and valid. Accounts,
 *   real challenges, flag submission, profile and leaderboard are enabled.
 * - `misconfigured`: some but not all present, or invalid (fail closed).
 *
 * Evidence downloads additionally need the R2 variables AND the Phase 3 code;
 * until then `evidenceDownloadsEnabled` is false in every state.
 */

export type AppMode = "demo" | "configured" | "misconfigured";

export const REQUIRED_ACCOUNT_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
  "FLAG_HMAC_SECRET",
] as const;

export const REQUIRED_EVIDENCE_ENV = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"] as const;

/** Whether the R2 evidence download code has shipped. Flip in Phase 3. */
export const EVIDENCE_DOWNLOADS_IMPLEMENTED = false;

export const MIN_FLAG_SECRET_BYTES = 32;

export interface ConfigState {
  mode: AppMode;
  /** Required account variables that are missing. */
  missing: string[];
  /** Human-readable, secret-free configuration problems. */
  problems: string[];
  /** Supabase auth, DB-backed catalogue, flag submission, profile, leaderboard. */
  accountsEnabled: boolean;
  evidenceDownloadsEnabled: boolean;
}

type Env = Record<string, string | undefined>;

export function getConfigState(env: Env = process.env): ConfigState {
  const present = (key: string) => Boolean(env[key]?.trim());
  const missing = REQUIRED_ACCOUNT_ENV.filter((key) => !present(key));
  const problems: string[] = [];

  if (missing.length > 0 && missing.length < REQUIRED_ACCOUNT_ENV.length) {
    problems.push(`Missing: ${missing.join(", ")}`);
  }
  if (present("FLAG_HMAC_SECRET") && Buffer.byteLength(env.FLAG_HMAC_SECRET!.trim(), "utf8") < MIN_FLAG_SECRET_BYTES) {
    problems.push(`FLAG_HMAC_SECRET must be at least ${MIN_FLAG_SECRET_BYTES} bytes`);
  }
  if (present("NEXT_PUBLIC_SUPABASE_URL") && !/^https?:\/\/[^\s/]+/.test(env.NEXT_PUBLIC_SUPABASE_URL!.trim())) {
    problems.push("NEXT_PUBLIC_SUPABASE_URL must be an http(s) URL");
  }
  // A privileged key must never be shipped to the browser.
  for (const key of Object.keys(env)) {
    if (key.startsWith("NEXT_PUBLIC_") && /SECRET|SERVICE_ROLE|HMAC|R2_/.test(key) && present(key)) {
      problems.push(`${key} looks like a secret exposed through NEXT_PUBLIC_ — remove it`);
    }
  }

  const mode: AppMode =
    missing.length === REQUIRED_ACCOUNT_ENV.length && problems.length === 0
      ? "demo"
      : missing.length === 0 && problems.length === 0
        ? "configured"
        : "misconfigured";

  const evidenceEnvComplete = REQUIRED_EVIDENCE_ENV.every(present);

  return {
    mode,
    missing,
    problems,
    accountsEnabled: mode === "configured",
    evidenceDownloadsEnabled: EVIDENCE_DOWNLOADS_IMPLEMENTED && mode === "configured" && evidenceEnvComplete,
  };
}

/** Per-user flag submissions allowed per rolling minute (CLAUDE.md §8). */
export function getSubmissionRateLimit(env: Env = process.env): number {
  const n = Number.parseInt(env.FLAG_SUBMISSIONS_PER_MINUTE ?? "", 10);
  return Number.isFinite(n) && n >= 1 && n <= 120 ? n : 10;
}
