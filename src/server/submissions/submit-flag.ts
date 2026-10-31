import { computeFlagDigest, normalizeFlag, type FlagInputError } from "@/lib/flags";

/**
 * Trusted flag submission flow (CLAUDE.md §6 "Database authorization and atomicity").
 *
 * 1. Normalise the flag (trim surrounding whitespace only; case preserved).
 * 2. Compute HMAC-SHA256(FLAG_HMAC_SECRET, flag) on the server.
 * 3. Call `svc_submit_flag` (service_role only), which in ONE transaction
 *    applies the per-user rate limit, compares the digest with the private
 *    verifier, records the attempt and inserts the first solve with
 *    ON CONFLICT DO NOTHING. The expected digest never leaves the database.
 *
 * Kept free of Next.js/Supabase imports so it is unit-testable with a fake RPC.
 */

export type SubmitRpcResult =
  | "solved"
  | "already_solved"
  | "incorrect"
  | "rate_limited"
  | "not_found"
  | "unavailable";

export interface SubmitRpcRow {
  result: SubmitRpcResult;
  points_awarded: number;
  retry_after_seconds: number;
}

export type SubmitRpc = (args: {
  p_user_id: string;
  p_challenge_id: string;
  p_digest: string;
  p_max_per_minute: number;
}) => Promise<{ data: SubmitRpcRow[] | null; error: { code?: string; message?: string } | null }>;

export interface SubmitBody {
  correct: boolean;
  alreadySolved: boolean;
  pointsAwarded: number;
  message: string;
}

export type SubmitOutcome =
  | { status: 200; body: SubmitBody; newSolve: boolean }
  | { status: 400; code: FlagInputError; message: string }
  | { status: 404; code: "not_found"; message: string }
  | { status: 409; code: "unavailable"; message: string }
  | { status: 429; code: "rate_limited"; message: string; retryAfterSeconds: number }
  | { status: 500; code: "server_error"; message: string };

const INPUT_MESSAGES: Record<FlagInputError, string> = {
  empty: "Enter a flag.",
  too_long: "That flag is too long.",
  invalid_characters: "Flags cannot contain control characters or line breaks.",
};

export async function submitFlag(input: {
  userId: string;
  challengeId: string;
  flag: unknown;
  secret: string;
  maxPerMinute: number;
  rpc: SubmitRpc;
}): Promise<SubmitOutcome> {
  const normalized = normalizeFlag(input.flag);
  if (!normalized.ok) return { status: 400, code: normalized.error, message: INPUT_MESSAGES[normalized.error] };

  const digest = computeFlagDigest(input.secret, normalized.value);
  const { data, error } = await input.rpc({
    p_user_id: input.userId,
    p_challenge_id: input.challengeId,
    p_digest: digest,
    p_max_per_minute: input.maxPerMinute,
  });
  const row = data?.[0];
  if (error || !row) {
    // Never log the flag or digest.
    console.error("[submit] svc_submit_flag failed", { code: error?.code, message: error?.message });
    return { status: 500, code: "server_error", message: "Submission could not be recorded. Try again." };
  }

  switch (row.result) {
    case "solved":
      return {
        status: 200,
        newSolve: true,
        body: { correct: true, alreadySolved: false, pointsAwarded: row.points_awarded, message: "Evidence recovered. Challenge solved." },
      };
    case "already_solved":
      return {
        status: 200,
        newSolve: false,
        body: { correct: true, alreadySolved: true, pointsAwarded: 0, message: "You already solved this challenge." },
      };
    case "incorrect":
      return {
        status: 200,
        newSolve: false,
        body: { correct: false, alreadySolved: false, pointsAwarded: 0, message: "Incorrect flag. Keep investigating." },
      };
    case "rate_limited":
      return {
        status: 429,
        code: "rate_limited",
        message: "Too many attempts. Wait a moment before submitting again.",
        retryAfterSeconds: Math.max(1, row.retry_after_seconds),
      };
    case "not_found":
      return { status: 404, code: "not_found", message: "Challenge not found." };
    case "unavailable":
      return { status: 409, code: "unavailable", message: "Flag verification is not set up for this challenge yet." };
    default:
      return { status: 500, code: "server_error", message: "Unexpected verifier response." };
  }
}
