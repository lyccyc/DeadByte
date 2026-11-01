# Evidence storage: Cloudflare R2 (Phase 3)

Evidence bytes live in a **private** R2 bucket. Supabase stores only metadata
(display name, size, SHA-256, object key). Players get a short-lived presigned
GET URL and download **directly from R2**. No evidence bytes pass through
Next.js or Vercel.

## 1. Bucket and API token

1. Cloudflare dashboard → **R2** → **Create bucket**. Use one bucket per
   environment, e.g. `deadbyte-evidence-dev` and `deadbyte-evidence-prod`.
   Location: Automatic. Storage class: **Standard**.
2. Keep it private: do **not** enable the `r2.dev` public URL or a custom
   public domain.
3. **R2 → Manage API tokens → Create API token**:
   - Permission: **Object Read & Write**.
   - Scope: **only** the evidence bucket(s) for that environment.
4. Copy the **Access Key ID** and **Secret Access Key**. The secret is shown
   only once. Your **Account ID** is on the R2 overview page.

## 2. Environment variables

Set these in `.env.local` for local development and the CLI, and in Vercel
(Production and Preview separately: never point Preview at the prod bucket):

| Variable | Notes |
| --- | --- |
| `R2_ACCOUNT_ID` | 32-character hex Cloudflare account id |
| `R2_ACCESS_KEY_ID` | from the API token |
| `R2_SECRET_ACCESS_KEY` | from the API token. Server/CLI only. **Never** `NEXT_PUBLIC_` |
| `R2_BUCKET_NAME` | e.g. `deadbyte-evidence-prod` |
| `EVIDENCE_URL_TTL_SECONDS` | optional, signed-URL lifetime, 300–900 (default 600) |
| `EVIDENCE_GRANTS_PER_HOUR` | optional, download links per player per rolling hour (default 30) |

The app enables downloads only when accounts are configured **and** all four
`R2_*` variables are present and valid. Partial or invalid values show an
`EVIDENCE STORAGE MISCONFIGURED` banner and keep downloads off. Accounts and
scoring keep working.

**CORS is not needed.** Downloads are top-level navigations to the signed URL,
and uploads come from the CLI, not the browser.

## 3. Apply the evidence migration

Apply `supabase/migrations/20261101120000_evidence.sql` the same way as the
core schema ([`database.md`](./database.md) §1). Without it, admin
registration reports `migration_missing` and download requests fail closed.

## 4. Upload evidence (operator CLI)

```bash
npm run upload-evidence -- --challenge <challenge-uuid> --file ./frozen-memory.7z --register
```

The CLI:

1. streams the file once to compute SHA-256 (never loads it into memory);
2. uploads with S3 multipart (`@aws-sdk/lib-storage`, 64 MiB parts, 4 in
   parallel, part size raised automatically above about 625 GiB), hashing the
   bytes again as they are sent; if the file changed mid-upload, the object is deleted;
3. stores the SHA-256 as object metadata `x-amz-meta-sha256` (R2 multipart
   ETags are **not** SHA-256);
4. HEAD-checks the stored object's size and checksum metadata;
5. writes a manifest to `evidence-manifests/<file-id>.json` (git-ignored, no
   secrets) and prints it;
6. with `--register` (needs `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SECRET_KEY`),
   attaches the file to the challenge as **verified** evidence.

Without `--register`, open `/admin/challenges/<id>` → **Evidence**, paste the
manifest, and click **Verify in R2 & attach**. The server HEAD-checks the object
again before it attaches it.

Ctrl-C aborts the multipart upload. A failed upload is aborted automatically.
As a safety net, add an R2 **lifecycle rule** on the bucket: *Abort incomplete
multipart uploads after 1 day*.

Object keys are immutable: `evidence/challenges/<challenge-uuid>/v<n>/<file-uuid>.<ext>`.
To replace evidence, upload a new file (`--version 2`), attach it, then
deactivate the old one in the admin UI. The last verified file of a published
challenge that requires evidence cannot be deactivated.

## 5. How downloads work

1. A signed-in player clicks **DOWNLOAD EVIDENCE** on a published challenge.
2. `POST /api/v1/evidence/:id/download` checks the session and same-origin, then
   calls `svc_grant_evidence_download`. In one transaction that function checks
   that the file is active and verified and its challenge is published,
   applies the per-user rate limit, and records the grant.
3. The server signs a GET URL for the R2 S3 endpoint
   (`<bucket>.<account>.r2.cloudflarestorage.com`) with
   `Content-Disposition: attachment` and returns it with its expiry.
4. The browser downloads straight from R2. The UI also offers a
   `curl -fL -C - -o <name> '<url>'` command for resumable CLI downloads.

Signed URLs are **bearer capabilities**: anyone with an unexpired URL can use
it, and it cannot be revoked. They are never logged or stored. Deactivating a
file stops new links. Links already issued expire within the TTL.

## Verified behaviour

The following was checked against a real R2 bucket with a 12 MB synthetic file,
which was deleted afterwards:

- 3-part multipart upload via the CLI, and HEAD verification of size and SHA-256 metadata;
- a presigned GET downloads the exact bytes (SHA-256 matches), with `Accept-Ranges: bytes`
  and the expected `Content-Disposition`;
- an interrupted download resumes with `curl -C -` (`206 Partial Content`), and the result matches the SHA-256;
- a request without a signature is rejected (400), and an expired signed URL returns `403 ExpiredRequest`.

R2 limits: a single PUT can be up to 5 GiB. Multipart uploads can be up to about 5 TiB, with up to
10,000 parts and equal-sized parts except the last. Check the current
[R2 limits](https://developers.cloudflare.com/r2/platform/limits/) and
[pricing](https://developers.cloudflare.com/r2/pricing/) before launching public downloads.
