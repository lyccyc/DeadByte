import "server-only";
import { revalidateTag } from "next/cache";
import { parseObjectKey, type EvidenceManifest } from "@/lib/evidence";
import type { HeadResult } from "@/lib/r2/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CATALOGUE_TAG } from "@/server/catalogue";

/** Evidence row as shown to administrators (server-rendered for admins only). */
export interface AdminEvidenceFile {
  id: string;
  displayName: string;
  objectKey: string;
  sizeBytes: number;
  sha256: string;
  mimeType: string | null;
  uploadStatus: "pending" | "verified";
  isActive: boolean;
  createdAt: string;
  verifiedAt: string | null;
}

export async function listChallengeEvidence(challengeId: string): Promise<AdminEvidenceFile[]> {
  const { data, error } = await createSupabaseAdminClient()
    .from("evidence_files")
    .select("id, display_name, object_key, size_bytes, sha256, mime_type, upload_status, is_active, created_at, verified_at")
    .eq("challenge_id", challengeId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`evidence list failed: ${error.code}`);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    displayName: r.display_name as string,
    objectKey: r.object_key as string,
    sizeBytes: Number(r.size_bytes),
    sha256: r.sha256 as string,
    mimeType: (r.mime_type as string | null) ?? null,
    uploadStatus: r.upload_status as "pending" | "verified",
    isActive: r.is_active as boolean,
    createdAt: r.created_at as string,
    verifiedAt: (r.verified_at as string | null) ?? null,
  }));
}

export type RegisterResult =
  | { ok: true; evidenceId: string; alreadyRegistered: boolean }
  | { ok: false; status: 404 | 409 | 422 | 500 | 502 | 503; code: string; message: string };

/** PostgREST "function not found": the Phase 3 migration has not been applied. */
const MIGRATION_MISSING = {
  ok: false as const,
  status: 503 as const,
  code: "migration_missing",
  message: "The evidence database functions are missing. Apply supabase/migrations/20261101120000_evidence.sql (see docs/database.md).",
};

type RegisterRpc = (args: {
  p_actor: string | null;
  p_challenge_id: string;
  p_evidence_id: string;
  p_object_key: string;
  p_display_name: string;
  p_size_bytes: number;
  p_sha256: string;
  p_mime_type: string | null;
}) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;

const RPC_RESULTS: Record<string, { status: 404 | 409 | 422; message: string }> = {
  challenge_not_found: { status: 404, message: "Challenge not found." },
  key_mismatch: { status: 422, message: "The object key does not belong to this challenge." },
  conflict: { status: 409, message: "A different evidence record already uses this id or object key." },
};

/**
 * Verify an uploaded object in R2 (exists, exact size, recorded SHA-256), then
 * attach it to its challenge as verified evidence. Dependencies are injectable for tests.
 */
export async function registerEvidence(
  actorId: string | null,
  manifest: EvidenceManifest,
  deps: { head: (objectKey: string) => Promise<HeadResult>; rpc?: RegisterRpc },
): Promise<RegisterResult> {
  const key = parseObjectKey(manifest.objectKey);
  if (!key || key.challengeId !== manifest.challengeId.toLowerCase()) {
    return { ok: false, status: 422, code: "key_mismatch", message: "The object key does not belong to this challenge." };
  }

  let head: HeadResult;
  try {
    head = await deps.head(manifest.objectKey);
  } catch (e) {
    console.error("[admin] evidence HEAD failed", { name: (e as Error)?.name });
    return { ok: false, status: 502, code: "storage_error", message: "Could not reach evidence storage (R2). Check the R2 configuration." };
  }
  if (!head.exists) {
    return { ok: false, status: 422, code: "object_missing", message: "No object with this key exists in the evidence bucket. Upload it first." };
  }
  if (head.sizeBytes !== manifest.sizeBytes) {
    return {
      ok: false,
      status: 422,
      code: "size_mismatch",
      message: `Stored object is ${head.sizeBytes} bytes but the manifest says ${manifest.sizeBytes}.`,
    };
  }
  if (head.sha256 !== manifest.sha256) {
    return {
      ok: false,
      status: 422,
      code: "checksum_mismatch",
      message: head.sha256
        ? "The SHA-256 recorded on the stored object does not match the manifest."
        : "The stored object has no recorded SHA-256 (x-amz-meta-sha256). Upload it with npm run upload-evidence.",
    };
  }

  const rpc: RegisterRpc =
    deps.rpc ??
    (async (args) => {
      const { data, error } = await createSupabaseAdminClient().rpc("svc_register_evidence", args);
      return { data, error };
    });
  const { data, error } = await rpc({
    p_actor: actorId,
    p_challenge_id: manifest.challengeId.toLowerCase(),
    p_evidence_id: key.fileId,
    p_object_key: manifest.objectKey,
    p_display_name: manifest.displayName,
    p_size_bytes: manifest.sizeBytes,
    p_sha256: manifest.sha256,
    p_mime_type: manifest.mimeType ?? null,
  });
  if (error) {
    if (error.code === "PGRST202") return MIGRATION_MISSING;
    if (error.code === "23514" || error.code === "22023") {
      return { ok: false, status: 422, code: "invalid_metadata", message: "The evidence metadata was rejected by the database." };
    }
    console.error("[admin] evidence register failed", { code: error.code });
    return { ok: false, status: 500, code: "server_error", message: "Could not register the evidence." };
  }
  if (data === "registered" || data === "already_registered") {
    revalidateTag(CATALOGUE_TAG, { expire: 0 });
    return { ok: true, evidenceId: key.fileId, alreadyRegistered: data === "already_registered" };
  }
  const known = RPC_RESULTS[data as string];
  return known
    ? { ok: false, status: known.status, code: data as string, message: known.message }
    : { ok: false, status: 500, code: "server_error", message: "Unexpected response." };
}

export type ToggleResult = { ok: true } | { ok: false; status: 404 | 409 | 500 | 503; code: string; message: string };

export async function setEvidenceActive(actorId: string, evidenceId: string, active: boolean): Promise<ToggleResult> {
  const { data, error } = await createSupabaseAdminClient().rpc("svc_set_evidence_active", {
    p_actor: actorId,
    p_evidence_id: evidenceId,
    p_active: active,
  });
  if (error) {
    if (error.code === "PGRST202") return MIGRATION_MISSING;
    console.error("[admin] evidence toggle failed", { code: error.code });
    return { ok: false, status: 500, code: "server_error", message: "Could not update the evidence file." };
  }
  if (data === "updated") {
    revalidateTag(CATALOGUE_TAG, { expire: 0 });
    return { ok: true };
  }
  if (data === "not_found") return { ok: false, status: 404, code: "not_found", message: "Evidence not found." };
  if (data === "last_required_evidence") {
    return {
      ok: false,
      status: 409,
      code: "last_required_evidence",
      message: "This is the last verified evidence file of a published challenge that requires evidence. Attach a replacement or archive the challenge first.",
    };
  }
  return { ok: false, status: 500, code: "server_error", message: "Unexpected response." };
}
