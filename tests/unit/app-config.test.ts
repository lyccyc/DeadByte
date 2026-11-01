import { describe, expect, it } from "vitest";
import { REQUIRED_ACCOUNT_ENV, REQUIRED_EVIDENCE_ENV, getConfigState, getSubmissionRateLimit } from "@/lib/app-config";

const SECRET = "x".repeat(48);
const full: Record<string, string> = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  SUPABASE_SECRET_KEY: "sb_secret_test",
  FLAG_HMAC_SECRET: SECRET,
};

describe("configuration state", () => {
  it("lists exactly the account variables as required", () => {
    expect([...REQUIRED_ACCOUNT_ENV].sort()).toEqual(Object.keys(full).sort());
  });

  it("is demo when nothing is configured", () => {
    expect(getConfigState({})).toMatchObject({ mode: "demo", accountsEnabled: false, evidenceDownloadsEnabled: false });
  });

  it("is misconfigured (fail closed) when only some variables are set", () => {
    const state = getConfigState({ NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co" });
    expect(state.mode).toBe("misconfigured");
    expect(state.accountsEnabled).toBe(false);
    expect(state.missing).toContain("FLAG_HMAC_SECRET");
  });

  it("treats whitespace-only values as missing", () => {
    expect(getConfigState({ ...full, FLAG_HMAC_SECRET: "  " }).mode).toBe("misconfigured");
  });

  it("rejects a short FLAG_HMAC_SECRET without echoing it", () => {
    const state = getConfigState({ ...full, FLAG_HMAC_SECRET: "short-secret" });
    expect(state.mode).toBe("misconfigured");
    expect(state.problems.join(" ")).toMatch(/at least 32 bytes/);
    expect(state.problems.join(" ")).not.toContain("short-secret");
  });

  it("rejects secrets exposed through NEXT_PUBLIC_", () => {
    const state = getConfigState({ ...full, NEXT_PUBLIC_SUPABASE_SECRET_KEY: "oops" });
    expect(state.mode).toBe("misconfigured");
    expect(state.accountsEnabled).toBe(false);
  });

  const r2 = {
    R2_ACCOUNT_ID: "0123456789abcdef0123456789abcdef",
    R2_ACCESS_KEY_ID: "access-key-id",
    R2_SECRET_ACCESS_KEY: "super-secret-access-key",
    R2_BUCKET_NAME: "deadbyte-evidence-dev",
  };

  it("enables accounts without R2; evidence downloads need accounts AND valid R2 variables", () => {
    expect(getConfigState(full)).toMatchObject({ mode: "configured", accountsEnabled: true, evidenceDownloadsEnabled: false, evidenceProblems: [] });
    expect(getConfigState({ ...full, ...r2 })).toMatchObject({ evidenceDownloadsEnabled: true, evidenceProblems: [] });
    expect(getConfigState(r2)).toMatchObject({ mode: "demo", evidenceDownloadsEnabled: false });
    expect(Object.keys(r2).sort()).toEqual([...REQUIRED_EVIDENCE_ENV].sort());
  });

  it("partial or invalid R2 variables disable downloads only, with secret-free diagnostics", () => {
    const partial = getConfigState({ ...full, R2_ACCOUNT_ID: r2.R2_ACCOUNT_ID, R2_SECRET_ACCESS_KEY: r2.R2_SECRET_ACCESS_KEY });
    expect(partial).toMatchObject({ mode: "configured", accountsEnabled: true, evidenceDownloadsEnabled: false });
    expect(partial.evidenceProblems.join(" ")).toMatch(/R2_ACCESS_KEY_ID, R2_BUCKET_NAME/);
    const bad = getConfigState({ ...full, ...r2, R2_ACCOUNT_ID: "not-an-account", R2_BUCKET_NAME: "Bad_Bucket" });
    expect(bad.evidenceDownloadsEnabled).toBe(false);
    expect(bad.evidenceProblems).toHaveLength(2);
    expect(JSON.stringify(bad)).not.toContain(r2.R2_SECRET_ACCESS_KEY);
  });

  it("treats NEXT_PUBLIC_R2_* as an exposed secret", () => {
    expect(getConfigState({ ...full, ...r2, NEXT_PUBLIC_R2_SECRET_ACCESS_KEY: "x" }).mode).toBe("misconfigured");
  });

  it("parses the submission rate limit with a safe default", () => {
    expect(getSubmissionRateLimit({})).toBe(10);
    expect(getSubmissionRateLimit({ FLAG_SUBMISSIONS_PER_MINUTE: "5" })).toBe(5);
    expect(getSubmissionRateLimit({ FLAG_SUBMISSIONS_PER_MINUTE: "0" })).toBe(10);
    expect(getSubmissionRateLimit({ FLAG_SUBMISSIONS_PER_MINUTE: "abc" })).toBe(10);
  });
});
