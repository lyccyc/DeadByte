import "server-only";
import { GetObjectCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { SHA256_METADATA_KEY, contentDisposition } from "@/lib/evidence";
import { createR2S3Client, readR2Env, type R2Env } from "@/lib/r2/config";

/**
 * Server-only access to the private Cloudflare R2 evidence bucket.
 * Credentials come from R2_* environment variables and never leave the server.
 */

let cached: { client: S3Client; env: R2Env } | null = null;

function r2(): { client: S3Client; env: R2Env } {
  if (!cached) {
    const env = readR2Env();
    cached = { client: createR2S3Client(env), env };
  }
  return cached;
}

export interface PresignInput {
  objectKey: string;
  displayName: string;
  mimeType: string | null;
  expiresInSeconds: number;
}

/**
 * Short-lived presigned GET URL on the R2 S3 endpoint. It is a bearer
 * capability: never log or store it.
 */
export async function presignEvidenceDownload({ objectKey, displayName, mimeType, expiresInSeconds }: PresignInput): Promise<string> {
  const { client, env } = r2();
  const command = new GetObjectCommand({
    Bucket: env.bucket,
    Key: objectKey,
    ResponseContentDisposition: contentDisposition(displayName),
    ResponseContentType: mimeType ?? "application/octet-stream",
  });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

export type HeadResult =
  | { exists: true; sizeBytes: number; sha256: string | null }
  | { exists: false };

/** HEAD an object: existence, size and the SHA-256 recorded by the uploader. */
export async function headEvidenceObject(objectKey: string): Promise<HeadResult> {
  const { client, env } = r2();
  try {
    const head = await client.send(new HeadObjectCommand({ Bucket: env.bucket, Key: objectKey }));
    return {
      exists: true,
      sizeBytes: Number(head.ContentLength ?? -1),
      sha256: head.Metadata?.[SHA256_METADATA_KEY]?.toLowerCase() ?? null,
    };
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 404) return { exists: false };
    throw error;
  }
}
