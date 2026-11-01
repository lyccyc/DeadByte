import "server-only";

/**
 * Trusted evidence download flow (CLAUDE.md §9):
 *   1. svc_grant_evidence_download (one transaction): published + active +
 *      verified check, per-user rate limit, grant recorded;
 *   2. only then sign a short-lived R2 GET URL.
 * Dependencies are injected so the flow is unit-testable without Supabase/R2.
 */

export interface GrantRpcRow {
  outcome: "granted" | "not_found" | "rate_limited";
  object_key: string | null;
  display_name: string | null;
  size_bytes: number | string | null;
  sha256: string | null;
  mime_type: string | null;
  retry_after_seconds: number;
}

export type GrantRpc = (args: {
  p_user_id: string;
  p_evidence_id: string;
  p_max_grants: number;
  p_window_seconds: number;
}) => Promise<{ data: GrantRpcRow[] | null; error: { code?: string; message?: string } | null }>;

export type Presign = (input: { objectKey: string; displayName: string; mimeType: string | null; expiresInSeconds: number }) => Promise<string>;

export interface DownloadGrantBody {
  url: string;
  expiresAt: string;
  expiresInSeconds: number;
  displayName: string;
  sizeBytes: number;
  sha256: string;
}

export type GrantOutcome =
  | { status: 200; body: DownloadGrantBody }
  | { status: 404; code: "not_found"; message: string }
  | { status: 429; code: "rate_limited"; message: string; retryAfterSeconds: number }
  | { status: 500 | 502; code: "server_error" | "storage_error"; message: string };

export const GRANT_WINDOW_SECONDS = 3600;

export async function grantEvidenceDownload(input: {
  userId: string;
  evidenceId: string;
  maxGrantsPerHour: number;
  ttlSeconds: number;
  rpc: GrantRpc;
  presign: Presign;
  now?: () => number;
}): Promise<GrantOutcome> {
  const { data, error } = await input.rpc({
    p_user_id: input.userId,
    p_evidence_id: input.evidenceId,
    p_max_grants: input.maxGrantsPerHour,
    p_window_seconds: GRANT_WINDOW_SECONDS,
  });
  if (error) {
    // PGRST202 means supabase/migrations/20261101120000_evidence.sql has not been applied.
    console.error("[evidence] grant rpc failed", { code: error.code });
    return { status: 500, code: "server_error", message: "Could not authorize the download. Try again shortly." };
  }
  const row = data?.[0];
  if (!row || row.outcome === "not_found") {
    return { status: 404, code: "not_found", message: "Evidence not found." };
  }
  if (row.outcome === "rate_limited") {
    const retry = Math.max(1, Math.ceil(row.retry_after_seconds || 60));
    return {
      status: 429,
      code: "rate_limited",
      message: `Too many download links requested. Try again in ${Math.ceil(retry / 60)} minute(s).`,
      retryAfterSeconds: retry,
    };
  }
  if (row.outcome !== "granted" || !row.object_key || !row.display_name || !row.sha256 || row.size_bytes == null) {
    console.error("[evidence] unexpected grant response");
    return { status: 500, code: "server_error", message: "Could not authorize the download." };
  }

  let url: string;
  try {
    url = await input.presign({
      objectKey: row.object_key,
      displayName: row.display_name,
      mimeType: row.mime_type,
      expiresInSeconds: input.ttlSeconds,
    });
  } catch (e) {
    // Never log the URL or credentials; the error name is enough to diagnose.
    console.error("[evidence] presign failed", { name: (e as Error)?.name });
    return { status: 502, code: "storage_error", message: "Evidence storage is unavailable. Try again shortly." };
  }

  const now = input.now?.() ?? Date.now();
  return {
    status: 200,
    body: {
      url,
      expiresAt: new Date(now + input.ttlSeconds * 1000).toISOString(),
      expiresInSeconds: input.ttlSeconds,
      displayName: row.display_name,
      sizeBytes: Number(row.size_bytes),
      sha256: row.sha256,
    },
  };
}
