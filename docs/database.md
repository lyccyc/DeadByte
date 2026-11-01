# Database, auth and scoring (Phase 2)

DeadByte uses **Supabase** (Postgres + Auth). Schema and security live in
`supabase/migrations/`; there is no ORM.

## 1. Apply the migrations

The app shows **DATABASE NOT READY** until this step is done.

**Option A — Supabase dashboard (simplest)**

1. Open your project → **SQL Editor** → **New query**.
2. Paste the full contents of `supabase/migrations/20261031120000_core_schema.sql` and **Run**.
3. Reload the site; the red banner disappears.

**Option B — Supabase CLI**

```bash
npx supabase link --project-ref <your-project-ref>
```

```bash
npx supabase db push
```

`db push` records applied migrations, so future migrations apply incrementally.
Do not mix options A and B for the same migration on the same project.

Rollback (development only, **destroys data**): `supabase/rollbacks/20261031120000_core_schema.down.sql`.

## 2. Configure Supabase Auth

In **Authentication → URL Configuration**:

| Setting | Value |
| --- | --- |
| Site URL | your deployed URL, e.g. `https://deadbyte.example` (or `http://localhost:3000` locally) |
| Redirect URLs | `http://localhost:3000/auth/confirm`, `https://<your-domain>/auth/confirm` (add Vercel preview domains if used) |

In **Authentication → Providers → Email**, keep **Confirm email** enabled for a public
site. Set `NEXT_PUBLIC_SITE_URL` to the same URL as the Site URL: the app uses it
to build email links that land on `/auth/confirm`.

Supabase's built-in email sender is heavily rate-limited and meant for testing.
Configure custom SMTP (**Authentication → SMTP Settings**) before public launch.

## 3. Make yourself an administrator

1. Register on the site and confirm your email.
2. Run the operator CLI. It needs `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SECRET_KEY`,
   from `.env.local` or the environment:

```bash
npm run set-role -- --email you@example.com --role admin
```

3. Sign out and back in. **Admin** appears in the header → `/admin/challenges`.

Roles live in `private.user_roles`, which is not exposed through the Data API.
They are never read from user-editable JWT metadata.

## 4. Publish the first end-to-end test case

1. `/admin/challenges` → **New challenge**: e.g. *The Frozen Memory*, region Antarctica, 100 points,
   tick **Sample / testing-only**, choose your own test flag (`DEADBYTE{...}`).
2. Until R2 evidence uploads exist (Phase 3), untick **Requires verified evidence**, or publishing is
   (correctly) refused.
3. **Publish**. Then, as a separate player account: open the case → submit a wrong flag (rejected) →
   the right flag (+100) → the right flag again (0 points, "already solved") → check `/profile` and `/leaderboard`.

## Security model

| Object | Exposure |
| --- | --- |
| `public.regions` | Public read. |
| `public.challenges` | Public read of **published** rows only (RLS). `created_by` not granted. |
| `public.evidence_files` | Public read of active, verified files of published challenges. **`object_key` is not granted** to API roles. |
| `public.profiles` | Public read of `username`, `avatar_url`. Owner may update only those two columns. No email. |
| `public.submissions`, `public.solves` | Owner read only. **No insert/update grants** for any API role. |
| `private.*` (`user_roles`, `flag_verifiers`, `admin_audit_logs`) | Not exposed; no grants to `anon`/`authenticated`. |
| `public.svc_*` functions | `SECURITY DEFINER`, `search_path=''`, **EXECUTE granted to `service_role` only**. |

The `svc_*` functions sit in `public` only because the Supabase Data API (and so
the server's secret-key client) can reach only exposed schemas. Their EXECUTE
privilege is revoked from `public`, `anon` and `authenticated`, so a browser holding
the publishable key cannot call them. `supabase/tests` verifies this, and so do
`tests/unit/database-mapping.test.ts`.

### Flag verification and scoring

1. The server normalises the flag: it trims surrounding whitespace only, and
   **case is preserved**. It rejects empty input, input over 256 characters, and
   control characters.
2. The server computes `HMAC-SHA256(FLAG_HMAC_SECRET, flag)`. Plaintext flags are
   never stored or logged, and neither are submitted attempts.
3. `svc_submit_flag` runs in **one transaction** and does the following:
   - takes a per-user advisory lock;
   - enforces the rate limit (default 10 attempts per rolling minute; `429` with
     `Retry-After`);
   - compares the digest with `private.flag_verifiers` (the expected digest never
     leaves the database);
   - records the attempt;
   - inserts the solve with `ON CONFLICT DO NOTHING` on `unique(user_id, challenge_id)`.

   Concurrent correct submissions therefore award points exactly once. The test
   suite races eight of them.
4. `points_awarded` is copied from the challenge at the first solve. Editing
   points later does not change past awards. Archiving a challenge hides it but
   keeps the points earned on it.

Rotating `FLAG_HMAC_SECRET` invalidates every stored digest. Re-enter each flag in
the admin UI after a rotation.

### Leaderboard ranking

1. Total points (sum of `points_awarded`), descending.
2. The time that total was reached (latest solve), ascending. Whoever got there
   first ranks higher.
3. Username, ascending (case-insensitive), as the final stable tie breaker.

Every player gets a unique position, and players with no solves are not listed.
Only usernames and aggregates are public.

## Tests

`npm run test:db` runs every migration and `supabase/tests/*.test.sql` against a
**disposable** Postgres, using a small stub of Supabase's roles and `auth`
schema. It also runs the concurrency race and the rollback. It refuses to run
against Supabase hosts.

```bash
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres npm run test:db
```

CI runs this against a `postgres:17` service container.
