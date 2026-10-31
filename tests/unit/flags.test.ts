import { describe, expect, it } from "vitest";
import { computeFlagDigest, MAX_FLAG_LENGTH, normalizeFlag, verifyFlag } from "@/lib/flags";

const SECRET = "test-only-secret-0123456789abcdef0123456789abcdef";
const FLAG = "DEADBYTE{test_only_flag}";
const DIGEST = computeFlagDigest(SECRET, FLAG);

describe("flag normalisation", () => {
  it("trims surrounding whitespace only", () => {
    expect(normalizeFlag(`  ${FLAG}\n`)).toEqual({ ok: true, value: FLAG });
    expect(normalizeFlag("DEADBYTE{a b}")).toEqual({ ok: true, value: "DEADBYTE{a b}" });
  });

  it("rejects empty, non-string, oversized and control-character input", () => {
    expect(normalizeFlag("")).toEqual({ ok: false, error: "empty" });
    expect(normalizeFlag("   ")).toEqual({ ok: false, error: "empty" });
    expect(normalizeFlag(undefined)).toEqual({ ok: false, error: "empty" });
    expect(normalizeFlag(42)).toEqual({ ok: false, error: "empty" });
    expect(normalizeFlag("A".repeat(MAX_FLAG_LENGTH + 1))).toEqual({ ok: false, error: "too_long" });
    expect(normalizeFlag("DEADBYTE{a\u0000b}")).toEqual({ ok: false, error: "invalid_characters" });
    expect(normalizeFlag("DEADBYTE{a\nb}")).toEqual({ ok: false, error: "invalid_characters" });
  });
});

describe("HMAC flag verification", () => {
  it("produces a 64-char hex digest and never contains the flag", () => {
    expect(DIGEST).toMatch(/^[0-9a-f]{64}$/);
    expect(DIGEST).not.toContain("test_only_flag");
  });

  it("accepts the correct flag, including with surrounding whitespace", () => {
    expect(verifyFlag(SECRET, FLAG, DIGEST)).toBe(true);
    expect(verifyFlag(SECRET, `\t${FLAG}  `, DIGEST)).toBe(true);
  });

  it("is case-sensitive and rejects near misses", () => {
    expect(verifyFlag(SECRET, FLAG.toLowerCase(), DIGEST)).toBe(false);
    expect(verifyFlag(SECRET, "DEADBYTE{test_only_flag }", DIGEST)).toBe(false);
    expect(verifyFlag(SECRET, "DEADBYTE{wrong}", DIGEST)).toBe(false);
  });

  it("depends on the server secret", () => {
    expect(verifyFlag(`${SECRET}-rotated`, FLAG, DIGEST)).toBe(false);
  });

  it("fails closed on malformed input or stored digest without throwing", () => {
    expect(verifyFlag(SECRET, null, DIGEST)).toBe(false);
    expect(verifyFlag(SECRET, "", DIGEST)).toBe(false);
    expect(verifyFlag(SECRET, "X".repeat(10_000), DIGEST)).toBe(false);
    expect(verifyFlag(SECRET, FLAG, "not-hex")).toBe(false);
    expect(verifyFlag(SECRET, FLAG, DIGEST.slice(0, 62))).toBe(false);
    expect(verifyFlag(SECRET, FLAG, DIGEST.toUpperCase())).toBe(false);
  });

  it("refuses weak secrets", () => {
    expect(() => computeFlagDigest("short", FLAG)).toThrow(/at least/);
  });
});
