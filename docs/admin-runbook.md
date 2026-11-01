# Admin runbook: publishing a challenge with evidence

Prerequisites: Supabase is configured with both migrations applied
([`database.md`](./database.md)), R2 is configured ([`r2-setup.md`](./r2-setup.md)),
and your account has the admin role (`npm run set-role`).

## Publish a new case

1. **Prepare the evidence offline.** Use synthetic or permission-cleared data only.
   Review memory images and phone backups for real credentials, tokens and personal
   data before uploading. Archive the evidence if useful (`.7z`, `.zip`), or upload
   raw images (`.raw`, `.E01`, `.pcapng`) as they are.
2. **Create a draft.** Go to `/admin/challenges` → **New challenge**. Set the
   region, difficulty, points and briefing, and the flag (stored only as an
   HMAC digest). Keep **Requires verified evidence** ticked.
3. **Upload and attach.** Copy the command from the challenge's **Evidence**
   panel and run it from a trusted machine:

   ```bash
   npm run upload-evidence -- --challenge <challenge-uuid> --file ./case.7z --register
   ```

   Reload the edit page. The file shows as `verified · active · attached`.
   Without `--register`, paste the printed manifest into the panel and click
   **Verify in R2 & attach**.
4. **Publish.** Publishing is refused without a flag, or without at least one
   verified evidence file when evidence is required.
5. **Smoke test as a player.** Use a separate non-admin account. Download the
   evidence, check the SHA-256 shown on the page (`sha256sum file`), submit a
   wrong flag (rejected), the right flag (points awarded), and the right flag
   again (0 points).

## Replace or withdraw evidence

- **Replace:** upload a new version (`--version 2 --register`), then
  **Deactivate** the old file.
- **Withdraw everything:** archive the challenge. Awarded points are kept.
  Links already issued keep working until they expire (10 minutes by default).
- Old objects stay in R2 until you delete them yourself. Database rows are
  never hard-deleted by the app.

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `migration_missing` in the admin panel | Apply `supabase/migrations/20261101120000_evidence.sql`. |
| `object_missing` | The object key is not in this environment's bucket (wrong `R2_BUCKET_NAME`?). |
| `checksum_mismatch` with "no recorded SHA-256" | The object was uploaded with another tool. Re-upload it with `npm run upload-evidence`. |
| Player sees 429 | More than `EVIDENCE_GRANTS_PER_HOUR` links in an hour. The response's `Retry-After` header says when they can try again. |
| `EVIDENCE STORAGE MISCONFIGURED` banner | Some `R2_*` variables are missing or invalid. The banner names which. |
| Upload killed mid-way | The CLI aborts the multipart upload. The bucket lifecycle rule cleans up any leftovers. |
