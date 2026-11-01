/**
 * Evidence metadata helpers shared by the server and the operator upload CLI
 * (scripts/upload-evidence.ts). Pure functions: no secrets, no I/O.
 */
import { z } from "zod";

const UUID_RE = "[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const EXT_RE = "(?:\\.[A-Za-z0-9]{1,10}){0,2}";

/** Same layout as the SQL CHECK and svc_register_evidence. */
const OBJECT_KEY = new RegExp(`^evidence/challenges/(${UUID_RE})/v([1-9][0-9]{0,3})/(${UUID_RE})(${EXT_RE})$`);

export const SHA256_HEX = /^[0-9a-f]{64}$/;

/** User-metadata key under which the uploader records the full-object SHA-256 (R2 ETags are not SHA-256). */
export const SHA256_METADATA_KEY = "sha256";

/**
 * Keeps up to two short alphanumeric extensions from a filename
 * (`memory.raw.7z` → `.raw.7z`, `capture.pcapng` → `.pcapng`, `README` → ``).
 */
export function objectKeyExtension(filename: string): string {
  const parts = filename.split(".").slice(1);
  const safe: string[] = [];
  for (let i = parts.length - 1; i >= 0 && safe.length < 2; i--) {
    if (!/^[A-Za-z0-9]{1,10}$/.test(parts[i])) break;
    safe.unshift(parts[i]);
  }
  return safe.length ? `.${safe.join(".")}` : "";
}

export function buildObjectKey(challengeId: string, version: number, fileId: string, filename: string): string {
  const key = `evidence/challenges/${challengeId.toLowerCase()}/v${version}/${fileId.toLowerCase()}${objectKeyExtension(filename)}`;
  if (!parseObjectKey(key)) throw new Error("Invalid challenge id, file id or version for an evidence object key");
  return key;
}

export function parseObjectKey(key: string): { challengeId: string; version: number; fileId: string } | null {
  const m = OBJECT_KEY.exec(key);
  return m ? { challengeId: m[1], version: Number(m[2]), fileId: m[3] } : null;
}

/** Display names are shown to players and used as the download filename. */
export function sanitizeDisplayName(name: string): string {
  return name
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f/\\"]/g, "_")
    .trim()
    .slice(0, 200);
}

export const displayNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .refine((v) => !/[\u0000-\u001f\u007f/\\"]/.test(v), "Display name must not contain slashes, quotes or control characters");

/** Manifest written by the upload CLI and accepted by POST /api/v1/admin/evidence/register. */
export const evidenceManifestSchema = z
  .object({
    challengeId: z.string().regex(new RegExp(`^${UUID_RE}$`), "challengeId must be a UUID"),
    objectKey: z.string().max(200).refine((k) => parseObjectKey(k) !== null, "objectKey does not match the evidence key layout"),
    displayName: displayNameSchema,
    sizeBytes: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    sha256: z.string().regex(SHA256_HEX, "sha256 must be 64 lower-case hex characters"),
    mimeType: z.string().max(100).regex(/^[\w.+-]+\/[\w.+-]+$/).nullish(),
    // Informational fields the CLI adds; ignored by the server.
    bucket: z.string().optional(),
    uploadedAt: z.string().optional(),
    manifestVersion: z.literal(1).optional(),
  })
  .strict()
  .superRefine((m, ctx) => {
    const parsed = parseObjectKey(m.objectKey);
    if (parsed && parsed.challengeId !== m.challengeId.toLowerCase()) {
      ctx.addIssue({ code: "custom", path: ["objectKey"], message: "objectKey belongs to a different challenge" });
    }
  });

export type EvidenceManifest = z.infer<typeof evidenceManifestSchema>;

/** RFC 6266 Content-Disposition for a presigned download (ASCII fallback + UTF-8 filename*). */
export function contentDisposition(displayName: string): string {
  const safe = sanitizeDisplayName(displayName) || "evidence";
  const ascii = safe.replace(/[^\x20-\x7e]/g, "_").replace(/[%;]/g, "_");
  const encoded = encodeURIComponent(safe).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

/** Signed-URL lifetime (CLAUDE.md §9: 5–15 minutes). */
export function getDownloadUrlTtlSeconds(env: Record<string, string | undefined> = process.env): number {
  const n = Number.parseInt(env.EVIDENCE_URL_TTL_SECONDS ?? "", 10);
  return Number.isFinite(n) && n >= 300 && n <= 900 ? n : 600;
}

/** Download grants per user per rolling hour (generous: large downloads get interrupted and resumed). */
export function getDownloadGrantLimit(env: Record<string, string | undefined> = process.env): number {
  const n = Number.parseInt(env.EVIDENCE_GRANTS_PER_HOUR ?? "", 10);
  return Number.isFinite(n) && n >= 1 && n <= 500 ? n : 30;
}
