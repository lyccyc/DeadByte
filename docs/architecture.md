# Architecture (current state: Phases 0–2)

A single Next.js 16 App Router application (TypeScript, Tailwind CSS v4) with
`cacheComponents` and `partialPrefetching` enabled, plus Supabase (Postgres and
Auth). There are no extra services. See `docs/database.md` for the schema and
security model.

## Modes (`src/lib/app-config.ts`)

| Mode | When | Behaviour |
| --- | --- | --- |
| `demo` | no Supabase variables | Demo catalogue. Auth, submission, profile, leaderboard and admin are visibly disabled; APIs return `503`. |
| `configured` | Supabase URL, publishable key, secret key and `FLAG_HMAC_SECRET` (≥32 bytes) all set | Real accounts, DB catalogue, flag submission, profile, leaderboard, admin. |
| `misconfigured` | partial or invalid values, or a secret behind `NEXT_PUBLIC_` | Banner with secret-free diagnostics; everything protected stays off (fail closed). |

Evidence downloads (R2) need the Phase 3 code (`EVIDENCE_DOWNLOADS_IMPLEMENTED`) and stay disabled until it ships.

## Layout

| Path | Purpose |
| --- | --- |
| `src/config/regions.ts` | Single source of truth for the seven-continent mapping (the SQL seed is tested against it). |
| `src/lib/supabase/` | `public.ts` (cookieless anon client, used for cached public reads), `server.ts` (per-request cookie client, runs as the user under RLS), `admin.ts` (secret-key client, server-only), `proxy.ts` (session refresh). |
| `src/server/catalogue.ts` | Public catalogue: demo data, or published DB challenges plus solve counts. `"use cache"`, tag `catalogue`. |
| `src/server/auth.ts` | Data Access Layer: verified user via `getClaims()`, role via `svc_get_user_role`, `checkAdmin()`. |
| `src/server/submissions/submit-flag.ts` | Trusted submit flow (normalise → HMAC → `svc_submit_flag`). |
| `src/server/leaderboard.ts`, `src/server/progress.ts` | Leaderboard (cached public aggregates, tag `leaderboard`) and the player's own progress (RLS). |
| `src/server/admin/challenges.ts` | Admin list/read/save/publish/archive through `svc_*` functions. |
| `src/server/auth-actions.ts` | Server Actions: sign in, sign up, password reset/update, username update. |
| `src/app/api/v1/` | Route Handlers. Mutations check `Origin` and the session, and return `Cache-Control: private, no-store` for personal data. |
| `src/proxy.ts` | Real 404s for unknown regions (and demo challenges); Supabase session refresh. |

## Caching rules

- Public data (catalogue, leaderboard) is cached with `"use cache"` and
  invalidated by tag. Admin edits and new solves call
  `revalidateTag(tag, { expire: 0 })`.
- Anything that reads cookies (header account, solved badges, flag panel,
  profile, admin gate) renders inside `<Suspense>` and is never cached in
  shared caches.
- Backend failures are cached with `RETRY_SOON` (revalidated after 15 s), so an
  outage is not frozen into pages.

## Honesty rules in the UI

- A site-wide banner shows demo mode, misconfiguration, or an unmigrated or
  unreachable database.
- Controls without a working backend (e.g. evidence download before Phase 3)
  are rendered **disabled**, with an explanation.
- Database challenges marked as sample content show a **Sample** label.
- The leaderboard shows real solves only.

## Map accessibility

Each continent is an SVG `<a href="/regions/<slug>">` with an `aria-label` that
contains the continent, its domain and its published case count. Tab focuses
continents, and Enter or Space opens them. Hover or focus updates a polite live
readout. Antarctica has an enlarged hit area. The seven region cards below the
map are the primary navigation on small screens.
