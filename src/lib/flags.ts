import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Server-side flag verification primitives (CLAUDE.md §6 `private.flag_verifiers`).
 *
 * - Flags are never stored in plaintext: only HMAC-SHA256(FLAG_HMAC_SECRET, flag) digests.
 * - Normalisation policy: trim accidental surrounding whitespace ONLY. Case and
 *   inner bytes are preserved exactly.
 * - Comparison is constant-time over equally sized buffers.
 *
 * This module must only be imported from server code. It is not yet wired to
 * a submission endpoint (Phase 2 requires the database and auth).
 */

export const FLAG_ALGORITHM = "hmac-sha256-v1" as const;
export const MAX_FLAG_LENGTH = 256;
export const MIN_SECRET_BYTES = 32;

export type FlagInputError = "empty" | "too_long" | "invalid_characters";

export type NormalizedFlag = { ok: true; value: string } | { ok: false; error: FlagInputError };

// Printable characters only; rejects control characters (incl. NUL, newlines inside the flag).
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/;

export function normalizeFlag(input: unknown): NormalizedFlag {
  if (typeof input !== "string") return { ok: false, error: "empty" };
  const value = input.trim();
  if (value.length === 0) return { ok: false, error: "empty" };
  if (value.length > MAX_FLAG_LENGTH) return { ok: false, error: "too_long" };
  if (CONTROL_CHARS.test(value)) return { ok: false, error: "invalid_characters" };
  return { ok: true, value };
}

function assertSecret(secret: string): void {
  if (Buffer.byteLength(secret, "utf8") < MIN_SECRET_BYTES) {
    throw new Error(`FLAG_HMAC_SECRET must be at least ${MIN_SECRET_BYTES} bytes`);
  }
}

/** Hex HMAC-SHA256 digest of an already-normalised flag. */
export function computeFlagDigest(secret: string, normalizedFlag: string): string {
  assertSecret(secret);
  return createHmac("sha256", secret).update(normalizedFlag, "utf8").digest("hex");
}

const HEX_SHA256 = /^[0-9a-f]{64}$/;

/** Returns true only if `submitted` matches the stored digest. Never throws on bad user input. */
export function verifyFlag(secret: string, submitted: unknown, expectedDigestHex: string): boolean {
  const normalized = normalizeFlag(submitted);
  if (!normalized.ok) return false;
  if (!HEX_SHA256.test(expectedDigestHex)) return false;

  const actual = Buffer.from(computeFlagDigest(secret, normalized.value), "hex");
  const expected = Buffer.from(expectedDigestHex, "hex");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
