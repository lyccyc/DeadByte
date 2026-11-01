/** S3 client for Cloudflare R2, shared by the server and scripts/upload-evidence.ts. */
import { S3Client } from "@aws-sdk/client-s3";
import type { R2Env } from "./env";

export type { R2Env } from "./env";
export { readR2Env } from "./env";

export function createR2S3Client(env: R2Env): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${env.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env.accessKeyId, secretAccessKey: env.secretAccessKey },
    // R2 does not implement every newer default SDK checksum behaviour; only send checksums when an operation requires them.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}
