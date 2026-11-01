import type { NextRequest } from "next/server";
import { getConfigState } from "@/lib/app-config";
import { PRIVATE_NO_STORE, jsonError, jsonOk, readJson } from "@/lib/api";
import { evidenceManifestSchema } from "@/lib/evidence";
import { headEvidenceObject } from "@/lib/r2/client";
import { registerEvidence } from "@/server/admin/evidence";
import { guardAdmin } from "../../guard";

/**
 * POST /api/v1/admin/evidence/register
 * Body: the manifest printed by `npm run upload-evidence` (challengeId, objectKey,
 * displayName, sizeBytes, sha256, mimeType). The object is HEAD-checked in R2
 * (exists, exact size, recorded SHA-256) before it is attached as verified evidence.
 */
export async function POST(request: NextRequest) {
  const headers = PRIVATE_NO_STORE;
  const guard = await guardAdmin(request, { mutation: true });
  if (!guard.ok) return guard.response;
  if (!getConfigState().evidenceDownloadsEnabled) {
    return jsonError(503, "evidence_not_configured", "R2 evidence storage is not configured on this server (R2_* variables).", undefined, { headers });
  }

  const parsed = evidenceManifestSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return jsonError(400, "invalid_manifest", "Invalid evidence manifest.", parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })), { headers });
  }

  const result = await registerEvidence(guard.user.id, parsed.data, { head: headEvidenceObject });
  if (!result.ok) return jsonError(result.status, result.code, result.message, undefined, { headers });
  return jsonOk({ evidenceId: result.evidenceId, alreadyRegistered: result.alreadyRegistered, status: "verified" }, { headers });
}
