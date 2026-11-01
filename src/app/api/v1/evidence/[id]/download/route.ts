import type { NextRequest } from "next/server";
import { getConfigState } from "@/lib/app-config";
import { PRIVATE_NO_STORE, isSameOrigin, isUuid, jsonError } from "@/lib/api";
import { getDownloadGrantLimit, getDownloadUrlTtlSeconds } from "@/lib/evidence";
import { presignEvidenceDownload } from "@/lib/r2/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/server/auth";
import { grantEvidenceDownload, type GrantRpc } from "@/server/evidence/grant-download";

/**
 * POST /api/v1/evidence/:id/download
 *
 * Signed-in players get a short-lived presigned R2 GET URL for an active,
 * verified evidence file of a published challenge. The browser downloads
 * directly from R2; no evidence bytes pass through this server.
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/v1/evidence/[id]/download">) {
  const headers = PRIVATE_NO_STORE;
  const config = getConfigState();
  if (!config.accountsEnabled) {
    return jsonError(503, "not_configured", "Evidence downloads are unavailable in demo mode.", undefined, { headers });
  }
  if (!config.evidenceDownloadsEnabled) {
    return jsonError(503, "evidence_not_configured", "Evidence storage is not configured on this server.", undefined, { headers });
  }
  if (!isSameOrigin(request)) return jsonError(403, "bad_origin", "Cross-site request rejected.", undefined, { headers });

  const user = await getSessionUser();
  if (!user) return jsonError(401, "unauthenticated", "Sign in to download evidence.", undefined, { headers });

  const { id } = await ctx.params;
  if (!isUuid(id)) return jsonError(404, "not_found", "Evidence not found.", undefined, { headers });

  const admin = createSupabaseAdminClient();
  const rpc: GrantRpc = async (args) => {
    const { data, error } = await admin.rpc("svc_grant_evidence_download", args);
    return { data, error };
  };

  const outcome = await grantEvidenceDownload({
    userId: user.id,
    evidenceId: id.toLowerCase(),
    maxGrantsPerHour: getDownloadGrantLimit(),
    ttlSeconds: getDownloadUrlTtlSeconds(),
    rpc,
    presign: presignEvidenceDownload,
  });

  if (outcome.status === 200) return Response.json(outcome.body, { headers });
  if (outcome.status === 429) {
    return jsonError(429, outcome.code, outcome.message, undefined, {
      headers: { ...headers, "Retry-After": String(outcome.retryAfterSeconds) },
    });
  }
  return jsonError(outcome.status, outcome.code, outcome.message, undefined, { headers });
}
