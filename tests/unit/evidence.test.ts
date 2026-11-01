import { describe, expect, it, vi } from "vitest";
import {
  buildObjectKey,
  contentDisposition,
  evidenceManifestSchema,
  getDownloadGrantLimit,
  getDownloadUrlTtlSeconds,
  objectKeyExtension,
  parseObjectKey,
  sanitizeDisplayName,
} from "@/lib/evidence";
import { grantEvidenceDownload, type GrantRpc, type GrantRpcRow } from "@/server/evidence/grant-download";

vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => {
    throw new Error("tests must inject the rpc");
  },
}));
const { registerEvidence } = await import("@/server/admin/evidence");

const CHALLENGE = "4f1b2c3d-1234-4abc-8def-0123456789ab";
const FILE = "9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d";
const SHA = "a".repeat(64);
const KEY = `evidence/challenges/${CHALLENGE}/v1/${FILE}.7z`;

describe("evidence object keys", () => {
  it("builds the immutable layout and parses it back", () => {
    expect(buildObjectKey(CHALLENGE, 1, FILE, "frozen-memory.7z")).toBe(KEY);
    expect(parseObjectKey(KEY)).toEqual({ challengeId: CHALLENGE, version: 1, fileId: FILE });
    expect(buildObjectKey(CHALLENGE, 2, FILE, "disk.E01")).toMatch(/\/v2\/.*\.E01$/);
  });

  it("keeps at most two safe extensions and never user paths", () => {
    expect(objectKeyExtension("memory.raw.7z")).toBe(".raw.7z");
    expect(objectKeyExtension("a.b.tar.gz")).toBe(".tar.gz");
    expect(objectKeyExtension("README")).toBe("");
    expect(objectKeyExtension("weird.ext-with-dash")).toBe("");
    expect(objectKeyExtension("x.waytoolongextension")).toBe("");
    expect(buildObjectKey(CHALLENGE, 1, FILE, "../../etc/passwd")).toBe(`evidence/challenges/${CHALLENGE}/v1/${FILE}`);
  });

  it("rejects keys outside the layout", () => {
    for (const bad of [
      `../${KEY}`,
      `evidence/challenges/${CHALLENGE}/v0/${FILE}.7z`,
      `evidence/challenges/${CHALLENGE}/v1/${FILE}/x.7z`,
      `evidence/challenges/not-a-uuid/v1/${FILE}.7z`,
      `evidence/challenges/${CHALLENGE}/v1/${FILE}.a.b.c`,
    ]) {
      expect(parseObjectKey(bad), bad).toBeNull();
    }
    expect(() => buildObjectKey("nope", 1, FILE, "x.7z")).toThrow();
  });
});

describe("display names and Content-Disposition", () => {
  it("strips path separators, quotes and control characters", () => {
    expect(sanitizeDisplayName(' a/b\\c"d\n.7z ')).toBe("a_b_c_d_.7z");
  });

  it("produces a header-safe attachment disposition with a UTF-8 filename", () => {
    const header = contentDisposition('café "memory".7z');
    expect(header).toMatch(/^attachment; filename="caf_ _memory_.7z"; filename\*=UTF-8''caf%C3%A9%20_memory_.7z$/);
    expect(header).not.toMatch(/[\r\n]/);
  });
});

describe("evidence manifest", () => {
  const manifest = { challengeId: CHALLENGE, objectKey: KEY, displayName: "frozen.7z", sizeBytes: 42, sha256: SHA, mimeType: null };

  it("accepts the CLI manifest", () => {
    expect(evidenceManifestSchema.safeParse({ ...manifest, manifestVersion: 1, bucket: "b", uploadedAt: "now" }).success).toBe(true);
  });

  it("rejects mismatched challenges, bad checksums, unknown fields and unsafe names", () => {
    const other = "11111111-1111-4111-8111-111111111111";
    expect(evidenceManifestSchema.safeParse({ ...manifest, challengeId: other }).success).toBe(false);
    expect(evidenceManifestSchema.safeParse({ ...manifest, sha256: "A".repeat(64) }).success).toBe(false);
    expect(evidenceManifestSchema.safeParse({ ...manifest, sizeBytes: -1 }).success).toBe(false);
    expect(evidenceManifestSchema.safeParse({ ...manifest, displayName: "../x" }).success).toBe(false);
    expect(evidenceManifestSchema.safeParse({ ...manifest, secretAccessKey: "x" }).success).toBe(false);
  });
});

describe("download settings", () => {
  it("keeps signed URL lifetime within 5–15 minutes", () => {
    expect(getDownloadUrlTtlSeconds({})).toBe(600);
    expect(getDownloadUrlTtlSeconds({ EVIDENCE_URL_TTL_SECONDS: "900" })).toBe(900);
    expect(getDownloadUrlTtlSeconds({ EVIDENCE_URL_TTL_SECONDS: "86400" })).toBe(600);
    expect(getDownloadUrlTtlSeconds({ EVIDENCE_URL_TTL_SECONDS: "30" })).toBe(600);
  });

  it("parses the grant limit with a safe default", () => {
    expect(getDownloadGrantLimit({})).toBe(30);
    expect(getDownloadGrantLimit({ EVIDENCE_GRANTS_PER_HOUR: "5" })).toBe(5);
    expect(getDownloadGrantLimit({ EVIDENCE_GRANTS_PER_HOUR: "0" })).toBe(30);
  });
});

describe("grantEvidenceDownload", () => {
  const granted: GrantRpcRow = {
    outcome: "granted",
    object_key: KEY,
    display_name: "frozen.7z",
    size_bytes: "8589934592",
    sha256: SHA,
    mime_type: null,
    retry_after_seconds: 0,
  };
  const rpcReturning = (row: GrantRpcRow | null, error: { code?: string } | null = null) =>
    vi.fn<GrantRpc>(async () => ({ data: row ? [row] : null, error }));
  const base = { userId: "u1", evidenceId: FILE, maxGrantsPerHour: 30, ttlSeconds: 600, now: () => Date.parse("2026-11-01T00:00:00Z") };

  it("authorizes in the database first, then signs a short-lived URL; never returns the object key", async () => {
    const rpc = rpcReturning(granted);
    const presign = vi.fn(async () => "https://bucket.acct.r2.cloudflarestorage.com/signed?X-Amz-Expires=600");
    const out = await grantEvidenceDownload({ ...base, rpc, presign });
    expect(rpc).toHaveBeenCalledWith({ p_user_id: "u1", p_evidence_id: FILE, p_max_grants: 30, p_window_seconds: 3600 });
    expect(presign).toHaveBeenCalledWith({ objectKey: KEY, displayName: "frozen.7z", mimeType: null, expiresInSeconds: 600 });
    expect(out).toEqual({
      status: 200,
      body: {
        url: "https://bucket.acct.r2.cloudflarestorage.com/signed?X-Amz-Expires=600",
        expiresAt: "2026-11-01T00:10:00.000Z",
        expiresInSeconds: 600,
        displayName: "frozen.7z",
        sizeBytes: 8589934592,
        sha256: SHA,
      },
    });
    expect(JSON.stringify(out)).not.toContain("evidence/challenges");
  });

  it("denies unknown, draft, archived or inactive evidence without signing", async () => {
    const presign = vi.fn();
    const out = await grantEvidenceDownload({ ...base, rpc: rpcReturning({ ...granted, outcome: "not_found", object_key: null }), presign });
    expect(out).toMatchObject({ status: 404, code: "not_found" });
    expect(presign).not.toHaveBeenCalled();
  });

  it("returns 429 with Retry-After seconds when rate limited", async () => {
    const presign = vi.fn();
    const out = await grantEvidenceDownload({
      ...base,
      rpc: rpcReturning({ ...granted, outcome: "rate_limited", object_key: null, retry_after_seconds: 125 }),
      presign,
    });
    expect(out).toMatchObject({ status: 429, retryAfterSeconds: 125 });
    expect(presign).not.toHaveBeenCalled();
  });

  it("fails closed on database or storage errors without leaking details", async () => {
    expect(await grantEvidenceDownload({ ...base, rpc: rpcReturning(null, { code: "XX000" }), presign: vi.fn() })).toMatchObject({ status: 500 });
    const out = await grantEvidenceDownload({
      ...base,
      rpc: rpcReturning(granted),
      presign: async () => {
        throw new Error("InvalidAccessKeyId secret=abc");
      },
    });
    expect(out).toMatchObject({ status: 502, code: "storage_error" });
    expect(JSON.stringify(out)).not.toMatch(/secret|AccessKey/);
  });
});

describe("registerEvidence (admin attach)", () => {
  const manifest = { challengeId: CHALLENGE, objectKey: KEY, displayName: "frozen.7z", sizeBytes: 42, sha256: SHA, mimeType: null };
  const okRpc = () => vi.fn(async () => ({ data: "registered" as unknown, error: null }));

  it("HEAD-verifies existence, size and checksum before attaching", async () => {
    const rpc = okRpc();
    const out = await registerEvidence("admin-1", manifest, { head: async () => ({ exists: true, sizeBytes: 42, sha256: SHA }), rpc });
    expect(out).toEqual({ ok: true, evidenceId: FILE, alreadyRegistered: false });
    expect(rpc).toHaveBeenCalledWith(expect.objectContaining({ p_actor: "admin-1", p_challenge_id: CHALLENGE, p_evidence_id: FILE, p_object_key: KEY }));
  });

  it("refuses missing objects, size or checksum mismatches without touching the database", async () => {
    const rpc = okRpc();
    expect(await registerEvidence(null, manifest, { head: async () => ({ exists: false }), rpc })).toMatchObject({ ok: false, code: "object_missing" });
    expect(await registerEvidence(null, manifest, { head: async () => ({ exists: true, sizeBytes: 41, sha256: SHA }), rpc })).toMatchObject({ ok: false, code: "size_mismatch" });
    expect(await registerEvidence(null, manifest, { head: async () => ({ exists: true, sizeBytes: 42, sha256: "b".repeat(64) }), rpc })).toMatchObject({ ok: false, code: "checksum_mismatch" });
    expect(await registerEvidence(null, manifest, { head: async () => ({ exists: true, sizeBytes: 42, sha256: null }), rpc })).toMatchObject({ ok: false, code: "checksum_mismatch" });
    expect(await registerEvidence(null, manifest, { head: async () => { throw new Error("network"); }, rpc })).toMatchObject({ ok: false, status: 502 });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("maps database refusals", async () => {
    const head = async () => ({ exists: true as const, sizeBytes: 42, sha256: SHA });
    expect(await registerEvidence(null, manifest, { head, rpc: vi.fn(async () => ({ data: "conflict" as unknown, error: null })) })).toMatchObject({ ok: false, status: 409 });
    expect(await registerEvidence(null, manifest, { head, rpc: vi.fn(async () => ({ data: "challenge_not_found" as unknown, error: null })) })).toMatchObject({ ok: false, status: 404 });
    expect(await registerEvidence(null, manifest, { head, rpc: vi.fn(async () => ({ data: "already_registered" as unknown, error: null })) })).toMatchObject({ ok: true, alreadyRegistered: true });
  });
});
