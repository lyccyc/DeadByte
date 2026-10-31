import { describe, expect, it, vi } from "vitest";
import { computeFlagDigest } from "@/lib/flags";
import { submitFlag, type SubmitRpc, type SubmitRpcRow } from "@/server/submissions/submit-flag";

const SECRET = "s".repeat(48);
const base = { userId: "u1", challengeId: "c1", secret: SECRET, maxPerMinute: 10 };

function rpcReturning(row: Partial<SubmitRpcRow> | null, error: { code?: string } | null = null) {
  return vi.fn<SubmitRpc>(async () => ({
    data: row ? [{ result: "incorrect", points_awarded: 0, retry_after_seconds: 0, ...row } as SubmitRpcRow] : null,
    error,
  }));
}

describe("submitFlag", () => {
  it("sends only the HMAC digest of the trimmed flag, never the flag itself", async () => {
    const rpc = rpcReturning({ result: "incorrect" });
    await submitFlag({ ...base, flag: "  DEADBYTE{Case_Sensitive}  ", rpc });
    const args = rpc.mock.calls[0][0];
    expect(args.p_digest).toBe(computeFlagDigest(SECRET, "DEADBYTE{Case_Sensitive}"));
    expect(args.p_digest).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(args)).not.toContain("DEADBYTE");
    expect(args).toMatchObject({ p_user_id: "u1", p_challenge_id: "c1", p_max_per_minute: 10 });
  });

  it("preserves case: a differently cased flag produces a different digest", () => {
    expect(computeFlagDigest(SECRET, "DEADBYTE{abc}")).not.toBe(computeFlagDigest(SECRET, "deadbyte{abc}"));
  });

  it("maps a first solve to the documented response", async () => {
    const out = await submitFlag({ ...base, flag: "DEADBYTE{x}", rpc: rpcReturning({ result: "solved", points_awarded: 100 }) });
    expect(out).toEqual({
      status: 200,
      newSolve: true,
      body: { correct: true, alreadySolved: false, pointsAwarded: 100, message: "Evidence recovered. Challenge solved." },
    });
  });

  it("awards zero points on a repeat correct submission", async () => {
    const out = await submitFlag({ ...base, flag: "DEADBYTE{x}", rpc: rpcReturning({ result: "already_solved", points_awarded: 0 }) });
    expect(out).toMatchObject({ status: 200, newSolve: false, body: { correct: true, alreadySolved: true, pointsAwarded: 0 } });
  });

  it("reports incorrect flags without leaking verifier details", async () => {
    const out = await submitFlag({ ...base, flag: "DEADBYTE{nope}", rpc: rpcReturning({ result: "incorrect" }) });
    expect(out).toMatchObject({ status: 200, body: { correct: false, pointsAwarded: 0 } });
    expect(JSON.stringify(out)).not.toMatch(/digest|hmac|expected/i);
  });

  it("rejects empty, oversized and control-character input before calling the database", async () => {
    const rpc = rpcReturning({ result: "solved" });
    expect(await submitFlag({ ...base, flag: "   ", rpc })).toMatchObject({ status: 400, code: "empty" });
    expect(await submitFlag({ ...base, flag: "A".repeat(257), rpc })).toMatchObject({ status: 400, code: "too_long" });
    expect(await submitFlag({ ...base, flag: "DEADBYTE{a\nb}", rpc })).toMatchObject({ status: 400, code: "invalid_characters" });
    expect(await submitFlag({ ...base, flag: 42, rpc })).toMatchObject({ status: 400 });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("maps rate limiting to 429 with Retry-After seconds", async () => {
    const out = await submitFlag({ ...base, flag: "DEADBYTE{x}", rpc: rpcReturning({ result: "rate_limited", retry_after_seconds: 17 }) });
    expect(out).toMatchObject({ status: 429, retryAfterSeconds: 17 });
  });

  it("maps unknown / unpublished challenges to 404 and missing verifiers to 409", async () => {
    expect(await submitFlag({ ...base, flag: "x", rpc: rpcReturning({ result: "not_found" }) })).toMatchObject({ status: 404 });
    expect(await submitFlag({ ...base, flag: "x", rpc: rpcReturning({ result: "unavailable" }) })).toMatchObject({ status: 409 });
  });

  it("fails closed with 500 on database errors", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const out = await submitFlag({ ...base, flag: "DEADBYTE{secret}", rpc: rpcReturning(null, { code: "XX000" }) });
    expect(out).toMatchObject({ status: 500 });
    expect(JSON.stringify(spy.mock.calls)).not.toContain("DEADBYTE{secret}");
    spy.mockRestore();
  });
});
