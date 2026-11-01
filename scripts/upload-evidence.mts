/**
 * Trusted operator CLI: stream a (possibly multi-GB) evidence file into the
 * private R2 bucket with a multipart upload, verify it, and print a manifest.
 *
 *   npm run upload-evidence -- --challenge <challenge-uuid> --file ./frozen-memory.7z [--register]
 *
 * Options:
 *   --challenge <uuid>   challenge the evidence belongs to (required)
 *   --file <path>        local file to upload (required)
 *   --name <display>     filename shown to players (default: the file's basename)
 *   --version <n>        key version segment v<n> (default 1; use a new version when replacing evidence)
 *   --mime <type>        Content-Type stored on the object (default application/octet-stream)
 *   --part-size-mb <n>   multipart part size in MiB (default 64; raised automatically for huge files)
 *   --concurrency <n>    parallel part uploads (default 4)
 *   --out <path>         manifest path (default evidence-manifests/<file-id>.json, git-ignored)
 *   --register           also attach the verified object to the challenge in Supabase
 *
 * Env (from .env.local or the shell): R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,
 * R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME; with --register also
 * NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.
 *
 * The file is read twice and never loaded into memory: pass 1 computes the
 * SHA-256 (stored as x-amz-meta-sha256, because R2 multipart ETags are not
 * SHA-256), pass 2 streams the upload while hashing again, so a file that
 * changes mid-upload is detected and the object deleted. After upload the
 * object is HEAD-checked for size and checksum metadata.
 */
import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Transform } from "node:stream";
import { parseArgs } from "node:util";
import { DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SHA256_METADATA_KEY, buildObjectKey, evidenceManifestSchema, sanitizeDisplayName, type EvidenceManifest } from "../src/lib/evidence";
import { createR2S3Client, readR2Env, type R2Env } from "../src/lib/r2/config";

const MiB = 1024 * 1024;
const MAX_PARTS = 10_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function fail(message: string, code = 1): never {
  console.error(`error: ${message}`);
  process.exit(code);
}

const { values } = parseArgs({
  options: {
    challenge: { type: "string" },
    file: { type: "string" },
    name: { type: "string" },
    version: { type: "string", default: "1" },
    mime: { type: "string" },
    "part-size-mb": { type: "string", default: "64" },
    concurrency: { type: "string", default: "4" },
    out: { type: "string" },
    register: { type: "boolean", default: false },
  },
});

const challengeId = values.challenge?.trim().toLowerCase();
if (!challengeId || !UUID.test(challengeId) || !values.file) {
  fail("usage: upload-evidence --challenge <challenge-uuid> --file <path> [--name <display name>] [--version <n>] [--register]", 2);
}
const version = Number.parseInt(values.version!, 10);
if (!Number.isInteger(version) || version < 1 || version > 9999) fail("--version must be an integer from 1 to 9999", 2);
const concurrency = Number.parseInt(values.concurrency!, 10);
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 16) fail("--concurrency must be 1-16", 2);
const mimeType = values.mime?.trim() || null;
if (mimeType && !/^[\w.+-]+\/[\w.+-]+$/.test(mimeType)) fail("--mime must look like type/subtype", 2);

const filePath = path.resolve(values.file!);
const info = await stat(filePath).catch(() => fail(`cannot read ${filePath}`));
if (!info.isFile()) fail(`${filePath} is not a regular file`);
const sizeBytes = info.size;
const displayName = sanitizeDisplayName(values.name ?? path.basename(filePath));
if (!displayName) fail("display name is empty", 2);

let partSize = Math.max(5 * MiB, Number.parseInt(values["part-size-mb"]!, 10) * MiB || 64 * MiB);
if (Math.ceil(sizeBytes / partSize) > MAX_PARTS) partSize = Math.ceil(sizeBytes / (MAX_PARTS - 1) / MiB) * MiB;

let r2Env: R2Env;
try {
  r2Env = readR2Env();
} catch (e) {
  fail((e as Error).message, 2);
}
const s3 = createR2S3Client(r2Env);

// Optional Supabase client for --register; check the challenge BEFORE spending time uploading.
let supabase: SupabaseClient | null = null;
if (values.register) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret) fail("--register needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY", 2);
  supabase = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.from("challenges").select("id, slug, status").eq("id", challengeId).maybeSingle();
  if (error) fail(`challenge lookup failed: ${error.code ?? ""} ${error.message}`);
  if (!data) fail(`no challenge with id ${challengeId}`);
  console.error(`challenge: ${(data as { slug: string }).slug} (${(data as { status: string }).status})`);
}

const fmt = (n: number) => (n >= 1024 ** 3 ? `${(n / 1024 ** 3).toFixed(2)} GiB` : `${(n / MiB).toFixed(1)} MiB`);
function progress(label: string, done: number) {
  const pct = sizeBytes === 0 ? 100 : Math.floor((done / sizeBytes) * 100);
  process.stderr.write(`\r${label}: ${pct}% (${fmt(done)} / ${fmt(sizeBytes)})   `);
}

// Pass 1: SHA-256.
async function hashFile(): Promise<string> {
  const hash = createHash("sha256");
  let done = 0;
  let last = 0;
  for await (const chunk of createReadStream(filePath, { highWaterMark: 4 * MiB })) {
    hash.update(chunk as Buffer);
    done += (chunk as Buffer).length;
    if (Date.now() - last > 500) {
      progress("hashing  ", done);
      last = Date.now();
    }
  }
  progress("hashing  ", done);
  process.stderr.write("\n");
  return hash.digest("hex");
}

const sha256 = await hashFile();
const fileId = randomUUID();
const objectKey = buildObjectKey(challengeId, version, fileId, path.basename(filePath));
console.error(`sha256:   ${sha256}`);
console.error(`object:   ${r2Env.bucket}/${objectKey}`);
console.error(`parts:    ${Math.max(1, Math.ceil(sizeBytes / partSize))} x ${fmt(partSize)}, concurrency ${concurrency}`);

// Pass 2: streaming multipart upload, hashing the bytes actually sent.
const uploadHash = createHash("sha256");
let streamed = 0;
const tee = new Transform({
  transform(chunk: Buffer, _enc, cb) {
    uploadHash.update(chunk);
    streamed += chunk.length;
    cb(null, chunk);
  },
});
const source = createReadStream(filePath, { highWaterMark: 4 * MiB });
source.on("error", (e) => tee.destroy(e));
source.pipe(tee);

const upload = new Upload({
  client: s3,
  params: {
    Bucket: r2Env.bucket,
    Key: objectKey,
    Body: tee,
    ContentType: mimeType ?? "application/octet-stream",
    Metadata: { [SHA256_METADATA_KEY]: sha256 },
  },
  partSize,
  queueSize: concurrency,
  // Abort the multipart upload (and discard uploaded parts) on any failure.
  leavePartsOnError: false,
});
let lastProgress = 0;
upload.on("httpUploadProgress", (p) => {
  if (Date.now() - lastProgress > 500) {
    progress("uploading", p.loaded ?? 0);
    lastProgress = Date.now();
  }
});

let interrupted = false;
process.once("SIGINT", () => {
  interrupted = true;
  console.error("\ninterrupted: aborting the multipart upload...");
  void upload.abort();
});

async function deleteObject(reason: string): Promise<never> {
  await s3.send(new DeleteObjectCommand({ Bucket: r2Env.bucket, Key: objectKey })).catch(() => undefined);
  fail(`${reason}; the uploaded object was deleted`);
}

try {
  await upload.done();
} catch (e) {
  fail(interrupted ? "upload aborted" : `upload failed (${(e as Error).name}): ${(e as Error).message}`);
}
progress("uploading", streamed);
process.stderr.write("\n");

if (streamed !== sizeBytes || uploadHash.digest("hex") !== sha256) {
  await deleteObject("the file changed while it was being uploaded");
}

const head = await s3.send(new HeadObjectCommand({ Bucket: r2Env.bucket, Key: objectKey }));
if (Number(head.ContentLength) !== sizeBytes) await deleteObject(`stored size ${head.ContentLength} != local size ${sizeBytes}`);
if (head.Metadata?.[SHA256_METADATA_KEY] !== sha256) await deleteObject("stored checksum metadata does not match");
console.error("verified: object exists with the expected size and SHA-256 metadata");

const manifest: EvidenceManifest = evidenceManifestSchema.parse({
  manifestVersion: 1,
  challengeId,
  objectKey,
  displayName,
  sizeBytes,
  sha256,
  mimeType,
  bucket: r2Env.bucket,
  uploadedAt: new Date().toISOString(),
});
const outPath = path.resolve(values.out ?? path.join("evidence-manifests", `${fileId}.json`));
await mkdir(path.dirname(outPath), { recursive: true });
await writeFile(outPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.error(`manifest: ${outPath}`);

if (supabase) {
  const { data, error } = await supabase.rpc("svc_register_evidence", {
    p_actor: null,
    p_challenge_id: challengeId,
    p_evidence_id: fileId,
    p_object_key: objectKey,
    p_display_name: displayName,
    p_size_bytes: sizeBytes,
    p_sha256: sha256,
    p_mime_type: mimeType,
  });
  if (error) fail(`upload succeeded but registration failed: ${error.code ?? ""} ${error.message}. Register the manifest in the admin UI.`);
  if (data !== "registered" && data !== "already_registered") {
    fail(`upload succeeded but registration returned "${String(data)}". Register the manifest in the admin UI.`);
  }
  console.error(`registered: evidence ${fileId} attached to challenge ${challengeId} as verified`);
} else {
  console.error("next: paste the manifest into /admin/challenges/<id> → Evidence → Register, or re-run with --register");
}

// The manifest (no secrets) on stdout, for piping.
console.log(JSON.stringify(manifest, null, 2));
